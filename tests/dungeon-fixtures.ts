import { formats } from '../src/features/grounding/schema';
import {
  reviewChecks,
  type VerificationReview,
} from '../src/features/grounding/workflow';
import {
  credentialSchema,
  packageManifestSchema,
  rubricCriteria,
  type EncounterMetadataFile,
} from '../src/features/dungeons/schema';
import {
  objectiveFingerprint,
  questionFingerprint,
} from '../src/features/dungeons/review';
import { date, manifest, question, taxonomy } from './fixtures';

/** Synthetic assertions only; these records never enter a production package. */
export function dungeonFixture() {
  const q = question();
  const credential = credentialSchema.parse({
    credentialId: 'fixture-dungeon',
    examCode: 'FIXTURE',
    currentName: 'Synthetic test credential',
    dungeonName: 'Synthetic test dungeon',
    credentialType: 'exam',
    provider: 'Microsoft',
    productAreas: ['Test'],
    personas: ['fixture-class'],
    level: 'Synthetic',
    status: 'active',
    officialUrls: {
      credential: taxonomy.studyGuideUrl,
      exam: null,
      studyGuide: taxonomy.studyGuideUrl,
      training: manifest.sources[0].url,
    },
    objectiveVersion: taxonomy.studyGuideEffectiveDate,
    lastGroundedAt: date,
    lastValidatedAt: date,
    supportedQuestionTypes: formats,
    verifiedQuestionCount: 0,
    minimumPlayableQuestionCount: 25,
    contentReadiness: 'limited',
    disclaimer: 'Synthetic test fixture; no credential or correctness claim.',
    themeMetadata: {
      biome: 'Test fixture',
      bossName: 'Test fixture',
      art: null,
    },
    isVerified: true,
    sourceAllowlist: [
      { host: 'learn.microsoft.com', pathPrefixes: ['/en-us/'], exactUrls: [] },
    ],
    verificationEvidence: [
      {
        url: taxonomy.studyGuideUrl,
        title: 'Synthetic test evidence',
        retrievedAt: date,
        summary: 'Test-only metadata; not evidence of a real credential.',
      },
      {
        url: manifest.sources[0].url,
        title: 'Synthetic preparation evidence',
        retrievedAt: date,
        summary:
          'Test-only preparation metadata, not a real credential assertion.',
      },
    ],
  });
  const reviews: VerificationReview = {
    schemaVersion: 1,
    requestId: 'fixture-review',
    reviews: [
      {
        questionId: q.id,
        authorId: 'fixture-author',
        reviewerId: 'fixture-reviewer',
        questionFingerprint: questionFingerprint(q),
        reviewedAt: date,
        verdict: 'verified',
        sourceReviews: [
          {
            sourceId: 'fixture',
            url: manifest.sources[0].url,
            evidencePath: 'test-fixture.json',
            retrievedAt: date,
            lastReviewedAt: date,
            supportingSummary:
              'Synthetic evidence summary for deterministic unit tests only.',
          },
        ],
        choiceReviews: q.answerChoices.map((choice) => ({
          choiceId: choice.id,
          assessment: q.correctAnswer.includes(choice.id)
            ? 'supported'
            : 'contradicted',
          rationale: `Synthetic option ${choice.id} rationale for testing envelope equality only; not a documentation claim.`,
          sourceIds: ['fixture'],
        })),
        checks: Object.fromEntries(
          reviewChecks.map((key) => [key, true]),
        ) as Record<(typeof reviewChecks)[number], boolean>,
        verificationNotes: q.verificationNotes,
        confidenceReason: q.confidenceReason,
      },
    ],
  };
  const claim = (
    choice: VerificationReview['reviews'][number]['choiceReviews'][number],
  ) => ({
    choiceId: choice.choiceId,
    sourceIds: choice.sourceIds,
    summary: choice.rationale,
  });
  const encounterMetadata: EncounterMetadataFile = {
    schemaVersion: 1,
    encounters: {
      [q.id]: {
        credentialId: credential.credentialId,
        objectiveVersion: credential.objectiveVersion!,
        questionFingerprint: questionFingerprint(q),
        sourceIds: q.sourceIds,
        retrievedAt: date,
        lastValidatedAt: q.lastValidatedAt,
        answerEvidence: reviews.reviews[0].choiceReviews
          .filter((choice) => choice.assessment === 'supported')
          .map(claim),
        distractorEvidence: reviews.reviews[0].choiceReviews
          .filter((choice) => choice.assessment === 'contradicted')
          .map(claim),
        rubric: {
          objectiveVersion: taxonomy.studyGuideEffectiveDate,
          objectiveFingerprint: objectiveFingerprint(taxonomy),
          scores: Object.fromEntries(
            rubricCriteria.map((key) => [key, 2]),
          ) as Record<(typeof rubricCriteria)[number], number>,
          reviewerId: 'fixture-rubric-reviewer',
          reviewedAt: date,
          notes:
            'Synthetic rubric scores for deterministic tests, not an actual content review.',
        },
      },
    },
  };
  return {
    credential,
    raw: {
      packageManifest: packageManifestSchema.parse({
        schemaVersion: 1,
        credentialId: credential.credentialId,
        objectiveVersion: credential.objectiveVersion,
        readinessThresholds: {},
      }),
      questions: [q],
      manifest: structuredClone(manifest),
      taxonomy: structuredClone(taxonomy),
      reviews,
      encounterMetadata,
      personality: { schemaVersion: 1, messages: [] },
    },
  };
}
