import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { examId, loadDungeonPackage } from '../scripts/content-files';
import {
  credentials,
  filterCredentials,
} from '../src/features/dungeons/catalog';
import { buildContentReport } from '../src/features/grounding/report';
import {
  questionSchema,
  taxonomySchema,
} from '../src/features/grounding/schema';
import {
  objectiveFingerprint,
  questionFingerprint,
} from '../src/features/dungeons/review';
import { validationMetadataSchema } from '../src/features/dungeons/threePass';
import { passesRealismRubric } from '../src/features/dungeons/readiness';
import { planDungeonSession } from '../src/features/quiz/dungeonRuntime';
import { defaultConfig } from '../src/features/quiz/types';

const read = (id: string, file: string): unknown =>
  JSON.parse(readFileSync(join('src', 'content', 'exams', id, file), 'utf8'));

describe.each(['ai-103', 'ai-200'])('%s installed strict package', (id) => {
  it('uses the existing canonical ID and independently required complete review policy', async () => {
    expect(examId(id.toUpperCase())).toBe(id);
    expect(
      credentials.filter((credential) => credential.credentialId === id),
    ).toHaveLength(1);
    const dungeon = await loadDungeonPackage(id);
    expect(dungeon.credential.requiredReviewPolicy).toEqual(
      dungeon.packageManifest.reviewPolicy,
    );
    expect(dungeon.packageManifest.reviewPolicy).toEqual({
      version: 'three-pass-v1',
      minimumRubricScore: 44,
      targetVerified: 150,
      sourcePolicy: 'guide-linked-official',
    });
    expect(
      dungeon.findings.filter((finding) => finding.severity !== 'warning'),
    ).toEqual([]);
  });

  it('binds every approved option, final rubric and all three independent passes to current facts', async () => {
    const dungeon = await loadDungeonPackage(id);
    const stages = validationMetadataSchema.parse(dungeon.validationMetadata);
    const authored = questionSchema.array().parse(read(id, 'questions.json'));
    const objectiveHash = objectiveFingerprint(dungeon.taxonomy);
    expect(dungeon.allQuestions).toHaveLength(authored.length);
    expect(dungeon.reviews.reviews).toHaveLength(authored.length);
    for (const question of dungeon.reviewedQuestions) {
      const pass = stages.encounters[question.id];
      const envelope = dungeon.encounterMetadata.encounters[question.id];
      const final = dungeon.reviews.reviews.find(
        (review) => review.questionId === question.id,
      )!;
      const hash = questionFingerprint(question);
      expect(pass.generation.questionFingerprint).toBe(hash);
      expect(pass.technical?.review.questionFingerprint).toBe(hash);
      expect(pass.adversarial?.questionFingerprint).toBe(hash);
      expect(
        new Set([
          pass.generation.authorId,
          pass.technical?.review.reviewerId,
          pass.adversarial?.reviewerId,
        ]).size,
      ).toBe(3);
      expect(pass.technical?.review.verdict).toBe('verified');
      expect(pass.adversarial?.verdict).toBe('verified');
      expect(pass.adversarial?.objectiveFingerprint).toBe(objectiveHash);
      expect(
        pass.adversarial?.optionChallenges
          .map((choice) => choice.choiceId)
          .sort(),
      ).toEqual(question.answerChoices.map((choice) => choice.id).sort());
      expect(final.reviewedAt).toBe(pass.adversarial?.reviewedAt);
      expect(envelope.rubric?.reviewedAt).toBe(final.reviewedAt);
      expect(envelope.rubric?.objectiveFingerprint).toBe(objectiveHash);
      expect(envelope.rubric?.version).toBe(2);
      expect(passesRealismRubric(envelope.rubric, 44)).toBe(true);
      expect(
        question.sourceUrls.every(
          (url) => new URL(url).hostname === 'learn.microsoft.com',
        ),
      ).toBe(true);
    }
  });

  it('reports status counts honestly and rejects direct or raid attempts when identity is unavailable', async () => {
    const dungeon = await loadDungeonPackage(id);
    const report = buildContentReport(dungeon);
    expect(report.totalQuestions).toBe(dungeon.allQuestions.length);
    expect(report.reviewedVerifiedQuestions).toBe(
      dungeon.reviewedQuestions.length,
    );
    expect(report.playableVerifiedQuestions).toBe(dungeon.questions.length);
    const unavailable =
      !dungeon.credential.isVerified || dungeon.credential.status !== 'active';
    if (unavailable) {
      expect(dungeon.questions).toEqual([]);
      expect(dungeon.readiness).toMatchObject({
        study: false,
        gauntlet: false,
      });
      expect(
        filterCredentials(credentials, { heroClassId: 'wanderer' }).some(
          (entry) => entry.credentialId === id,
        ),
      ).toBe(false);
      const dp700 = await loadDungeonPackage('dp-700');
      for (const runMode of ['study', 'gauntlet', 'raid'] as const)
        expect(
          planDungeonSession([dungeon, dp700], {
            ...defaultConfig,
            credentialId: id,
            runMode,
            raidCredentialIds: [id, 'dp-700'],
          }).ok,
        ).toBe(false);
    }
  });
});

it('preserves legacy AI-103 objective and question identities without inheriting old review approval', () => {
  const oldMap = taxonomySchema.parse(
    read('ai-103', join('history', 'pre-three-pass', 'objectives.json')),
  );
  const currentMap = taxonomySchema.parse(read('ai-103', 'objectives.json'));
  expect(objectiveFingerprint(currentMap)).toBe(objectiveFingerprint(oldMap));
  expect(Date.parse(currentMap.retrievedAt)).toBeGreaterThan(
    Date.parse(oldMap.retrievedAt),
  );
  const oldQuestions = questionSchema
    .array()
    .parse(read('ai-103', join('history', 'pre-three-pass', 'questions.json')));
  const current = questionSchema
    .array()
    .parse(read('ai-103', 'questions.json'));
  expect(oldQuestions).toHaveLength(30);
  for (const prior of oldQuestions) {
    const regenerated = current.find((question) => question.id === prior.id);
    if (!regenerated) continue;
    expect(regenerated.conceptId).toBe(prior.conceptId);
    expect(regenerated.generatedAt).not.toBe(prior.generatedAt);
    expect(questionFingerprint(regenerated)).not.toBe(
      questionFingerprint(prior),
    );
  }
});
