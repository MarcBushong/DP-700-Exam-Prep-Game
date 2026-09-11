import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { validateDungeonPackage } from '../src/features/dungeons/validation';
import { sha256 } from '../src/features/dungeons/fingerprint';
import { questionFingerprint } from '../src/features/dungeons/review';
import { diffObjectives } from '../src/features/dungeons/lifecycle';
import { packageManifestSchema } from '../src/features/dungeons/schema';
import {
  applyRegistryCollisions,
  findQuestionIdCollisions,
  questionIdsFromRaw,
} from '../src/features/dungeons/registry';
import questions from '../src/content/exams/dp-700/questions.json';
import reviews from '../src/content/exams/dp-700/verification-reviews.json';
import { questionSchema } from '../src/features/grounding/schema';
import { dungeonFixture } from './dungeon-fixtures';

describe('shared package validation and exact fingerprint preservation', () => {
  it('blocks every package sharing an encounter ID, not just selected raid participants', () => {
    const { credential, raw } = dungeonFixture();
    const dungeon = validateDungeonPackage(credential, raw);
    const collisions = findQuestionIdCollisions([
      {
        credentialId: credential.credentialId,
        questionIds: questionIdsFromRaw(raw.questions),
      },
      { credentialId: 'another-unselected-package', questionIds: ['q1'] },
    ]);
    expect(collisions).toEqual([
      {
        questionId: 'q1',
        credentialIds: ['another-unselected-package', 'fixture-dungeon'],
      },
    ]);
    const blocked = applyRegistryCollisions(dungeon, collisions);
    expect(blocked.questions).toEqual([]);
    expect(blocked.readiness).toMatchObject({ study: false, gauntlet: false });
    expect(
      blocked.findings.some(
        (finding) => finding.code === 'cross-dungeon-question-id',
      ),
    ).toBe(true);
    expect(dungeon.findings).toEqual([]);
    expect(
      findQuestionIdCollisions([
        { credentialId: 'one', questionIds: ['same', 'same'] },
      ]),
    ).toEqual([]);
  });
  it.each(['', 'abc', 'π — test 🐉', 'long content '.repeat(250)])(
    'matches Node SHA-256 for %s',
    (input) => {
      expect(sha256(input)).toBe(
        createHash('sha256').update(input).digest('hex'),
      );
    },
  );
  it('preserves every independently authored DP-700 attestation fingerprint', () => {
    for (const question of questions) {
      const review = reviews.reviews.find(
        (item) => item.questionId === question.id,
      )!;
      expect(questionFingerprint(questionSchema.parse(question))).toBe(
        review.questionFingerprint,
      );
    }
  });
  it('accepts consistent test-only evidence without pretending one encounter unlocks study', () => {
    const { credential, raw } = dungeonFixture();
    const before = JSON.stringify(raw);
    const dungeon = validateDungeonPackage(credential, raw);
    expect(dungeon.findings).toEqual([]);
    expect(dungeon.allQuestions[0].verificationStatus).toBe('verified');
    expect(dungeon.questions).toEqual([]);
    expect(dungeon.readiness.study).toBe(false);
    expect(JSON.stringify(raw)).toBe(before);
  });
  it.each([
    'questions',
    'review',
    'evidence',
    'rubric-author',
    'retrieval',
    'validation',
    'credential',
    'type',
  ] as const)('fails closed on changed %s', (change) => {
    const { credential, raw } = dungeonFixture();
    const metadata = raw.encounterMetadata.encounters.q1;
    if (change === 'questions')
      raw.questions[0].explanation += ' Changed after review.';
    if (change === 'review') raw.reviews.reviews = [];
    if (change === 'evidence')
      metadata.distractorEvidence[0].summary += ' Unsupported addition.';
    if (change === 'rubric-author')
      metadata.rubric!.reviewerId = 'fixture-author';
    if (change === 'retrieval')
      metadata.retrievedAt = '2026-09-11T16:04:00.000Z';
    if (change === 'validation')
      metadata.lastValidatedAt = '2026-09-11T16:04:00.000Z';
    if (change === 'credential') metadata.credentialId = 'another-dungeon';
    if (change === 'type') credential.supportedQuestionTypes = [];
    const dungeon = validateDungeonPackage(credential, raw);
    expect(
      dungeon.findings.some((finding) => finding.severity === 'error'),
    ).toBe(true);
    expect(dungeon.questions).toEqual([]);
  });
  it('retains absent or below-threshold rubrics as excluded manual-review candidates', () => {
    const { credential, raw } = dungeonFixture();
    raw.encounterMetadata.encounters.q1.rubric = null;
    expect(
      validateDungeonPackage(credential, raw).allQuestions[0]
        .verificationStatus,
    ).toBe('manual-review-required');
    delete raw.encounterMetadata.encounters.q1;
    expect(
      validateDungeonPackage(credential, raw).allQuestions[0]
        .verificationStatus,
    ).toBe('manual-review-required');
  });
  it('marks old objective envelopes stale without rewriting historic facts or source reviews', () => {
    const { credential, raw } = dungeonFixture();
    raw.encounterMetadata.encounters.q1.objectiveVersion =
      'Previous fixture version';
    const dungeon = validateDungeonPackage(credential, raw);
    expect(dungeon.allQuestions[0].verificationStatus).toBe('stale');
    expect(raw.questions[0].verificationStatus).toBe('verified');
    expect(
      dungeon.findings.some((finding) => finding.code === 'objective-updated'),
    ).toBe(true);
  });
  it('excludes source snapshots after newer source reviews', () => {
    const { credential, raw } = dungeonFixture();
    raw.manifest.sources[0].lastReviewedAt = '2026-09-11T16:10:00.000Z';
    expect(
      validateDungeonPackage(credential, raw).allQuestions[0]
        .verificationStatus,
    ).toBe('stale');
  });
  it('reports objective changes without mutating either taxonomy', () => {
    const { raw } = dungeonFixture();
    const next = structuredClone(raw.taxonomy);
    next.studyGuideEffectiveDate = 'Next synthetic version';
    next.domains[0].skills[0].subskills = ['Changed fixture objective'];
    const diff = diffObjectives(raw.taxonomy, next, raw.questions);
    expect(diff.versionChanged).toBe(true);
    expect(diff.affectedQuestionIds).toEqual(['q1']);
    expect(diff.added).toHaveLength(1);
    expect(diff.removed).toHaveLength(1);
    expect(raw.taxonomy.domains[0].skills[0].subskills).toEqual(['Access']);
  });
  it('refuses thresholds that weaken the product quality floor', () => {
    const { raw } = dungeonFixture();
    for (const thresholds of [
      { studyMinimum: 1 },
      { gauntletMinimum: 25 },
      { rubricMinimum: 17 },
    ])
      expect(
        packageManifestSchema.safeParse({
          ...raw.packageManifest,
          readinessThresholds: thresholds,
        }).success,
      ).toBe(false);
  });
});
