import { describe, expect, it } from 'vitest';
import { questionFingerprint } from '../src/features/dungeons/review';
import { validateDungeonPackage } from '../src/features/dungeons/validation';
import { strictFixture } from './dungeon-three-pass-fixtures';

function syntheticMix(appliedCount: number, advancedCount: number) {
  const fixture = strictFixture(100);
  fixture.raw.questions.forEach((question, index) => {
    question.complexity =
      index < appliedCount ? 'scenario-based' : 'concept-recall';
    question.difficulty = index < advancedCount ? 'advanced' : 'intermediate';
    const hash = questionFingerprint(question);
    const stages = fixture.raw.validationMetadata.encounters[question.id];
    stages.generation.questionFingerprint = hash;
    stages.technical!.review.questionFingerprint = hash;
    stages.adversarial!.questionFingerprint = hash;
    fixture.raw.encounterMetadata.encounters[question.id].questionFingerprint =
      hash;
    fixture.raw.reviews.reviews[index].questionFingerprint = hash;
  });
  return fixture;
}

describe('strict GitHub applied-reasoning readiness', () => {
  it('measures applied complexity separately from editorial difficulty labels', () => {
    const { credential, raw } = syntheticMix(40, 20);
    const dungeon = validateDungeonPackage(credential, raw);
    expect(
      dungeon.findings.filter((finding) => finding.severity !== 'warning'),
    ).toEqual([]);
    expect(dungeon.readiness.gauntlet).toBe(true);
  });

  it('does not let hard labels compensate for insufficient applied reasoning', () => {
    const { credential, raw } = syntheticMix(39, 100);
    const dungeon = validateDungeonPackage(credential, raw);
    expect(dungeon.readiness.study).toBe(true);
    expect(dungeon.readiness.gauntlet).toBe(false);
    expect(dungeon.readiness.reasons).toContain(
      'Boss Gauntlet needs at least 40% applied reasoning rather than concept recall.',
    );
  });

  it('keeps the existing requirement for genuine boss-tier encounters', () => {
    const { credential, raw } = syntheticMix(100, 0);
    const dungeon = validateDungeonPackage(credential, raw);
    expect(dungeon.readiness.gauntlet).toBe(false);
    expect(dungeon.readiness.reasons).toContain(
      'Boss Gauntlet needs independently reviewed Advanced or Expert encounters.',
    );
  });
});
