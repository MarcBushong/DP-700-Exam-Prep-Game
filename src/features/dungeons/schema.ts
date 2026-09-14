import { z } from 'zod';
import { formats, timestampSchema } from '../grounding/schema';
import {
  officialSourceUrlSchema,
  credentialEvidenceUrlSchema,
  sourceRuleSchema,
} from './sourcePolicy';

const text = z.string().trim().min(1);
export const credentialStatuses = [
  'active',
  'announced',
  'beta',
  'retiring',
  'retired',
  'replaced',
  'unverified',
] as const;
export const contentReadinessValues = [
  'ready',
  'limited',
  'validating',
  'stale',
  'unavailable',
] as const;
export const readinessThresholdsSchema = z
  .object({
    studyMinimum: z.number().int().min(25).default(25),
    gauntletMinimum: z.number().int().min(75).default(75),
    minimumQuestionsPerSkill: z.number().int().min(1).default(2),
    rubricMinimum: z.number().int().min(18).max(20).default(18),
    matureBankTarget: z.number().int().positive().default(150),
    advancedExpertTarget: z.number().min(0).max(1).default(0.4),
  })
  .superRefine((value, context) => {
    if (value.gauntletMinimum < value.studyMinimum)
      context.addIssue({
        code: 'custom',
        message: 'Gauntlet threshold cannot be below study threshold.',
      });
  });

export const reviewPolicySchema = z
  .object({
    version: z.literal('three-pass-v1'),
    minimumRubricScore: z.number().int().min(44).max(48),
    targetVerified: z.number().int().min(150),
    sourcePolicy: z.literal('guide-linked-official'),
  })
  .strict();
export type ReviewPolicy = z.infer<typeof reviewPolicySchema>;

export const credentialSchema = z.object({
  credentialId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  examCode: text.nullable(),
  currentName: text.nullable(),
  dungeonName: text,
  credentialType: z.enum([
    'certification',
    'exam',
    'applied-skill',
    'unverified',
  ]),
  provider: z.enum(['Microsoft', 'GitHub']),
  productAreas: z.array(text),
  personas: z.array(text),
  level: text.nullable(),
  status: z.enum(credentialStatuses),
  officialUrls: z.object({
    credential: officialSourceUrlSchema.nullable(),
    exam: officialSourceUrlSchema.nullable(),
    studyGuide: officialSourceUrlSchema.nullable(),
    training: officialSourceUrlSchema.nullable(),
  }),
  objectiveVersion: text.nullable(),
  lastGroundedAt: timestampSchema.nullable(),
  lastValidatedAt: timestampSchema.nullable(),
  supportedQuestionTypes: z.array(z.enum(formats)),
  verifiedQuestionCount: z.number().int().nonnegative(),
  minimumPlayableQuestionCount: z.number().int().min(25),
  contentReadiness: z.enum(contentReadinessValues),
  disclaimer: text,
  themeMetadata: z.object({
    biome: text,
    bossName: text,
    art: text.nullable().optional(),
    accent: text.optional(),
    difficultyTier: text.optional(),
  }),
  isVerified: z.boolean(),
  sealedReason: text.optional(),
  sourceAllowlist: z.array(sourceRuleSchema),
  requiredReviewPolicy: reviewPolicySchema.optional(),
  verificationEvidence: z
    .array(
      z.object({
        url: credentialEvidenceUrlSchema,
        title: text,
        retrievedAt: timestampSchema,
        summary: text,
      }),
    )
    .default([]),
});
export type Credential = z.infer<typeof credentialSchema>;
export type ReadinessThresholds = z.infer<typeof readinessThresholdsSchema>;

export const heroClassSchema = z.object({
  id: text,
  name: text,
  description: text,
  credentialIds: z.array(text),
});
export type HeroClass = z.infer<typeof heroClassSchema>;

export const packageManifestSchema = z.object({
  schemaVersion: z.literal(1),
  credentialId: text,
  objectiveVersion: text,
  objectiveHistory: z
    .array(
      z.object({
        objectiveVersion: text,
        replacedAt: timestampSchema,
        notes: text,
      }),
    )
    .default([]),
  readinessThresholds: readinessThresholdsSchema,
  reviewPolicy: reviewPolicySchema.optional(),
});
export type PackageManifest = z.infer<typeof packageManifestSchema>;

export const rubricCriteria = [
  'alignment',
  'accuracy',
  'scenarioCompleteness',
  'distractorPlausibility',
  'answerUniqueness',
  'documentationStrength',
  'difficultyAuthenticity',
  'explanationQuality',
  'originality',
  'clarityAccessibility',
] as const;
const rubricBinding = {
  objectiveVersion: text,
  objectiveFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  reviewerId: text,
  reviewedAt: timestampSchema,
  notes: text.min(20),
};
export const rubricV2Criteria = [
  'alignment',
  'accuracy',
  'scenarioCompleteness',
  'answerUniqueness',
  'distractorPlausibility',
  'distractorEvidence',
  'documentationStrength',
  'citationSpecificity',
  'difficultyAuthenticity',
  'explanationQuality',
  'originality',
  'clarityAccessibility',
] as const;
export const rubricV2Schema = z
  .object({
    ...rubricBinding,
    version: z.literal(2),
    scores: z.record(z.enum(rubricV2Criteria), z.number().int().min(0).max(4)),
  })
  .strict();
export const rubricSchema = z.union([
  z
    .object({
      ...rubricBinding,
      version: z.literal(1).optional(),
      scores: z.record(z.enum(rubricCriteria), z.number().int().min(0).max(2)),
    })
    .strict(),
  rubricV2Schema,
]);
export type RealismRubric = z.infer<typeof rubricSchema>;

export const claimEvidenceSchema = z.object({
  choiceId: text,
  sourceIds: z.array(text).min(1),
  summary: text.min(20),
});
export const encounterMetadataSchema = z.object({
  credentialId: text,
  objectiveVersion: text,
  questionFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  sourceIds: z.array(text).min(1),
  retrievedAt: timestampSchema,
  lastValidatedAt: timestampSchema,
  answerEvidence: z.array(claimEvidenceSchema).min(1),
  distractorEvidence: z.array(claimEvidenceSchema).min(1),
  rubric: rubricSchema.nullable(),
});
export type EncounterMetadata = z.infer<typeof encounterMetadataSchema>;
export const encounterMetadataFileSchema = z.object({
  schemaVersion: z.literal(1),
  encounters: z.record(z.string(), encounterMetadataSchema),
});
export type EncounterMetadataFile = z.infer<typeof encounterMetadataFileSchema>;

export const dungeonReadinessSchema = z.object({
  study: z.boolean(),
  gauntlet: z.boolean(),
  reasons: z.array(text),
});
export type DungeonReadiness = z.infer<typeof dungeonReadinessSchema>;
