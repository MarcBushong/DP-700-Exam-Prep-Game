import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  objectiveFingerprint,
  questionFingerprint,
} from '../src/features/dungeons/review';
import { objectiveFingerprint as scriptObjectiveFingerprint } from '../scripts/review-helpers';
import { encounterMetadataFileSchema } from '../src/features/dungeons/schema';
import { validateDungeonPackage } from '../src/features/dungeons/validation';
import { dungeonFixture } from './dungeon-fixtures';

// These simulated records/grades exercise thresholds only and are never production reviews.
function readyFixture() {
  const { credential, raw: template } = dungeonFixture();
  const raw = structuredClone(template);
  raw.questions = [];
  raw.reviews.reviews = [];
  raw.encounterMetadata.encounters = {};
  for (let index = 0; index < 75; index++) {
    const id = `synthetic-map-${index}`;
    const domain = raw.taxonomy.domains[index % raw.taxonomy.domains.length];
    const q = {
      ...template.questions[0],
      id,
      question: `Synthetic fixture branch ${index} uses ${Array.from({ length: 12 }, (_, token) => `marker${index}segment${token}`).join(' ')}. Select the artificial supporting option.`,
      conceptId: id,
      objectiveDomain: domain.id,
      skill: domain.skills[0].id,
      subskill: domain.skills[0].subskills[0],
      difficulty: 'expert' as const,
      verificationNotes: `Synthetic review of ${id} for lifecycle tests only; no real-world correctness or documentation review is asserted.`,
    };
    const fingerprint = questionFingerprint(q);
    raw.questions.push(q);
    raw.reviews.reviews.push({
      ...structuredClone(template.reviews.reviews[0]),
      questionId: id,
      questionFingerprint: fingerprint,
      verificationNotes: q.verificationNotes,
    });
    raw.encounterMetadata.encounters[id] = {
      ...structuredClone(template.encounterMetadata.encounters.q1),
      questionFingerprint: fingerprint,
    };
  }
  return {
    credential: {
      ...credential,
      contentReadiness: 'ready' as const,
      verifiedQuestionCount: 75,
    },
    raw,
  };
}

