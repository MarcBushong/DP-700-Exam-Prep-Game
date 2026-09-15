import { describe, expect, it } from 'vitest';
import {
  validateDungeonPackage,
  type RawDungeonPackage,
} from '../src/features/dungeons/validation';
import { passesRealismRubric } from '../src/features/dungeons/readiness';
import {
  reviewPolicySchema,
  rubricV2Criteria,
  rubricV2Schema,
  credentialSchema,
} from '../src/features/dungeons/schema';
import {
  questionSchema,
  type Question,
} from '../src/features/grounding/schema';
import {
  buildContentReport,
  reportMarkdown,
} from '../src/features/grounding/report';
import { strictFixture } from './dungeon-three-pass-fixtures';
import { dungeonFixture } from './dungeon-fixtures';
import { applyRegistryCollisions } from '../src/features/dungeons/registry';

describe('strict opt-in three-pass review', () => {
  it.each(['beta', 'unverified'] as const)(
    'reports a fully reviewed 150-question %s bank without exposing playable coverage or claiming GA',
    (status) => {
      const { credential, raw } = strictFixture(150);
      credential.status = status;
      credential.contentReadiness = 'validating';
      credential.verifiedQuestionCount = 0;
      const dungeon = validateDungeonPackage(
        {
          ...credential,
          requiredReviewPolicy: raw.packageManifest.reviewPolicy,
        },
        raw,
      );
      const report = buildContentReport(dungeon);
      expect(report.totalQuestions).toBe(150);
      expect(report.statusCounts.verified).toBe(150);
      expect(report.reviewedVerifiedQuestions).toBe(150);
      expect(report.playableVerifiedQuestions).toBe(0);
      expect(report.availability).toMatchObject({
        credentialStatus: status,
        studyEnabled: false,
        gauntletEnabled: false,
        reviewedButUnavailableQuestions: 150,
      });
      expect(report.targets.questionShortfall).toBe(150);
      expect(report.targets.reviewedQuestionShortfall).toBe(0);
      expect(report.threePass?.verifiedShortfall).toBe(0);
      expect(
        Object.values(report.counts.playable.domain).every(
          (count) => count === 0,
        ),
      ).toBe(true);
      expect(
        Object.values(report.counts.reviewed.domain).reduce(
          (sum, count) => sum + count,
          0,
        ),
      ).toBe(150);
      expect(report.coverageGaps).toHaveLength(3);
      expect(report.reviewedCoverageGaps).toEqual([]);
      expect(
        report.reviewQueue.every(
          (record) =>
            record.playabilityExclusion === 'credential-or-mode-gate' &&
            record.reasons.some((reason) => /active map|sealed/i.test(reason)),
        ),
      ).toBe(true);
      const markdown = reportMarkdown(report);
      expect(markdown).toContain(
        'Fully reviewed records before catalog/mode gates: **150**',
      );
      expect(markdown).toContain('Playable verified questions: **0**');
      expect(markdown).toContain(`Recorded credential status: **${status}**`);
      expect(dungeon.credential.verifiedQuestionCount).toBe(0);
      expect(dungeon.credential.status).toBe(status);
    },
  );

  it('preserves independently required catalog policies in credential parsing', () => {
    const { credential, raw } = strictFixture();
    const required = raw.packageManifest.reviewPolicy;
    expect(
      credentialSchema.parse({
        ...credential,
        requiredReviewPolicy: required,
      }).requiredReviewPolicy,
    ).toEqual(required);
    expect(
      credentialSchema.safeParse({
        ...credential,
        requiredReviewPolicy: { ...required, minimumRubricScore: 43 },
      }).success,
    ).toBe(false);
  });

  it.each(['policy', 'validation-metadata', 'source-registry', 'all'] as const)(
    'cannot downgrade catalog-required strict review by removing %s',
    (removed) => {
      const { credential, raw } = strictFixture(25);
      const requiredReviewPolicy = raw.packageManifest.reviewPolicy;
      const declaredCredential = credentialSchema.parse({
        ...credential,
        requiredReviewPolicy,
      });
      const downgraded: RawDungeonPackage = { ...raw };
      if (removed === 'policy' || removed === 'all') {
        const { reviewPolicy: omitted, ...withoutPolicy } = raw.packageManifest;
        expect(omitted).toEqual(requiredReviewPolicy);
        downgraded.packageManifest = withoutPolicy;
      }
      if (removed === 'validation-metadata' || removed === 'all')
        delete downgraded.validationMetadata;
      if (removed === 'source-registry' || removed === 'all')
        delete downgraded.sourceRegistry;
      const before = JSON.stringify(downgraded);
      const dungeon = validateDungeonPackage(declaredCredential, downgraded);
      expect(dungeon.questions).toEqual([]);
      expect(dungeon.reviewedQuestions).toEqual([]);
      expect(dungeon.readiness).toMatchObject({
        study: false,
        gauntlet: false,
      });
      if (removed === 'policy' || removed === 'all')
        expect(
          dungeon.findings.some(
            (finding) =>
              finding.code === 'review-policy-binding' &&
              !finding.questionIds.length &&
              finding.severity === 'error',
          ),
        ).toBe(true);
      if (removed === 'validation-metadata' || removed === 'all')
        expect(
          dungeon.findings.some(
            (finding) => finding.code === 'three-pass-schema',
          ),
        ).toBe(true);
      if (removed === 'source-registry' || removed === 'all')
        expect(
          dungeon.findings.some(
            (finding) => finding.code === 'source-provenance',
          ),
        ).toBe(true);
      const report = buildContentReport(dungeon);
      expect(report.requiredReviewPolicy).toEqual(requiredReviewPolicy);
      expect(report.threePass?.minimumRubricScore).toBe(44);
      expect(JSON.stringify(downgraded)).toBe(before);
    },
  );

  it.each(['minimumRubricScore', 'targetVerified'] as const)(
    'rejects disagreement with catalog-required %s even for otherwise valid strict records',
    (field) => {
      const { credential, raw } = strictFixture(25);
      const requiredReviewPolicy = { ...raw.packageManifest.reviewPolicy };
      raw.packageManifest.reviewPolicy[field] += 1;
      const dungeon = validateDungeonPackage(
        { ...credential, requiredReviewPolicy },
        raw,
      );
      expect(dungeon.questions).toEqual([]);
      expect(
        dungeon.findings.some(
          (finding) => finding.code === 'review-policy-binding',
        ),
      ).toBe(true);
    },
  );

  it('accepts an exactly matching required profile without hard-coding an exam or provider', () => {
    const { credential, raw } = strictFixture(25);
    const dungeon = validateDungeonPackage(
      {
        ...credential,
        requiredReviewPolicy: { ...raw.packageManifest.reviewPolicy },
      },
      raw,
    );
    expect(
      dungeon.findings.filter((finding) => finding.severity !== 'warning'),
    ).toEqual([]);
    expect(dungeon.questions).toHaveLength(25);
  });

  it('excludes globally collided IDs from reviewed target counts without weakening the sealed gate', () => {
    const { credential, raw } = strictFixture(25);
    const dungeon = applyRegistryCollisions(
      validateDungeonPackage(credential, raw),
      [
        {
          questionId: raw.questions[0].id,
          credentialIds: [credential.credentialId, 'other-package'],
        },
      ],
    );
    expect(dungeon.questions).toEqual([]);
    expect(dungeon.reviewedQuestions).toHaveLength(24);
    expect(buildContentReport(dungeon).threePass?.verifiedShortfall).toBe(126);
  });
  it('preserves legacy two-pass rubrics and does not auto-convert them', () => {
    const { credential, raw } = dungeonFixture();
    expect(validateDungeonPackage(credential, raw).findings).toEqual([]);
    const strict = strictFixture();
    strict.raw.encounterMetadata.encounters[strict.raw.questions[0].id].rubric =
      raw.encounterMetadata.encounters.q1.rubric;
    const report = validateDungeonPackage(strict.credential, strict.raw);
    expect(report.reviewedQuestions).toEqual([]);
    expect(report.findings.some((f) => f.code === 'three-pass-rubric')).toBe(
      true,
    );
  });

  it.each([24, 25, 74, 75])(
    'applies existing mode gates to %i complete strict records',
    (count) => {
      const { credential, raw } = strictFixture(count);
      const dungeon = validateDungeonPackage(credential, raw);
      expect(dungeon.findings.filter((f) => f.severity !== 'warning')).toEqual(
        [],
      );
      expect(dungeon.reviewedQuestions).toHaveLength(count);
      expect(dungeon.readiness.study).toBe(count >= 25);
      expect(dungeon.readiness.gauntlet).toBe(count >= 75);
    },
  );

  it('distinguishes reviewed from playable for beta without authorization and exposes all rubric criteria', () => {
    const { credential, raw } = strictFixture(25);
    credential.status = 'beta';
    const dungeon = validateDungeonPackage(credential, raw);
    const report = buildContentReport(dungeon);
    expect(dungeon.readiness.study).toBe(false);
    expect(report.playableVerifiedQuestions).toBe(0);
    expect(report.reviewedVerifiedQuestions).toBe(25);
    expect(report.threePass?.verifiedShortfall).toBe(125);
    expect(Object.keys(report.threePass!.rubricDistribution)).toEqual([
      ...rubricV2Criteria,
    ]);
    expect(
      report.threePass?.stages.every((stage) => !stage.failures.length),
    ).toBe(true);
  });

  it('never bypasses three-pass review when beta gameplay is enabled', () => {
    const { credential, raw } = strictFixture(25);
    credential.status = 'beta';
    credential.allowBetaPlay = true;
    expect(validateDungeonPackage(credential, raw).questions).toHaveLength(25);
    delete raw.validationMetadata.encounters[raw.questions[0].id].technical;
    const blocked = validateDungeonPackage(credential, raw);
    expect(blocked.questions).toEqual([]);
    expect(blocked.readiness).toMatchObject({ study: false, gauntlet: false });
    expect(blocked.reviewedQuestions).toHaveLength(24);
  });

  it.each([
    'missing-technical',
    'missing-adversarial',
    'same-author',
    'same-technical',
    'wrong-technical-key',
    'technical-rejected',
    'adversarial-rejected',
    'equal-review-times',
    'changed-generation-hash',
    'changed-technical-hash',
    'changed-adversarial-hash',
    'missing-option',
    'foreign-source',
    'changed-objective',
    'changed-final-reviewer',
    'old-generation',
  ])(
    'excludes %s without changing production statuses or review objects',
    (condition) => {
      const { credential, raw } = strictFixture();
      const q = raw.questions[0],
        stages = raw.validationMetadata.encounters[q.id];
      switch (condition) {
        case 'missing-technical':
          delete stages.technical;
          break;
        case 'missing-adversarial':
          delete stages.adversarial;
          break;
        case 'same-author':
          stages.adversarial!.reviewerId = stages.generation.authorId;
          break;
        case 'same-technical':
          stages.adversarial!.reviewerId = stages.technical!.review.reviewerId;
          break;
        case 'wrong-technical-key':
          stages.technical!.review.choiceReviews[0].assessment = 'contradicted';
          break;
        case 'technical-rejected':
          stages.technical!.review.verdict = 'rejected';
          break;
        case 'adversarial-rejected':
          stages.adversarial!.verdict = 'rejected';
          break;
        case 'equal-review-times':
          stages.adversarial!.reviewedAt = stages.technical!.review.reviewedAt;
          break;
        case 'changed-generation-hash':
          stages.generation.questionFingerprint = 'a'.repeat(64);
          break;
        case 'changed-technical-hash':
          stages.technical!.review.questionFingerprint = 'a'.repeat(64);
          break;
        case 'changed-adversarial-hash':
          stages.adversarial!.questionFingerprint = 'a'.repeat(64);
          break;
        case 'missing-option':
          stages.adversarial!.optionChallenges.pop();
          break;
        case 'foreign-source':
          stages.adversarial!.optionChallenges[0].sourceIds = ['not-cited'];
          break;
        case 'changed-objective':
          stages.technical!.objectiveFingerprint = 'a'.repeat(64);
          break;
        case 'changed-final-reviewer':
          raw.reviews.reviews[0].reviewerId = 'other-person';
          break;
        case 'old-generation':
          stages.generation.generatedAt = '2026-09-10T00:00:00.000Z';
          break;
      }
      const before = JSON.stringify(raw);
      const dungeon = validateDungeonPackage(credential, raw);
      expect(dungeon.reviewedQuestions).toEqual([]);
      expect(
        dungeon.findings.some((f) => f.code.startsWith('three-pass-')),
      ).toBe(true);
      expect(JSON.stringify(raw)).toBe(before);
    },
  );

  it('invalidates all previous passes after a factual rewrite', () => {
    const { credential, raw } = strictFixture();
    raw.questions[0].answerChoices[0].text +=
      ' with a changed synthetic constraint';
    const dungeon = validateDungeonPackage(credential, raw);
    for (const pass of ['generation', 'technical', 'adversarial'])
      expect(
        dungeon.findings.some((f) => f.code === `three-pass-${pass}`),
      ).toBe(true);
    expect(dungeon.reviewedQuestions).toEqual([]);
  });

  it.each([
    'candidate',
    'rejected',
    'manual-review-required',
    'stale',
  ] as const)(
    'retains a valid %s with no later passes without globally failing reviewed content',
    (status) => {
      const { credential, raw } = strictFixture(26);
      const q = raw.questions[25],
        stages = raw.validationMetadata.encounters[q.id];
      q.verificationStatus = status;
      q.requiresManualReview = true;
      q.verificationNotes = `Synthetic ${status} quarantine reason: no independent later passes have been completed for this unit-test record.`;
      raw.reviews.reviews[25].verdict = status;
      raw.reviews.reviews[25].verificationNotes = q.verificationNotes;
      delete stages.technical;
      delete stages.adversarial;
      raw.encounterMetadata.encounters[q.id].rubric = null;
      const dungeon = validateDungeonPackage(credential, raw);
      expect(dungeon.findings.filter((f) => f.severity !== 'warning')).toEqual(
        [],
      );
      expect(dungeon.questions).toHaveLength(25);
      expect(dungeon.allQuestions).toHaveLength(26);
      expect(buildContentReport(dungeon).statusCounts[status]).toBe(1);
    },
  );

  it('keeps legacy omitted metadata manual and permits explicit candidate status', () => {
    const q = strictFixture().raw.questions[0];
    const legacy = { ...q } as Partial<Question>;
    delete legacy.verificationStatus;
    delete legacy.requiresManualReview;
    expect(questionSchema.parse(legacy).verificationStatus).toBe(
      'manual-review-required',
    );
    expect(
      questionSchema.parse({
        ...q,
        verificationStatus: 'candidate',
        requiresManualReview: true,
      }).verificationStatus,
    ).toBe('candidate');
  });

  it('allows a fully grounded strict package with zero authored questions to remain sealed', () => {
    const { credential, raw } = strictFixture(0);
    const dungeon = validateDungeonPackage(credential, raw);
    expect(dungeon.findings).toEqual([]);
    expect(dungeon.readiness.study).toBe(false);
  });
});

