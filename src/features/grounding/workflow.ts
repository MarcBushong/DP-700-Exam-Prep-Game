import { z } from 'zod';
import {
  complexities,
  difficulties,
  formats,
  learnUrlSchema,
  questionSchema,
  timestampSchema,
  verificationStatuses,
} from './schema';

const text = z.string().trim().min(1);
export const evidenceReferenceSchema = z
  .object({
    sourceId: text,
    url: learnUrlSchema,
    evidencePath: text,
    retrievedAt: timestampSchema,
    lastReviewedAt: timestampSchema,
    supportingSummary: text.min(20),
  })
  .strict();

export const generationRequestSchema = z
  .object({
    schemaVersion: z.literal(1),
    requestId: text,
    createdAt: timestampSchema,
    authorId: text,
    requestedCount: z.number().int().min(1).max(300),
    objectiveTargets: z
      .array(
        z
          .object({
            objectiveDomain: text,
            skill: text,
            subskill: text,
          })
          .strict(),
      )
      .min(1),
    difficulties: z.array(z.enum(difficulties)).min(1),
    complexities: z.array(z.enum(complexities)).min(1),
    questionTypes: z.array(z.enum(formats)).min(1),
    studyGuideEffectiveDate: text,
    taxonomyRetrievedAt: timestampSchema,
    primaryEvidence: z
      .object({
        studyGuide: text,
        certification: text,
        course: text,
      })
      .strict(),
    supportingEvidence: z.array(evidenceReferenceSchema),
    constraints: z.array(text).min(1),
  })
  .strict();

export const generationOutputSchema = z
  .object({
    schemaVersion: z.literal(1),
    requestId: text,
    authorId: text,
    generatedAt: timestampSchema,
    candidates: z.array(questionSchema).min(1),
  })
  .strict()
  .superRefine((output, context) => {
    if (output.candidates.some((q) => q.verificationStatus === 'verified'))
      context.addIssue({
        code: 'custom',
        message:
          'Generation output cannot self-attest independent verification.',
      });
  });

export const reviewChecks = [
  'answerDefensible',
  'correctOptionsSupported',
  'distractorsIncorrect',
  'explanationsSupported',
  'directSources',
  'featureStatus',
  'currentTerminology',
  'prerequisitesComplete',
  'codeReviewed',
  'originalContent',
  'duplicatesReviewed',
  'qualityReviewed',
] as const;

export const questionReviewSchema = z
  .object({
    questionId: text,
    authorId: text,
    reviewerId: text,
    questionFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    reviewedAt: timestampSchema,
    verdict: z.enum(verificationStatuses),
    sourceReviews: z.array(evidenceReferenceSchema).min(1),
    choiceReviews: z
      .array(
        z
          .object({
            choiceId: text,
            assessment: z.enum(['supported', 'contradicted', 'ambiguous']),
            rationale: text.min(20),
            sourceIds: z.array(text).min(1),
          })
          .strict(),
      )
      .min(2),
    checks: z.record(z.enum(reviewChecks), z.boolean()),
    verificationNotes: text.min(40),
    confidenceReason: text.min(20),
  })
  .strict()
  .superRefine((review, context) => {
    const fail = (message: string) =>
      context.addIssue({ code: 'custom', message });
    if (
      review.authorId.trim().toLowerCase() ===
      review.reviewerId.trim().toLowerCase()
    )
      fail('The independent reviewer must differ from the author.');
    if (
      review.verdict === 'verified' &&
      Object.values(review.checks).some((passed) => !passed)
    )
      fail('Verified verdict requires every independent review check to pass.');
    if (
      new Set(review.sourceReviews.map((s) => s.sourceId)).size !==
      review.sourceReviews.length
    )
      fail('Source review IDs must be unique.');
    if (
      new Set(review.choiceReviews.map((choice) => choice.choiceId)).size !==
      review.choiceReviews.length
    )
      fail('Choice review IDs must be unique.');
  });

export const verificationReviewSchema = z
  .object({
    schemaVersion: z.literal(1),
    requestId: text,
    reviews: z.array(questionReviewSchema),
  })
  .strict();

export type GenerationRequest = z.infer<typeof generationRequestSchema>;
export type QuestionReview = z.infer<typeof questionReviewSchema>;
export type VerificationReview = z.infer<typeof verificationReviewSchema>;
