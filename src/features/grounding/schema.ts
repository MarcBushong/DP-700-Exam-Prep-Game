import { z } from 'zod';
import {
  learnUrlSchema,
  officialSourceUrlSchema,
  isAllowedSourceUrl,
  isAllowedIdentityUrl,
  type SourcePolicyContext,
} from '../dungeons/sourcePolicy';
import { duplicateFindings, normalizedChoice } from './quality';
import type { ContentFinding } from './quality';

export {
  duplicateFindings,
  nearDuplicates,
  normalizedQuestion,
} from './quality';

export const difficulties = [
  'beginner',
  'intermediate',
  'advanced',
  'expert',
] as const;
export const complexities = [
  'concept-recall',
  'technical-implementation',
  'scenario-based',
  'troubleshooting',
  'architecture-design',
] as const;
export const formats = [
  'single-select',
  'multi-select',
  'true-false',
  'scenario',
  'code',
] as const;
export const answerModes = [
  'immediate',
  'explanations-only',
  'hidden',
  'study',
  'exam',
] as const;
export const orders = ['random', 'study-guide', 'weakest', 'balanced'] as const;
export const featureStatuses = ['GA', 'Preview', 'Not applicable'] as const;
export const verificationStatuses = [
  'verified',
  'manual-review-required',
  'rejected',
  'stale',
] as const;

const text = z.string().trim().min(1);
export const timestampSchema = z.iso.datetime();
export { learnUrlSchema, officialSourceUrlSchema };

