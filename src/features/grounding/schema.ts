import { z } from 'zod';

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

const text = z.string().trim().min(1);
export const timestampSchema = z.iso.datetime();
export const learnUrlSchema = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'learn.microsoft.com' &&
      !url.username &&
      !url.password &&
      !url.port &&
      /^\/en-us\/(fabric|azure|kusto|sql|training|credentials)\//.test(
        url.pathname,
      ) &&
      !url.pathname.includes('/search') &&
      !url.search
    );
  } catch {
    return false;
  }
}, 'Use a direct HTTPS English Microsoft Learn documentation URL, not a search URL.');

export const taxonomySchema = z.object({
  schemaVersion: z.literal(1),
  retrievedAt: timestampSchema,
  studyGuideEffectiveDate: text,
  studyGuideUrl: learnUrlSchema,
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
          ),
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
  url: learnUrlSchema,
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
  retrievalMethod: z.literal('Microsoft Learn MCP'),
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
    sourceUrls: z.array(learnUrlSchema).min(1),
    documentationTitles: z.array(text).min(1),
    generatedAt: timestampSchema,
    lastValidatedAt: timestampSchema,
    featureStatus: z.enum(['GA', 'Preview']),
    tags: z.array(text).min(1),
    codeLanguage: z
      .enum(['sql', 'python', 'kusto', 'json', 'powershell'])
      .optional(),
    codeSnippet: text.optional(),
  })
  .superRefine((q, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    const choices = q.answerChoices.map((choice) => choice.id);
    if (new Set(choices).size !== choices.length)
      fail('Answer choice IDs must be unique.');
    if (
      new Set(q.answerChoices.map((choice) => choice.text.toLowerCase()))
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
  });

export type Question = z.infer<typeof questionSchema>;
export type Taxonomy = z.infer<typeof taxonomySchema>;
export type Source = z.infer<typeof sourceSchema>;
export type GroundingManifest = z.infer<typeof manifestSchema>;

export function normalizedQuestion(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function nearDuplicates(questions: Question[]) {
  const pairs: [string, string][] = [];
  const words = questions.map(
    (q) =>
      new Set(
        normalizedQuestion(q.question)
          .split(' ')
          .filter((word) => word.length > 3),
      ),
  );
  for (let i = 0; i < questions.length; i++) {
    for (let j = i + 1; j < questions.length; j++) {
      const intersection = [...words[i]].filter((word) =>
        words[j].has(word),
      ).length;
      const union = new Set([...words[i], ...words[j]]).size;
      if (union && intersection / union >= 0.8)
        pairs.push([questions[i].id, questions[j].id]);
    }
  }
  return pairs;
}

export function validateContent(
  questionData: unknown,
  manifestData: unknown,
  taxonomyData: unknown,
) {
  const taxonomy = taxonomySchema.parse(taxonomyData);
  const manifest = manifestSchema.parse(manifestData);
  const questions = z.array(questionSchema).min(1).parse(questionData);
  const fail = (message: string): never => {
    throw new Error(message);
  };
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
    questions.map((q) => q.id),
    'question ID',
  );
  unique(
    questions.map((q) => normalizedQuestion(q.question)),
    'question text',
  );
  for (const source of manifest.sources) {
    if (Date.parse(source.lastReviewedAt) < Date.parse(source.retrievedAt))
      fail(`${source.sourceId}: review cannot predate retrieval.`);
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
  for (const question of questions) {
    const domain = taxonomy.domains.find(
      (d) => d.id === question.objectiveDomain,
    );
    const skill = domain?.skills.find((s) => s.id === question.skill);
    if (!domain || !skill?.subskills.includes(question.subskill))
      fail(`${question.id}: unknown domain, skill, or subskill.`);
    if (Date.parse(question.lastValidatedAt) < Date.parse(question.generatedAt))
      fail(`${question.id}: validation cannot predate generation.`);
    if (
      !question.sourceUrls.some(
        (url) =>
          !url.includes('/credentials/') && !url.includes('/training/courses/'),
      )
    )
      fail(
        `${question.id}: cite direct supporting product or training-module documentation, not only exam overview pages.`,
      );
    question.sourceIds.forEach((id, i) => {
      const source = sourceMap.get(id);
      if (!source) return fail(`${question.id}: unknown citation ${id}.`);
      if (
        source.url !== question.sourceUrls[i] ||
        source.title !== question.documentationTitles[i]
      )
        fail(`${question.id}: citation metadata does not match ${id}.`);
      if (
        !source.applicableObjectiveDomains.includes(question.objectiveDomain) ||
        !source.applicableSkills.includes(question.skill)
      )
        fail(`${question.id}: citation is not aligned to its objective.`);
      if (
        source.featureStatus === 'Preview' &&
        question.featureStatus !== 'Preview'
      )
        fail(`${question.id}: preview feature must be labelled.`);
    });
  }
  if (nearDuplicates(questions).length)
    fail(
      `Near-duplicate questions: ${JSON.stringify(nearDuplicates(questions))}`,
    );
  return { questions, manifest, taxonomy };
}
