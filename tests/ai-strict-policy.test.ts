import { describe, expect, it } from 'vitest';
import { objectiveFingerprint } from '../src/features/dungeons/review';
import { validateDungeonPackage } from '../src/features/dungeons/validation';
import type { Credential } from '../src/features/dungeons/schema';
import { strictFixture } from './dungeon-three-pass-fixtures';

const aiIds = ['ai-103', 'ai-200'] as const;

// Rebind synthetic fixtures only; these are not production reviews or sources.
function aiFixture(id: (typeof aiIds)[number], count = 25) {
  const fixture = strictFixture(count);
  const { raw } = fixture;
  const guide = `https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/${id}`;
  const credential: Credential = {
    ...fixture.credential,
    credentialId: id,
    examCode: id.toUpperCase(),
    provider: 'Microsoft',
    requiredReviewPolicy: raw.packageManifest.reviewPolicy,
    officialUrls: {
      ...fixture.credential.officialUrls,
      studyGuide: guide,
    },
  };
  raw.packageManifest.credentialId = id;
  raw.taxonomy.studyGuideUrl = guide;
  raw.sourceRegistry.examCode = credential.examCode!;
  for (const source of raw.sourceRegistry.sources) {
    source.examCode = credential.examCode!;
    if (source.sourceClass === 'guide') source.canonicalUrl = guide;
  }
  const hash = objectiveFingerprint(raw.taxonomy);
  for (const envelope of Object.values(raw.encounterMetadata.encounters)) {
    envelope.credentialId = id;
    envelope.rubric!.objectiveFingerprint = hash;
  }
  for (const stages of Object.values(raw.validationMetadata.encounters)) {
    stages.generation.objectiveFingerprint = hash;
    stages.technical!.objectiveFingerprint = hash;
    stages.adversarial!.objectiveFingerprint = hash;
  }
  return { credential, raw };
}

describe.each(aiIds)('%s strict review policy', (id) => {
  it.each([24, 25, 74, 75])(
    'retains ordinary mode thresholds for %i independently reviewed fixtures',
    (count) => {
      const { credential, raw } = aiFixture(id, count);
      const dungeon = validateDungeonPackage(credential, raw);
      expect(dungeon.findings.filter((f) => f.severity !== 'warning')).toEqual(
        [],
      );
      expect(dungeon.reviewedQuestions).toHaveLength(count);
      expect(dungeon.readiness.study).toBe(count >= 25);
      expect(dungeon.readiness.gauntlet).toBe(count >= 75);
    },
  );

  it('cannot remove the package policy to fall back to legacy review', () => {
    const { credential, raw } = aiFixture(id);
    const { reviewPolicy, ...manifest } = raw.packageManifest;
    expect(reviewPolicy).toEqual(credential.requiredReviewPolicy);
    const dungeon = validateDungeonPackage(credential, {
      ...raw,
      packageManifest: manifest,
    });
    expect(dungeon.questions).toEqual([]);
    expect(
      dungeon.findings.some((f) => f.code === 'review-policy-binding'),
    ).toBe(true);
  });

  it.each([
    'candidate',
    'manual-review-required',
    'rejected',
    'stale',
  ] as const)('excludes %s records from available coverage', (status) => {
    const { credential, raw } = aiFixture(id);
    raw.questions[0].verificationStatus = status;
    raw.questions[0].requiresManualReview = true;
    raw.reviews.reviews[0].verdict = status;
    const dungeon = validateDungeonPackage(credential, raw);
    expect(dungeon.reviewedQuestions).toHaveLength(24);
    expect(
      dungeon.reviewedQuestions.some((q) => q.id === raw.questions[0].id),
    ).toBe(false);
    expect(dungeon.questions).toEqual([]);
  });

  it.each(['technical', 'adversarial', 'counterexample', 'rubric'] as const)(
    'fails closed without a complete %s pass requirement',
    (missing) => {
      const { credential, raw } = aiFixture(id);
      const questionId = raw.questions[0].id;
      const stages = raw.validationMetadata.encounters[questionId];
      if (missing === 'technical') delete stages.technical;
      if (missing === 'adversarial') delete stages.adversarial;
      if (missing === 'counterexample')
        stages.adversarial!.optionChallenges.pop();
      if (missing === 'rubric')
        raw.encounterMetadata.encounters[questionId].rubric = null;
      const dungeon = validateDungeonPackage(credential, raw);
      expect(dungeon.reviewedQuestions.some((q) => q.id === questionId)).toBe(
        false,
      );
      expect(dungeon.questions).toEqual([]);
    },
  );

  it('invalidates verified descendants of an unapproved guide ancestor', () => {
    const { credential, raw } = aiFixture(id);
    raw.sourceRegistry.sources[0].objectiveIds = ['not-in-this-map'];
    const dungeon = validateDungeonPackage(credential, raw);
    expect(dungeon.reviewedQuestions).toEqual([]);
    expect(
      dungeon.findings.some(
        (f) =>
          f.code === 'source-provenance' &&
          f.severity === 'error' &&
          f.questionIds.length === 25,
      ),
    ).toBe(true);
  });

  it('requires current objective content, not a repainted version label', () => {
    const { credential, raw } = aiFixture(id);
    raw.taxonomy.domains[0].skills[0].subskills.push('New synthetic objective');
    const dungeon = validateDungeonPackage(credential, raw);
    expect(dungeon.reviewedQuestions).toEqual([]);
    expect(
      dungeon.findings.some((f) => f.code === 'objective-review-stale'),
    ).toBe(true);
  });

  it('keeps beta AI credentials sealed without an explicit authorization', () => {
    const { credential, raw } = aiFixture(id, 75);
    credential.status = 'beta';
    const dungeon = validateDungeonPackage(credential, raw);
    expect(dungeon.reviewedQuestions).toHaveLength(75);
    expect(dungeon.readiness).toMatchObject({ study: false, gauntlet: false });
    expect(dungeon.questions).toEqual([]);
  });
});
