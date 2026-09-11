import { describe, expect, it } from 'vitest';
import {
  getDungeonReadiness,
  passesRealismRubric,
  type ContentStats,
} from '../src/features/dungeons/readiness';
import { dungeonFixture } from './dungeon-fixtures';

const stats: ContentStats = {
  verifiedQuestionCount: 75,
  majorFloorCount: 3,
  coveredFloorCount: 3,
  skillCount: 10,
  coveredSkillCount: 10,
  bossQuestionCount: 1,
  blockingFailures: [],
  majorGaps: [],
  objectiveVersion: 'July 21, 2026',
  weightingPublished: true,
  weightingAvailable: true,
};
describe('readiness gates are product thresholds, not fabricated exam rules', () => {
  it('distinguishes 25-encounter study from 75-encounter gauntlets', () => {
    const { credential } = dungeonFixture();
    expect(
      getDungeonReadiness(credential, { ...stats, verifiedQuestionCount: 24 })
        .study,
    ).toBe(false);
    expect(
      getDungeonReadiness(credential, { ...stats, verifiedQuestionCount: 25 }),
    ).toMatchObject({ study: true, gauntlet: false });
    expect(getDungeonReadiness(credential, stats)).toEqual({
      study: true,
      gauntlet: true,
      reasons: [],
    });
  });
  it.each([
    'announced',
    'beta',
    'retiring',
    'retired',
    'replaced',
    'unverified',
  ] as const)('seals %s credentials even with large banks', (status) => {
    const { credential } = dungeonFixture();
    expect(
      getDungeonReadiness(
        { ...credential, status },
        { ...stats, verifiedQuestionCount: 1000 },
      ),
    ).toMatchObject({ study: false, gauntlet: false });
  });
  it.each([
    { coveredFloorCount: 2 },
    { majorFloorCount: 0 },
    { blockingFailures: ['Missing independent evidence.'] },
    { objectiveVersion: 'Old guide' },
  ])(
    'requires all floors, current objectives and no blockers: %s',
    (change) => {
      const { credential } = dungeonFixture();
      expect(
        getDungeonReadiness(credential, { ...stats, ...change }).study,
      ).toBe(false);
    },
  );
  it.each([
    { coveredSkillCount: 9 },
    { bossQuestionCount: 0 },
    { majorGaps: ['A major skill has no variation.'] },
    { weightingAvailable: false },
  ])(
    'keeps study available while gauntlet breadth is insufficient: %s',
    (change) => {
      const { credential } = dungeonFixture();
      expect(
        getDungeonReadiness(credential, { ...stats, ...change }),
      ).toMatchObject({ study: true, gauntlet: false });
    },
  );
  it('allows genuinely unpublished weighting without inventing it', () => {
    const { credential } = dungeonFixture();
    expect(
      getDungeonReadiness(credential, {
        ...stats,
        weightingPublished: false,
        weightingAvailable: false,
      }).gauntlet,
    ).toBe(true);
  });
  it('rejects every closed catalog state and missing identity verification', () => {
    const { credential } = dungeonFixture();
    for (const contentReadiness of [
      'unavailable',
      'validating',
      'stale',
    ] as const)
      expect(
        getDungeonReadiness({ ...credential, contentReadiness }, stats).study,
      ).toBe(false);
    expect(
      getDungeonReadiness({ ...credential, isVerified: false }, stats).study,
    ).toBe(false);
  });
  it('requires 18/20, no zero, and perfect accuracy, uniqueness, documentation scores', () => {
    const rubric = dungeonFixture().raw.encounterMetadata.encounters.q1.rubric!;
    expect(passesRealismRubric(rubric)).toBe(true);
    rubric.scores.clarityAccessibility = 1;
    rubric.scores.difficultyAuthenticity = 1;
    expect(passesRealismRubric(rubric)).toBe(true);
    rubric.scores.originality = 1;
    expect(passesRealismRubric(rubric)).toBe(false);
    for (const key of [
      'accuracy',
      'answerUniqueness',
      'documentationStrength',
    ] as const) {
      const changed =
        dungeonFixture().raw.encounterMetadata.encounters.q1.rubric!;
      changed.scores[key] = 1;
      expect(passesRealismRubric(changed)).toBe(false);
    }
    const zero = dungeonFixture().raw.encounterMetadata.encounters.q1.rubric!;
    zero.scores.distractorPlausibility = 0;
    expect(passesRealismRubric(zero)).toBe(false);
  });
});
