import {
  complexities,
  difficulties,
  formats,
  verificationStatuses,
  type Question,
  type inspectContent,
} from './schema';
import { qualityFindings } from './quality';
import type { DungeonPackage } from '../dungeons/validation';
import { rubricV2Criteria } from '../dungeons/schema';
import { threePassEncounterSchema } from '../dungeons/threePass';

type InspectedContent = ReturnType<typeof inspectContent> &
  Partial<
    Pick<
      DungeonPackage,
      | 'reviewedQuestions'
      | 'packageManifest'
      | 'readiness'
      | 'encounterMetadata'
      | 'validationMetadata'
      | 'credential'
    >
  >;

function countBy(
  questions: Question[],
  key: keyof Question,
  values: string[] = [],
) {
  const counts: Record<string, number> = Object.fromEntries(
    values.map((value) => [value, 0]),
  );
  for (const question of questions) {
    const value = String(question[key]);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function countsFor(
  questions: Question[],
  { taxonomy, manifest }: InspectedContent,
) {
  const counts = {
    domain: countBy(
      questions,
      'objectiveDomain',
      taxonomy.domains.map((d) => d.id),
    ),
    skill: countBy(
      questions,
      'skill',
      taxonomy.domains.flatMap((d) => d.skills.map((s) => s.id)),
    ),
    subskill: countBy(
      questions,
      'subskill',
      taxonomy.domains.flatMap((d) => d.skills.flatMap((s) => s.subskills)),
    ),
    difficulty: countBy(questions, 'difficulty', [...difficulties]),
    complexity: countBy(questions, 'complexity', [...complexities]),
    type: countBy(questions, 'questionType', [...formats]),
    source: Object.fromEntries(
      manifest.sources.map((source) => [source.sourceId, 0]),
    ),
  };
  for (const question of questions)
    for (const source of question.sourceIds)
      counts.source[source] = (counts.source[source] ?? 0) + 1;
  return counts;
}

function range(values: (string | undefined)[]) {
  const sorted = values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  return { oldest: sorted[0] ?? null, latest: sorted.at(-1) ?? null };
}

export function buildContentReport(
  content: InspectedContent,
  generatedAt = new Date().toISOString(),
  targets = { matureBankTarget: 150, advancedExpertTarget: 0.4 },
) {
  const { questions, allQuestions, taxonomy, manifest } = content;
  const playableCounts = countsFor(questions, content);
  const findings = [...content.findings, ...qualityFindings(allQuestions)];
  const gapsFor = (pool: Question[]) =>
    taxonomy.domains.flatMap((domain) =>
      domain.skills.flatMap((skill) =>
        skill.subskills
          .filter(
            (subskill) =>
              !pool.some(
                (question) =>
                  question.objectiveDomain === domain.id &&
                  question.skill === skill.id &&
                  question.subskill === subskill,
              ),
          )
          .map((subskill) => ({
            domainId: domain.id,
            domain: domain.title,
            skillId: skill.id,
            skill: skill.title,
            subskill,
          })),
      ),
    );
  const gaps = gapsFor(questions);
  const positions: Record<string, number> = {};
  for (const q of questions)
    for (const answer of q.correctAnswer) {
      const position = String(
        q.answerChoices.findIndex((choice) => choice.id === answer) + 1,
      );
      positions[position] = (positions[position] ?? 0) + 1;
    }
  const advancedExpert =
    playableCounts.difficulty.advanced + playableCounts.difficulty.expert;
  const reviewed = content.reviewedQuestions ?? [];
  const reviewedIds = new Set(reviewed.map((q) => q.id));
  const playableIds = new Set(questions.map((q) => q.id));
  const reviewedCounts = countsFor(reviewed, content);
  const policy =
    content.credential?.requiredReviewPolicy ??
    content.packageManifest?.reviewPolicy;
  const stageRecords = content.validationMetadata as
    { encounters?: Record<string, unknown> } | undefined;
  const stages = allQuestions.map((q) => {
    const parsed = threePassEncounterSchema.safeParse(
      stageRecords?.encounters?.[q.id],
    );
    return {
      questionId: q.id,
      generationRecorded: parsed.success,
      technicalVerdict: parsed.success
        ? (parsed.data.technical?.review.verdict ?? null)
        : null,
      adversarialVerdict: parsed.success
        ? (parsed.data.adversarial?.verdict ?? null)
        : null,
      failures: findings
        .filter(
          (f) =>
            f.questionIds.includes(q.id) && f.code.startsWith('three-pass-'),
        )
        .map((f) => f.message),
    };
  });
  const rubricRecords = Object.entries(
    content.encounterMetadata?.encounters ?? {},
  ).flatMap(([id, envelope]) =>
    envelope.rubric
      ? [
          {
            questionId: id,
            ...envelope.rubric,
            total: Object.values(envelope.rubric.scores).reduce(
              (sum, score) => sum + score,
              0,
            ),
          },
        ]
      : [],
  );
  return {
    schemaVersion: 1,
    generatedAt,
    disclaimer:
      'Unofficial study aid. Deterministic checks validate structure and recorded attestations, not answer semantics, independent reviewer identity, or current feature behavior.',
    totalQuestions: content.totalRecords,
    validCandidateRecords: allQuestions.length,
    malformedRecords: content.totalRecords - allQuestions.length,
    sourceRecordCounts: {
      total: content.totalSourceRecords,
      valid: manifest.sources.length,
      malformed: content.totalSourceRecords - manifest.sources.length,
    },
    playableVerifiedQuestions: questions.length,
    reviewedVerifiedQuestions: reviewed.length,
    declaredVerifiedQuestions: allQuestions.filter(
      (q) => q.verificationStatus === 'verified',
    ).length,
    readiness: content.readiness ?? null,
    reviewPolicy: policy ?? null,
    requiredReviewPolicy: content.credential?.requiredReviewPolicy ?? null,
    declaredReviewPolicy: content.packageManifest?.reviewPolicy ?? null,
    availability: content.credential
      ? {
          credentialStatus: content.credential.status,
          contentReadiness: content.credential.contentReadiness,
          studyEnabled: content.readiness?.study ?? false,
          gauntletEnabled: content.readiness?.gauntlet ?? false,
          reviewedButUnavailableQuestions: reviewed.filter(
            (q) => !playableIds.has(q.id),
          ).length,
          reasons: content.readiness?.reasons ?? [],
          disclaimer:
            'Reviewed question content does not establish credential GA or active status. An otherwise ready package requires verified active identity or explicit catalog authorization for verified beta study access.',
        }
      : null,
    threePass: policy
      ? {
          targetVerified: policy.targetVerified,
          verifiedShortfall: Math.max(
            0,
            policy.targetVerified - reviewed.length,
          ),
          minimumRubricScore: policy.minimumRubricScore,
          maximumRubricScore: 48,
          stages,
          provenanceViolations: findings.filter(
            (f) => f.code === 'source-provenance',
          ),
          rubricDistribution: Object.fromEntries(
            rubricV2Criteria.map((criterion) => [
              criterion,
              Object.fromEntries(
                [0, 1, 2, 3, 4].map((score) => [
                  score,
                  rubricRecords.filter(
                    (rubric) =>
                      rubric.version === 2 &&
                      rubric.scores[criterion] === score,
                  ).length,
                ]),
              ),
            ]),
          ),
          rubricRecords,
          disclaimer:
            'Recorded pass outputs and source receipts are checked structurally. Actual source meaning, reviewer independence and counterexamples require separate human/model review contexts.',
        }
      : null,
    excludedQuestionIds: allQuestions
      .filter((q) => !questions.some((p) => p.id === q.id))
      .map((q) => q.id),
    statusCounts: countBy(allQuestions, 'verificationStatus', [
      ...verificationStatuses,
    ]),
    counts: {
      playable: playableCounts,
      allCandidates: countsFor(allQuestions, content),
      reviewed: reviewedCounts,
    },
    targets: {
      minimumPlayableQuestions: targets.matureBankTarget,
      actualPlayableQuestions: questions.length,
      questionShortfall: Math.max(
        0,
        targets.matureBankTarget - questions.length,
      ),
      verifiedContentTarget: policy?.targetVerified ?? targets.matureBankTarget,
      actualReviewedVerifiedQuestions: reviewed.length,
      reviewedQuestionShortfall: Math.max(
        0,
        (policy?.targetVerified ?? targets.matureBankTarget) - reviewed.length,
      ),
      minimumAdvancedExpertShare: targets.advancedExpertTarget,
      actualAdvancedExpertShare: questions.length
        ? advancedExpert / questions.length
        : 0,
      meetsAdvancedExpertTarget:
        questions.length > 0 &&
        advancedExpert / questions.length >= targets.advancedExpertTarget,
    },
    taxonomy: {
      studyGuideUrl: taxonomy.studyGuideUrl,
      effectiveDate: taxonomy.studyGuideEffectiveDate,
      retrievedAt: taxonomy.retrievedAt,
      domains: taxonomy.domains.map((domain) => ({
        id: domain.id,
        title: domain.title,
        weightRange: domain.weightRange,
        playableQuestions: playableCounts.domain[domain.id],
        playableShare: questions.length
          ? playableCounts.domain[domain.id] / questions.length
          : 0,
        reviewedQuestions: reviewedCounts.domain[domain.id],
      })),
      skillCount: taxonomy.domains.flatMap((d) => d.skills).length,
      subskillCount: taxonomy.domains.flatMap((d) =>
        d.skills.flatMap((s) => s.subskills),
      ).length,
    },
    coverageGaps: gaps,
    reviewedCoverageGaps: gapsFor(reviewed),
    multipleCitations: {
      playable: questions
        .filter((q) => q.sourceIds.length > 1)
        .map((q) => q.id),
      allCandidates: allQuestions
        .filter((q) => q.sourceIds.length > 1)
        .map((q) => q.id),
    },
    answerPositionDistribution: positions,
    allCandidateAnswerPositions: Object.fromEntries(
      [1, 2, 3, 4, 5, 6].map((position) => [
        position,
        allQuestions.filter((q) =>
          q.correctAnswer.includes(q.answerChoices[position - 1]?.id),
        ).length,
      ]),
    ),
    appliedReasoning: {
      playable: questions.filter((q) => q.complexity !== 'concept-recall')
        .length,
      reviewed: reviewed.filter((q) => q.complexity !== 'concept-recall')
        .length,
      reviewedShare: reviewed.length
        ? reviewed.filter((q) => q.complexity !== 'concept-recall').length /
          reviewed.length
        : 0,
      targetShare: policy ? 0.4 : null,
    },
    conceptReuse: Object.fromEntries(
      [...new Set(allQuestions.map((q) => q.conceptId))]
        .filter(Boolean)
        .map((concept) => [
          concept,
          allQuestions.filter((q) => q.conceptId === concept).map((q) => q.id),
        ]),
    ),
    findingCounts: {
      errors: findings.filter((f) => f.severity === 'error').length,
      blocking: findings.filter((f) => f.severity === 'blocking').length,
      warnings: findings.filter((f) => f.severity === 'warning').length,
      citation: findings.filter((f) => f.category === 'citation').length,
      duplicate: findings.filter((f) => f.category === 'duplicate').length,
      quality: findings.filter((f) => f.category === 'quality').length,
    },
    findings,
    freshness: {
      retrievalMethod: manifest.retrievalMethod,
      policy:
        'Change-driven: any newer cited source review invalidates the question snapshot. No calendar-based expiry; re-retrieve and independently review after documentation/taxonomy changes. Fresh is relative to checked-in evidence, not a claim of perpetual correctness.',
      lastGroundedAt: manifest.lastGroundedAt,
      sourceRetrieval: range(manifest.sources.map((s) => s.retrievedAt)),
      sourceReview: range(manifest.sources.map((s) => s.lastReviewedAt)),
      questionValidation: range(allQuestions.map((q) => q.lastValidatedAt)),
      questionVerification: range(allQuestions.map((q) => q.verifiedAt)),
      playableVerification: range(questions.map((q) => q.verifiedAt)),
    },
    sources: manifest.sources.map((source) => ({
      ...source,
      playableQuestions: playableCounts.source[source.sourceId],
      reviewedQuestions: reviewedCounts.source[source.sourceId],
      candidateQuestions: allQuestions.filter((q) =>
        q.sourceIds.includes(source.sourceId),
      ).length,
    })),
    reviewQueue: allQuestions
      .filter(
        (q) =>
          !questions.some((p) => p.id === q.id) ||
          findings.some((f) => f.questionIds.includes(q.id)),
      )
      .map((q) => ({
        id: q.id,
        conceptId: q.conceptId,
        verificationStatus: q.verificationStatus,
        requiresManualReview: q.requiresManualReview,
        verifiedAt: q.verifiedAt ?? null,
        verifiedAgainstSourceIds: q.verifiedAgainstSourceIds,
        verificationNotes: q.verificationNotes,
        confidenceReason: q.confidenceReason,
        sourceLastReviewedAt: q.sourceLastReviewedAt ?? null,
        findingCodes: findings
          .filter((f) => f.questionIds.includes(q.id))
          .map((f) => f.code),
        playabilityExclusion: playableIds.has(q.id)
          ? 'not-excluded'
          : reviewedIds.has(q.id)
            ? 'credential-or-mode-gate'
            : 'content-review',
        reasons: [
          ...findings
            .filter((f) => f.questionIds.includes(q.id))
            .map((f) => f.message),
          ...(reviewedIds.has(q.id) && !playableIds.has(q.id)
            ? (content.readiness?.reasons ?? [])
            : []),
        ],
      })),
  };
}

export type ContentReport = ReturnType<typeof buildContentReport>;

const cell = (value: unknown) =>
  String(value)
    .replace(/\|/g, '\\|')
    .replace(/[\r\n]+/g, ' ');
const table = (heading: string, counts: Record<string, number>) => [
  `## ${heading}`,
  '',
  '| Category | Questions |',
  '| --- | ---: |',
  ...Object.entries(counts).map(
    ([label, count]) => `| ${cell(label)} | ${count} |`,
  ),
  '',
];

export function reportMarkdown(report: ContentReport): string {
  return [
    '# Question-bank review and coverage',
    '',
    report.disclaimer,
    '',
    `Report created: ${report.generatedAt}. This is not a retrieval or verification timestamp.`,
    '',
    `- Total candidate records: **${report.totalQuestions}**; malformed: **${report.malformedRecords}**.`,
    `- Playable verified questions: **${report.playableVerifiedQuestions}**. Playable coverage below counts only these questions.`,
    `- Fully reviewed records before catalog/mode gates: **${report.reviewedVerifiedQuestions}**. A sealed credential still has zero playable encounters; beta study requires explicit catalog authorization.`,
    ...(report.threePass
      ? [
          `- Three-pass target: ${report.threePass.targetVerified} verified; shortfall ${report.threePass.verifiedShortfall}. Rubric minimum ${report.threePass.minimumRubricScore}/48; no automatic conversion from legacy scores.`,
          `- Source provenance violations: ${report.threePass.provenanceViolations.length}. Source meaning and reviewer independence are not proven by receipts.`,
        ]
      : []),
    `- Playable coverage shortfall: ${report.targets.questionShortfall}; playable Advanced/Expert share: ${(report.targets.actualAdvancedExpertShare * 100).toFixed(1)}% (target >=${report.targets.minimumAdvancedExpertShare * 100}%). This is not an authored-content count.`,
    ...(report.availability
      ? [
          `- Recorded credential status: **${report.availability.credentialStatus}**; Study Run **${report.availability.studyEnabled ? 'enabled' : 'locked'}**; Boss Gauntlet **${report.availability.gauntletEnabled ? 'enabled' : 'locked'}**.`,
          `- Fully reviewed content target: ${report.targets.verifiedContentTarget}; reviewed shortfall: ${report.targets.reviewedQuestionShortfall}; reviewed but unavailable: ${report.availability.reviewedButUnavailableQuestions}.`,
          ...report.availability.reasons.map(
            (reason) => `- Availability: ${reason}`,
          ),
        ]
      : []),
    `- Taxonomy: ${report.taxonomy.domains.length} domains, ${report.taxonomy.skillCount} skills, ${report.taxonomy.subskillCount} subskills.`,
    `- Study guide effective date: **${report.taxonomy.effectiveDate}**; retrieved: ${report.taxonomy.retrievedAt}.`,
    `- Last grounded through ${report.freshness.retrievalMethod}: ${report.freshness.lastGroundedAt}.`,
    `- Last recorded verification: ${report.freshness.questionVerification.latest ?? 'None'}; last playable verification: ${report.freshness.playableVerification.latest ?? 'None'}.`,
    `- Source retrieval range: ${report.freshness.sourceRetrieval.oldest} to ${report.freshness.sourceRetrieval.latest}.`,
    `- Source review range: ${report.freshness.sourceReview.oldest} to ${report.freshness.sourceReview.latest}.`,
    `- Source records: ${report.sourceRecordCounts.valid} valid / ${report.sourceRecordCounts.total} total; malformed: ${report.sourceRecordCounts.malformed}.`,
    `- Multiple citations: ${report.multipleCitations.playable.length} playable / ${report.multipleCitations.allCandidates.length} candidates.`,
    `- Citation errors: ${report.findingCounts.citation}; duplicate findings: ${report.findingCounts.duplicate}; quality warnings: ${report.findingCounts.quality}.`,
    '',
    ...table(
      'Verification status (effective, schema-valid candidates)',
      report.statusCounts,
    ),
    ...Object.entries(report.counts.playable).flatMap(([key, counts]) =>
      table(`Playable ${key} counts`, counts),
    ),
    ...(report.availability
      ? Object.entries(report.counts.reviewed).flatMap(([key, counts]) =>
          table(`Reviewed ${key} counts (not a claim of availability)`, counts),
        )
      : []),
    '## Published domain weighting',
    '',
    ...report.taxonomy.domains.map(
      (d) =>
        `- ${d.title}: guide ${d.weightRange ? `${d.weightRange.join('–')}%` : 'weighting not published'}; available bank ${(d.playableShare * 100).toFixed(1)}% (${d.playableQuestions} playable; ${d.reviewedQuestions} fully reviewed).`,
    ),
    '',
    ...table(
      'Correct-answer positions (before gameplay shuffling; each multi-select key counted)',
      report.answerPositionDistribution,
    ),
    '## Uncovered subskills (playable coverage only)',
    '',
    ...(report.coverageGaps.length
      ? report.coverageGaps.map(
          (gap) => `- **${gap.domain} / ${gap.skill}** — ${gap.subskill}`,
        )
      : ['None. Sampling is not proof of complete depth.']),
    ...(report.availability
      ? [
          '',
          '## Uncovered reviewed subskills (before availability gates)',
          '',
          ...(report.reviewedCoverageGaps.length
            ? report.reviewedCoverageGaps.map(
                (gap) => `- **${gap.domain} / ${gap.skill}** — ${gap.subskill}`,
              )
            : [
                'None. Reviewed coverage does not establish credential availability or GA.',
              ]),
        ]
      : []),
    '',
    '## Duplicate, quality, citation, and verification findings',
    '',
    ...(report.findings.length
      ? report.findings.map(
          (finding) =>
            `- **${finding.severity} / ${finding.code}** [${finding.questionIds.join(', ') || 'bank'}]: ${finding.message}`,
        )
      : ['None.']),
    '',
    '## Review queue',
    '',
    'Verified entries marked credential-or-mode-gate are reviewed but unavailable, not missing authored content.',
    ...(report.reviewQueue.length
      ? report.reviewQueue.map(
          (q) =>
            `- **${q.id}** (${q.verificationStatus}; ${q.playabilityExclusion}): ${q.findingCodes.join(', ') || 'no content finding'}. Review notes: ${q.verificationNotes || 'Missing'}.`,
        )
      : ['None.']),
    '',
    '## Sources and actual evidence dates',
    '',
    '| Source | Playable / reviewed / candidates | Retrieved | Reviewed | Supporting summary |',
    '| --- | ---: | --- | --- | --- |',
    ...report.sources.map(
      (source) =>
        `| ${cell(source.sourceId)}: [${cell(source.title)}](${source.url}) | ${source.playableQuestions} / ${source.reviewedQuestions} / ${source.candidateQuestions} | ${source.retrievedAt} | ${source.lastReviewedAt} | ${cell(source.shortSummary)} |`,
    ),
    '',
    '## Freshness and review limitations',
    '',
    report.freshness.policy,
    '',
    'Blocking deterministic duplicates must be removed or revised before verification. Lexical, same-concept, and quality warnings require editorial judgment; they neither prove semantic duplication nor establish that distractors are plausible.',
    'URL reachability is a separate bounded network check (`npm run validate:sources -- --online`), not answer verification. Code examples are not executed against a Fabric tenant by these tools.',
    '',
  ].join('\n');
}