describe('version 2 realism gates', () => {
  it.each(rubricV2Criteria)(
    'scores %s with an actual integer 0–4 schema',
    (criterion) => {
      const { raw } = strictFixture();
      const rubric = rubricV2Schema.parse(
        raw.encounterMetadata.encounters[raw.questions[0].id].rubric,
      );
      rubric.scores[criterion] = 0;
      expect(passesRealismRubric(rubric)).toBe(false);
      rubric.scores[criterion] = 4.1;
      expect(rubricV2Schema.safeParse(rubric).success).toBe(false);
    },
  );

  it.each([
    'accuracy',
    'answerUniqueness',
    'documentationStrength',
    'citationSpecificity',
  ] as const)('requires %s ==4 even above total threshold', (criterion) => {
    const { raw } = strictFixture();
    const rubric = rubricV2Schema.parse(
      raw.encounterMetadata.encounters[raw.questions[0].id].rubric,
    );
    rubric.scores[criterion] = 3;
    expect(passesRealismRubric(rubric)).toBe(false);
  });

  it('enforces 44/48 or higher configured threshold and distractor evidence >=3', () => {
    const { raw } = strictFixture();
    const rubric = rubricV2Schema.parse(
      raw.encounterMetadata.encounters[raw.questions[0].id].rubric,
    );
    rubric.scores.originality = 2;
    rubric.scores.alignment = 3;
    rubric.scores.distractorEvidence = 3;
    expect(passesRealismRubric(rubric, 44)).toBe(true);
    expect(passesRealismRubric(rubric, 45)).toBe(false);
    rubric.scores.distractorEvidence = 2;
    expect(passesRealismRubric(rubric)).toBe(false);
    expect(
      reviewPolicySchema.safeParse({
        ...raw.packageManifest.reviewPolicy,
        minimumRubricScore: 43,
      }).success,
    ).toBe(false);
  });
});