describe('reviewer-authored objective-map bindings', () => {
  it('binds unchanged maps consistently through both public review-helper exports', () => {
    const { credential, raw } = readyFixture();
    const fingerprint = objectiveFingerprint(raw.taxonomy);
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(scriptObjectiveFingerprint(raw.taxonomy)).toBe(fingerprint);
    expect(objectiveFingerprint(structuredClone(raw.taxonomy))).toBe(
      fingerprint,
    );
    const dungeon = validateDungeonPackage(credential, raw);
    expect(dungeon.findings).toEqual([]);
    expect(dungeon.questions).toHaveLength(75);
    expect(dungeon.readiness).toEqual({
      study: true,
      gauntlet: true,
      reasons: [],
    });
  });

  it('does not reopen when catalog/package/taxonomy/envelope versions are rewritten around old reviews', () => {
    const { credential, raw } = readyFixture();
    const next = 'Next synthetic objective edition';
    credential.objectiveVersion = next;
    raw.packageManifest.objectiveVersion = next;
    raw.taxonomy.studyGuideEffectiveDate = next;
    raw.taxonomy.retrievedAt = '2026-09-11T16:06:00.000Z';
    for (const metadata of Object.values(raw.encounterMetadata.encounters))
      metadata.objectiveVersion = next;
    const ledgerBefore = JSON.stringify(raw.reviews);
    const fingerprintsBefore = raw.questions.map(questionFingerprint);
    const checkClosed = () => {
      const dungeon = validateDungeonPackage(credential, raw);
      expect(dungeon.questions).toEqual([]);
      expect(dungeon.readiness).toMatchObject({
        study: false,
        gauntlet: false,
      });
      expect(
        dungeon.allQuestions.every((q) => q.verificationStatus === 'stale'),
      ).toBe(true);
      expect(
        dungeon.findings.every(
          (finding) => finding.code === 'objective-review-stale',
        ),
      ).toBe(true);
    };
    checkClosed();
    // Merely changing dates is not a new review of the changed objective content.
    for (const metadata of Object.values(raw.encounterMetadata.encounters))
      metadata.rubric!.reviewedAt = raw.taxonomy.retrievedAt;
    checkClosed();
    expect(JSON.stringify(raw.reviews)).toBe(ledgerBefore);
    expect(raw.questions.map(questionFingerprint)).toEqual(fingerprintsBefore);
    expect(
      raw.questions.every((q) => q.verificationStatus === 'verified'),
    ).toBe(true);
  });

  it.each(['subskill', 'weight', 'domain-title', 'skill-title'] as const)(
    'excludes old rubrics after a same-version %s change even though all existing question mappings still resolve',
    (change) => {
      const { credential, raw } = readyFixture();
      if (change === 'subskill')
        raw.taxonomy.domains[0].skills[0].subskills.push(
          'Another synthetic objective',
        );
      if (change === 'weight') raw.taxonomy.domains[0].weightRange = [31, 36];
      if (change === 'domain-title')
        raw.taxonomy.domains[0].title += ' revised';
      if (change === 'skill-title')
        raw.taxonomy.domains[0].skills[0].title += ' revised';
      const dungeon = validateDungeonPackage(credential, raw);
      expect(dungeon.questions).toEqual([]);
      expect(
        dungeon.allQuestions.every((q) => q.verificationStatus === 'stale'),
      ).toBe(true);
      expect(dungeon.findings).toHaveLength(75);
      expect(
        dungeon.findings.every(
          (finding) => finding.code === 'objective-review-stale',
        ),
      ).toBe(true);
    },
  );

  it.each(['objectiveVersion', 'objectiveFingerprint'] as const)(
    'requires the rubric %s binding itself to match, not just the outer envelope',
    (binding) => {
      const { credential, raw } = readyFixture();
      for (const metadata of Object.values(raw.encounterMetadata.encounters))
        metadata.rubric![binding] =
          binding === 'objectiveVersion'
            ? 'Unreviewed edition'
            : '0'.repeat(64);
      const dungeon = validateDungeonPackage(credential, raw);
      expect(dungeon.questions).toEqual([]);
      expect(
        dungeon.allQuestions.every((q) => q.verificationStatus === 'stale'),
      ).toBe(true);
    },
  );

  it('binds the exact study-guide URL', () => {
    const { credential, raw } = readyFixture();
    const previous = objectiveFingerprint(raw.taxonomy);
    const next =
      'https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/sc-200';
    credential.officialUrls.studyGuide = next;
    raw.taxonomy.studyGuideUrl = next;
    expect(objectiveFingerprint(raw.taxonomy)).not.toBe(previous);
    expect(validateDungeonPackage(credential, raw).questions).toEqual([]);
  });

  it('ignores retrieval time in the content hash but still requires a review after the actual outline retrieval', () => {
    const { credential, raw } = readyFixture();
    const before = objectiveFingerprint(raw.taxonomy);
    raw.taxonomy.retrievedAt = '2026-09-11T16:06:00.000Z';
    expect(objectiveFingerprint(raw.taxonomy)).toBe(before);
    const dungeon = validateDungeonPackage(credential, raw);
    expect(dungeon.questions).toEqual([]);
    expect(
      dungeon.allQuestions.every((q) => q.verificationStatus === 'stale'),
    ).toBe(true);
    expect(
      dungeon.findings.every(
        (finding) => finding.code === 'objective-review-stale',
      ),
    ).toBe(true);
  });

  it('canonicalizes object keys and equivalent unknown-weight representations, preserving array order', () => {
    const { raw } = dungeonFixture();
    const taxonomy = raw.taxonomy;
    const reordered = {
      ...taxonomy,
      domains: taxonomy.domains.map((domain) => ({
        skills: domain.skills.map((skill) => ({
          subskills: skill.subskills,
          title: skill.title,
          id: skill.id,
        })),
        weightRange: domain.weightRange,
        title: domain.title,
        id: domain.id,
      })),
    };
    expect(objectiveFingerprint(reordered)).toBe(
      objectiveFingerprint(taxonomy),
    );
    expect(
      objectiveFingerprint({
        ...taxonomy,
        domains: [...taxonomy.domains].reverse(),
      }),
    ).not.toBe(objectiveFingerprint(taxonomy));
    delete taxonomy.domains[0].weightRange;
    const missingWeight = objectiveFingerprint(taxonomy);
    taxonomy.domains[0].weightRange = null;
    expect(objectiveFingerprint(taxonomy)).toBe(missingWeight);
  });

  it('does not invent missing bindings for legacy rubric objects', () => {
    const { credential, raw } = dungeonFixture();
    const metadata = raw.encounterMetadata.encounters.q1;
    const legacy = {
      schemaVersion: 1,
      encounters: {
        q1: {
          ...metadata,
          rubric: Object.fromEntries(
            Object.entries(metadata.rubric!).filter(
              ([key]) =>
                !['objectiveVersion', 'objectiveFingerprint'].includes(key),
            ),
          ),
        },
      },
    };
    expect(encounterMetadataFileSchema.safeParse(legacy).success).toBe(false);
    const before = JSON.stringify(legacy);
    expect(
      validateDungeonPackage(credential, { ...raw, encounterMetadata: legacy })
        .questions,
    ).toEqual([]);
    expect(JSON.stringify(legacy)).toBe(before);
  });

  it('publishes the required independent objective bindings in the machine-readable schema', async () => {
    const emitted = JSON.parse(
      await readFile(
        resolve('schemas', 'encounter-metadata.schema.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    delete emitted.$comment;
    expect(emitted).toEqual(
      z.toJSONSchema(encounterMetadataFileSchema, { io: 'input' }),
    );
  });
});
