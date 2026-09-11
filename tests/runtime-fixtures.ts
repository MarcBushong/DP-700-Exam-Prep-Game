import type { DungeonPackage } from '../src/features/dungeons/packages';
import { readinessThresholdsSchema } from '../src/features/dungeons/schema';
import type { Question } from '../src/features/grounding/schema';
import { date, manifest, question, taxonomy } from './fixtures';

// Synthetic packages exercise runtime gates without authoring or attesting
// certification content. They are never imported by the application.
export function dungeon(
  id = 'dp-700',
  questions: Question[] = [question()],
  overrides: Partial<DungeonPackage> = {},
): DungeonPackage {
  return {
    credential: {
      credentialId: id,
      examCode: null,
      currentName: `Synthetic ${id}`,
      dungeonName: `Synthetic ${id}`,
      credentialType: 'exam',
      provider: 'Microsoft',
      productAreas: ['Synthetic'],
      personas: ['data-engineer'],
      level: null,
      status: 'active',
      officialUrls: {
        credential: taxonomy.studyGuideUrl,
        exam: null,
        studyGuide: taxonomy.studyGuideUrl,
        training: taxonomy.studyGuideUrl,
      },
      isVerified: true,
      contentReadiness: 'ready',
      objectiveVersion: taxonomy.studyGuideEffectiveDate,
      lastGroundedAt: date,
      lastValidatedAt: date,
      supportedQuestionTypes: ['single-select'],
      verifiedQuestionCount: questions.length,
      minimumPlayableQuestionCount: 25,
      disclaimer: 'Synthetic runtime-only fixture; never shipped.',
      themeMetadata: { biome: 'Synthetic', bossName: 'Synthetic' },
      sourceAllowlist: [
        {
          host: 'learn.microsoft.com',
          pathPrefixes: ['/en-us/fabric/', '/en-us/credentials/'],
          exactUrls: [],
        },
      ],
      verificationEvidence: [],
    },
    questions,
    allQuestions: questions,
    taxonomy: structuredClone(taxonomy),
    manifest: structuredClone(manifest),
    reviews: {
      schemaVersion: 1,
      requestId: 'synthetic-runtime-only',
      reviews: [],
    },
    encounterMetadata: { schemaVersion: 1, encounters: {} },
    packageManifest: {
      schemaVersion: 1,
      credentialId: id,
      objectiveVersion: taxonomy.studyGuideEffectiveDate,
      objectiveHistory: [],
      readinessThresholds: readinessThresholdsSchema.parse({}),
    },
    readiness: { study: true, gauntlet: true, reasons: [] },
    objectiveVersion: taxonomy.studyGuideEffectiveDate,
    findings: [],
    totalRecords: questions.length,
    totalSourceRecords: manifest.sources.length,
    ...overrides,
  };
}
