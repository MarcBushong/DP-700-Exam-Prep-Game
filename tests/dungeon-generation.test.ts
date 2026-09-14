import { describe, expect, it } from 'vitest';
import {
  createGenerationRequest,
  downloadGenerationRequest,
  parseDifficultyMix,
} from '../src/features/dungeons/generation';
import { generationOutputSchema } from '../src/features/grounding/workflow';
import { dungeonFixture } from './dungeon-fixtures';
import { date } from './fixtures';

describe('maintainer requests are browser-safe plans, never evidence or self-verification', () => {
  it('supports the Forge mixed-difficulty alias without changing requested percentages', () => {
    expect(parseDifficultyMix('mixed')).toEqual(parseDifficultyMix('mix'));
  });
  it('targets the chosen credential, objectives and difficulty without invoking AI', () => {
    const { credential, raw } = dungeonFixture();
    const request = createGenerationRequest(credential, raw.taxonomy, {
      requestId: 'synthetic-request',
      authorId: 'test-author',
      createdAt: date,
      requestedCount: 25,
      ...parseDifficultyMix('advanced:60,expert:40'),
      objectiveDomains: ['manage'],
    });
    expect(request.credentialId).toBe('fixture-dungeon');
    expect(request.requestedCount).toBe(25);
    expect(request.objectiveTargets).toHaveLength(1);
    expect(request.difficulties).toEqual(['advanced', 'expert']);
    expect(request.supportingEvidence).toEqual([]);
    expect(JSON.parse(downloadGenerationRequest(request).content)).toEqual(
      request,
    );
  });
  it('rejects invalid mixes, objectives and generation self-attestation', () => {
    for (const mix of [
      'extreme',
      'advanced:90,expert:90',
      'advanced:50,expert',
      'advanced,advanced',
      'advanced:0,expert:100',
    ])
      expect(() => parseDifficultyMix(mix)).toThrow();
    const { credential, raw } = dungeonFixture();
    expect(() =>
      createGenerationRequest(credential, raw.taxonomy, {
        requestId: 'test',
        authorId: 'test',
        createdAt: date,
        requestedCount: 1,
        objectiveDomains: ['unpublished'],
      }),
    ).toThrow(/current objective/i);
    expect(
      generationOutputSchema.safeParse({
        schemaVersion: 1,
        requestId: 'test',
        authorId: 'test',
        generatedAt: date,
        candidates: raw.questions,
      }).success,
    ).toBe(false);
  });
  it('carries the required three-pass policy into Forge downloads even when the caller omits it', () => {
    const { credential, raw } = dungeonFixture();
    credential.requiredReviewPolicy = {
      version: 'three-pass-v1',
      minimumRubricScore: 44,
      targetVerified: 150,
      sourcePolicy: 'guide-linked-official',
    };
    const request = createGenerationRequest(credential, raw.taxonomy, {
      requestId: 'synthetic-strict-request',
      authorId: 'test-author',
      createdAt: date,
      requestedCount: 6,
    });
    expect(request.reviewPolicy).toBe('three-pass-v1');
    expect(request.targetVerified).toBe(150);
    expect(request.difficultyMix).toEqual({
      beginner: 15,
      intermediate: 35,
      advanced: 35,
      expert: 15,
    });
    expect(
      JSON.parse(downloadGenerationRequest(request).content).reviewPolicy,
    ).toBe('three-pass-v1');
  });
});