export const taxonomySchema = z.object({
  schemaVersion: z.literal(1),
  retrievedAt: timestampSchema,
  studyGuideEffectiveDate: text,
  studyGuideUrl: officialSourceUrlSchema,
  domains: z
    .array(
      z.object({
        id: text,
        title: text,
        weightRange: z
          .tuple([
            z.number().positive().max(100),
            z.number().positive().max(100),
          ])
          .refine(
            ([min, max]) => min <= max,
            'Weight minimum cannot exceed maximum.',
          )
          .nullable()
          .optional(),
        skills: z
          .array(
            z.object({
              id: text,
              title: text,
              subskills: z.array(text).min(1),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

export const sourceSchema = z.object({
  sourceId: text,
  title: text,
  url: officialSourceUrlSchema,
  retrievedAt: timestampSchema,
  lastReviewedAt: timestampSchema,
  applicableObjectiveDomains: z.array(text).min(1),
  applicableSkills: z.array(text),
  featureStatus: z.enum(featureStatuses),
  shortSummary: text,
});

export const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  lastGroundedAt: timestampSchema,
  retrievalMethod: z.enum([
    'Microsoft Learn MCP',
    'Official GitHub documentation',
  ]),
  sources: z.array(sourceSchema).min(1),
});

export const questionSchema = z
  .object({
    id: text,
    question: text.min(30),
    questionType: z.enum(formats),
    answerChoices: z
      .array(z.object({ id: text, text }))
      .min(2)
      .max(6),
    correctAnswer: z.array(text).min(1),
    explanation: text,
    deepExplanation: text,
    whyOtherAnswersAreWrong: z.record(z.string(), text),
    objectiveDomain: text,
    skill: text,
    subskill: text,
    difficulty: z.enum(difficulties),
    complexity: z.enum(complexities),
    sourceIds: z.array(text).min(1),
    sourceUrls: z.array(officialSourceUrlSchema).min(1),
    documentationTitles: z.array(text).min(1),
    generatedAt: timestampSchema,
    lastValidatedAt: timestampSchema,
    featureStatus: z.enum(['GA', 'Preview']),
    tags: z.array(text).min(1),
    codeLanguage: z
      .enum(['sql', 'python', 'kusto', 'json', 'powershell'])
      .optional(),
    codeSnippet: text.optional(),
    conceptId: z.string().trim().default(''),
    verificationStatus: z
      .enum(verificationStatuses)
      .default('manual-review-required'),
    verifiedAt: timestampSchema.optional(),
    verifiedAgainstSourceIds: z.array(text).default([]),
    verificationNotes: z.string().trim().default(''),
    requiresManualReview: z.boolean().default(true),
    sourceLastReviewedAt: timestampSchema.optional(),
    confidenceReason: z.string().trim().default(''),
  })
  .superRefine((q, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    const choices = q.answerChoices.map((choice) => choice.id);
    if (new Set(choices).size !== choices.length)
      fail('Answer choice IDs must be unique.');
    if (
      new Set(q.answerChoices.map((choice) => normalizedChoice(choice.text)))
        .size !== choices.length
    )
      fail('Answer choices must be distinct.');
    if (
      new Set(q.correctAnswer).size !== q.correctAnswer.length ||
      q.correctAnswer.some((id) => !choices.includes(id))
    )
      fail('Correct answers must reference distinct existing choices.');
    if (q.questionType !== 'multi-select' && q.correctAnswer.length !== 1)
      fail('Only multi-select questions can have multiple correct choices.');
    if (q.questionType === 'multi-select' && q.correctAnswer.length < 2)
      fail('Multi-select requires at least two correct choices.');
    if (q.questionType === 'multi-select') {
      const declared = q.question
        .match(/\b(?:choose|select)\s+(\d+|two|three|four|five)\b/i)?.[1]
        ?.toLowerCase();
      const count = declared
        ? Number(declared) || { two: 2, three: 3, four: 4, five: 5 }[declared]
        : undefined;
      if (count && count !== q.correctAnswer.length)
        fail(
          'The stated multi-select answer count must match the correct answer count.',
        );
    }
    if (q.correctAnswer.length === choices.length)
      fail('Include at least one plausible distractor.');
    if (
      q.questionType === 'true-false' &&
      (choices.length !== 2 ||
        !['true', 'false'].every((label) =>
          q.answerChoices.some((c) => c.text.toLowerCase() === label),
        ))
    )
      fail('True/false questions need True and False choices.');
    const distractors = choices.filter((id) => !q.correctAnswer.includes(id));
    if (
      distractors.some((id) => !q.whyOtherAnswersAreWrong[id]) ||
      Object.keys(q.whyOtherAnswersAreWrong).some(
        (id) => !distractors.includes(id),
      )
    )
      fail('Explain every distractor, and only distractors.');
    if (
      q.sourceIds.length !== q.sourceUrls.length ||
      q.sourceIds.length !== q.documentationTitles.length ||
      new Set(q.sourceIds).size !== q.sourceIds.length
    )
      fail('Citation IDs, URLs, and titles must align one-to-one.');
    if (
      Boolean(q.codeLanguage) !== Boolean(q.codeSnippet) ||
      (q.questionType === 'code' && !q.codeSnippet)
    )
      fail('Code questions require a language and snippet together.');
    if (Date.parse(q.lastValidatedAt) < Date.parse(q.generatedAt))
      fail('Validation cannot predate generation.');
    if (q.verificationStatus === 'verified') {
      if (
        !q.conceptId ||
        !q.verifiedAt ||
        !q.sourceLastReviewedAt ||
        !q.verificationNotes ||
        !q.confidenceReason ||
        q.requiresManualReview
      )
        fail(
          'Verified questions require complete review metadata and no manual review flag.',
        );
      if (!sameIds(q.sourceIds, q.verifiedAgainstSourceIds))
        fail('Verified source IDs must exactly match all cited source IDs.');
      if (
        q.verifiedAt &&
        (Date.parse(q.verifiedAt) < Date.parse(q.lastValidatedAt) ||
          (q.sourceLastReviewedAt &&
            Date.parse(q.verifiedAt) < Date.parse(q.sourceLastReviewedAt)))
      )
        fail(
          'Verification cannot predate generation, validation, or source review.',
        );
    }
  });

export type Question = z.infer<typeof questionSchema>;
export type Taxonomy = z.infer<typeof taxonomySchema>;
export type Source = z.infer<typeof sourceSchema>;
export type GroundingManifest = z.infer<typeof manifestSchema>;

function sameIds(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    new Set(right).size === right.length &&
    left.every((id) => right.includes(id))
  );
}

/** Fresh means consistent with the checked-in evidence, not permanently current. */
export function isPlayableQuestion(question: Question): boolean {
  return (
    question.verificationStatus === 'verified' &&
    question.requiresManualReview === false &&
    Boolean(question.conceptId?.trim()) &&
    Boolean(question.verificationNotes?.trim()) &&
    Boolean(question.confidenceReason?.trim()) &&
    Boolean(question.verifiedAt) &&
    Boolean(question.sourceLastReviewedAt) &&
    sameIds(question.sourceIds, question.verifiedAgainstSourceIds ?? []) &&
    Date.parse(question.verifiedAt ?? '') >=
      Date.parse(question.lastValidatedAt) &&
    Date.parse(question.lastValidatedAt) >= Date.parse(question.generatedAt) &&
    Date.parse(question.verifiedAt ?? '') >=
      Date.parse(question.sourceLastReviewedAt ?? '') &&
    Date.parse(question.verifiedAt ?? '') <= Date.now() &&
    question.sourceIds.length > 0 &&
    question.sourceIds.length === question.sourceUrls.length &&
    question.sourceIds.length === question.documentationTitles.length
  );
}

/** Diagnostic mode retains excluded candidates so reports cannot hide failures. */
export function inspectContent(
  questionData: unknown,
  manifestData: unknown,
  taxonomyData: unknown,
  sourcePolicy?: SourcePolicyContext,
) {
  const taxonomy = taxonomySchema.parse(taxonomyData);
  const findings: ContentFinding[] = [];
  const envelope = manifestSchema
    .omit({ sources: true })
    .extend({
      sources: z.array(z.unknown()).min(1),
    })
    .parse(manifestData);
  const sources: Source[] = [];
  for (const record of envelope.sources) {
    const parsed = sourceSchema.safeParse(record);
    if (parsed.success) sources.push(parsed.data);
    else {
      const id =
        record &&
        typeof record === 'object' &&
        'sourceId' in record &&
        typeof record.sourceId === 'string'
          ? record.sourceId
          : 'unknown source';
      for (const issue of parsed.error.issues)
        findings.push({
          code: 'source-schema',
          category: 'citation',
          severity: 'error',
          questionIds: [],
          message: `${id}: ${issue.path.join('.')}: ${issue.message}`,
        });
    }
  }
  const manifest: GroundingManifest = { ...envelope, sources };
  const allQuestions: Question[] = [];
  const records = z.array(z.unknown()).min(1).parse(questionData);
  const fail = (
    message: string,
    questionIds: string[] = [],
    category: ContentFinding['category'] = 'schema',
  ) => {
    findings.push({
      code: category,
      category,
      severity: 'error',
      message,
      questionIds,
    });
  };
  records.forEach((record, index) => {
    const parsed = questionSchema.safeParse(record);
    if (parsed.success) allQuestions.push(parsed.data);
    else {
      const id =
        record &&
        typeof record === 'object' &&
        'id' in record &&
        typeof record.id === 'string'
          ? record.id
          : `record-${index + 1}`;
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        fail(
          `${id}: ${path ? `${path}: ` : ''}${issue.message}`,
          [id],
          /source|citation|documentation/i.test(`${path} ${issue.message}`)
            ? 'citation'
            : 'schema',
        );
      }
    }
  });
  const unique = (values: string[], name: string) => {
    if (new Set(values).size !== values.length) fail(`Duplicate ${name}.`);
  };
  unique(
    taxonomy.domains.map((d) => d.id),
    'domain ID',
  );
  unique(
    taxonomy.domains.flatMap((d) => d.skills.map((s) => s.id)),
    'skill ID',
  );
  unique(
    manifest.sources.map((s) => s.sourceId),
    'source ID',
  );
  unique(
    allQuestions.map((q) => q.id),
    'question ID',
  );
  const now = Date.now();
  const permitted = (url: string) =>
    sourcePolicy
      ? isAllowedSourceUrl(url, sourcePolicy)
      : learnUrlSchema.safeParse(url).success;
  const permittedOutline = (url: string) =>
    sourcePolicy
      ? isAllowedIdentityUrl(url, sourcePolicy)
      : learnUrlSchema.safeParse(url).success;
  if (!permittedOutline(taxonomy.studyGuideUrl))
    fail(
      'Study guide URL is outside the credential source policy.',
      [],
      'citation',
    );
  if (
    sourcePolicy &&
    manifest.retrievalMethod !==
      (sourcePolicy.provider === 'Microsoft'
        ? 'Microsoft Learn MCP'
        : 'Official GitHub documentation')
  )
    fail(
      'Retrieval method does not match the credential provider.',
      [],
      'citation',
    );
  if (
    Date.parse(taxonomy.retrievedAt) > now ||
    Date.parse(manifest.lastGroundedAt) > now
  )
    fail(
      'Grounding and taxonomy retrieval timestamps cannot be in the future.',
    );
  for (const source of manifest.sources) {
    if (
      !(source.featureStatus === 'Not applicable'
        ? permittedOutline(source.url)
        : permitted(source.url))
    )
      fail(
        `${source.sourceId}: URL is outside the credential source policy.`,
        [],
        'citation',
      );
    if (Date.parse(source.lastReviewedAt) < Date.parse(source.retrievedAt))
      fail(`${source.sourceId}: review cannot predate retrieval.`);
    if (
      Date.parse(source.lastReviewedAt) > now ||
      Date.parse(source.retrievedAt) > now
    )
      fail(`${source.sourceId}: source timestamps cannot be in the future.`);
    if (
      source.applicableObjectiveDomains.some(
        (id) => !taxonomy.domains.some((d) => d.id === id),
      )
    )
      fail(`${source.sourceId}: unknown objective domain.`);
    const alignedSkills = taxonomy.domains
      .filter((d) => source.applicableObjectiveDomains.includes(d.id))
      .flatMap((d) => d.skills.map((s) => s.id));
    if (source.applicableSkills.some((id) => !alignedSkills.includes(id)))
      fail(`${source.sourceId}: skill is outside its applicable domains.`);
  }
  const sourceMap = new Map(manifest.sources.map((s) => [s.sourceId, s]));
  for (const question of allQuestions) {
    const questionFail = (
      message: string,
      category: ContentFinding['category'] = 'citation',
    ) => fail(`${question.id}: ${message}`, [question.id], category);
    if (question.sourceUrls.some((url) => !permitted(url)))
      questionFail('URL is outside the credential source policy.');
    const domain = taxonomy.domains.find(
      (d) => d.id === question.objectiveDomain,
    );
    const skill = domain?.skills.find((s) => s.id === question.skill);
    if (!domain || !skill?.subskills.includes(question.subskill))
      questionFail('unknown domain, skill, or subskill.', 'mapping');
    if (
      [
        question.generatedAt,
        question.lastValidatedAt,
        question.verifiedAt,
        question.sourceLastReviewedAt,
      ].some((date) => date && Date.parse(date) > now)
    )
      questionFail(
        'question timestamps cannot be in the future.',
        'verification',
      );
    if (
      !question.sourceUrls.some(
        (url) =>
          !url.includes('/credentials/') && !url.includes('/training/courses/'),
      )
    )
      questionFail(
        'cite direct supporting product or training-module documentation, not only exam overview pages.',
      );
    question.sourceIds.forEach((id, i) => {
      const source = sourceMap.get(id);
      if (!source) return questionFail(`unknown citation ${id}.`);
      if (
        source.url !== question.sourceUrls[i] ||
        source.title !== question.documentationTitles[i]
      )
        questionFail(`citation metadata does not match ${id}.`);
      if (
        !source.applicableObjectiveDomains.includes(question.objectiveDomain) ||
        !source.applicableSkills.includes(question.skill)
      )
        questionFail('citation is not aligned to its objective.');
      if (
        source.featureStatus === 'Preview' &&
        question.featureStatus !== 'Preview'
      )
        questionFail('preview feature must be labelled.');
    });
    const sources = question.sourceIds.map((id) => sourceMap.get(id));
    if (
      !sources.some(
        (source) => source && source.featureStatus !== 'Not applicable',
      )
    )
      questionFail(
        'at least one citation must support implementation, not context only.',
      );
    const latestReview = sources.reduce(
      (latest, source) =>
        Math.max(latest, Date.parse(source?.lastReviewedAt ?? '') || 0),
      0,
    );
    if (question.verificationStatus === 'verified' && latestReview) {
      if (Date.parse(question.sourceLastReviewedAt ?? '') > latestReview)
        questionFail(
          'sourceLastReviewedAt must equal the latest cited source review.',
          'verification',
        );
      if (
        Date.parse(question.sourceLastReviewedAt ?? '') < latestReview ||
        Date.parse(question.verifiedAt ?? '') < latestReview
      ) {
        question.verificationStatus = 'stale';
        question.requiresManualReview = true;
        findings.push({
          code: 'source-updated',
          category: 'verification',
          severity: 'warning',
          questionIds: [question.id],
          message: `${question.id}: cited source review changed after the reviewed snapshot; independently re-review.`,
        });
      }
    }
  }
  findings.push(...duplicateFindings(allQuestions));
  const blocked = new Set(
    findings
      .filter((finding) => finding.severity !== 'warning')
      .flatMap((finding) => finding.questionIds),
  );
  const globalError = findings.some(
    (finding) => finding.severity === 'error' && !finding.questionIds.length,
  );
  const questions = allQuestions.filter(
    (question) =>
      !globalError && !blocked.has(question.id) && isPlayableQuestion(question),
  );
  return {
    questions,
    allQuestions,
    manifest,
    taxonomy,
    findings,
    totalRecords: records.length,
    totalSourceRecords: envelope.sources.length,
  };
}

export function validateContent(
  questionData: unknown,
  manifestData: unknown,
  taxonomyData: unknown,
  sourcePolicy?: SourcePolicyContext,
) {
  const content = inspectContent(
    questionData,
    manifestData,
    taxonomyData,
    sourcePolicy,
  );
  const verifiedIds = new Set(
    content.allQuestions
      .filter((q) => q.verificationStatus === 'verified')
      .map((q) => q.id),
  );
  const failures = content.findings.filter(
    (finding) =>
      finding.severity === 'error' ||
      (finding.severity === 'blocking' &&
        finding.questionIds.some((id) => verifiedIds.has(id))),
  );
  if (failures.length)
    throw new Error(failures.map((finding) => finding.message).join('\n'));
  return content;
}
