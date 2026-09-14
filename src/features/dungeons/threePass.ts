import { z } from 'zod';
import {
  timestampSchema,
  verificationStatuses,
  type GroundingManifest,
  type Question,
  type Taxonomy,
} from '../grounding/schema';
import {
  questionReviewSchema,
  type VerificationReview,
} from '../grounding/workflow';
import type { ContentFinding } from '../grounding/quality';
import {
  claimEvidenceSchema,
  type EncounterMetadataFile,
  type ReviewPolicy,
} from './schema';
import {
  objectiveFingerprint,
  questionFingerprint,
  validateReviewAttestations,
} from './review';
import { passesRealismRubric } from './readiness';

const text = z.string().trim().min(1);
const summary = text.min(20);
const binding = {
  questionFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  objectiveVersion: text,
  objectiveFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
};
export const optionChallengeSchema = z
  .object({
    choiceId: text,
    claimRepresented: summary,
    whyIncorrectInContext: summary,
    couldBeCorrectWhen: summary,
    sourceIds: z.array(text).min(1),
    evidenceSummary: summary,
  })
  .strict();
export const adversarialChallenges = [
  'scope',
  'plan',
  'role',
  'preconditions',
  'featureStatus',
  'sourceChanges',
  'stemSufficiency',
  'explanationBounds',
  'reasoningDepth',
  'answerClues',
] as const;
export const threePassEncounterSchema = z
  .object({
    generation: z
      .object({
        ...binding,
        authorId: text,
        generatedAt: timestampSchema,
        claims: z.array(claimEvidenceSchema).min(2),
      })
      .strict(),
    technical: z
      .object({
        objectiveVersion: text,
        objectiveFingerprint: binding.objectiveFingerprint,
        review: questionReviewSchema,
      })
      .strict()
      .optional(),
    adversarial: z
      .object({
        ...binding,
        reviewerId: text,
        reviewedAt: timestampSchema,
        verdict: z.enum(verificationStatuses),
        optionChallenges: z.array(optionChallengeSchema).min(2),
        challenges: z.record(z.enum(adversarialChallenges), summary),
        qualityNotes: summary,
      })
      .strict()
      .optional(),
  })
  .strict();
export const validationMetadataSchema = z
  .object({
    schemaVersion: z.literal(1),
    encounters: z.record(text, threePassEncounterSchema),
  })
  .strict();
export type ValidationMetadata = z.infer<typeof validationMetadataSchema>;

const sameIds = (left: string[], right: string[]) =>
  left.length === right.length &&
  new Set(left).size === left.length &&
  left.every((id) => right.includes(id));
const identity = (value: string) => value.trim().toLowerCase();

/** No promotion or re-binding: every saved pass must bind the exact current candidate. */
export function validateThreePassReviews(
  questions: Question[],
  taxonomy: Taxonomy,
  manifest: GroundingManifest,
  finalReviews: VerificationReview,
  envelopes: EncounterMetadataFile,
  policy: ReviewPolicy,
  data: unknown,
): ContentFinding[] {
  const findings: ContentFinding[] = [];
  const fail = (id: string, pass: string, message: string) =>
    findings.push({
      code: `three-pass-${pass}`,
      category: 'verification' as const,
      severity: 'error' as const,
      questionIds: id ? [id] : [],
      message: `${id}: ${message}`,
    });
  // Parse per encounter so one honestly quarantined candidate cannot invalidate the bank.
  const header = z
    .object({
      schemaVersion: z.literal(1),
      encounters: z.record(text, z.unknown()),
    })
    .strict()
    .safeParse(data);
  if (!header.success) {
    fail(
      '',
      'schema',
      `Required validation-metadata.json is invalid: ${header.error.message}`,
    );
    return findings;
  }
  const objectiveHash = objectiveFingerprint(taxonomy);
  for (const id of Object.keys(header.data.encounters))
    if (!questions.some((q) => q.id === id))
      fail(
        id,
        'schema',
        'Validation metadata references an unknown candidate.',
      );
  for (const question of questions) {
    const id = question.id;
    const parsed = threePassEncounterSchema.safeParse(
      header.data.encounters[id],
    );
    if (!parsed.success) {
      fail(
        id,
        'schema',
        `Missing or invalid pass record: ${parsed.error.message}`,
      );
      continue;
    }
    const { generation, technical, adversarial } = parsed.data;
    const final = finalReviews.reviews.find(
      (review) => review.questionId === id,
    );
    const hash = questionFingerprint(question);
    const currentBinding = (
      stage: { objectiveVersion: string; objectiveFingerprint: string },
      pass: string,
    ) => {
      if (
        stage.objectiveVersion !== taxonomy.studyGuideEffectiveDate ||
        stage.objectiveFingerprint !== objectiveHash
      )
        fail(
          id,
          pass,
          'Objective map/version changed; independently rerun all passes.',
        );
    };
    currentBinding(generation, 'generation');
    if (
      generation.questionFingerprint !== hash ||
      generation.generatedAt !== question.generatedAt ||
      (final && identity(generation.authorId) !== identity(final.authorId))
    )
      fail(
        id,
        'generation',
        'Generation author, timestamp or exact content hash does not match.',
      );
    if (
      Date.parse(generation.generatedAt) <
      Math.max(
        Date.parse(taxonomy.retrievedAt),
        ...manifest.sources
          .filter((source) => question.sourceIds.includes(source.sourceId))
          .map((source) => Date.parse(source.retrievedAt)),
      )
    )
      fail(
        id,
        'generation',
        'Grounded generation must follow actual objective and cited-source retrieval.',
      );
    if (
      !sameIds(
        generation.claims.map((claim) => claim.choiceId),
        question.answerChoices.map((choice) => choice.id),
      ) ||
      generation.claims.some(
        (claim) =>
          !sameIds(claim.sourceIds, [...new Set(claim.sourceIds)]) ||
          claim.sourceIds.some(
            (source) => !question.sourceIds.includes(source),
          ),
      )
    )
      fail(
        id,
        'generation',
        'Grounded claim mappings must cover every option exactly once using cited sources.',
      );
    if (!technical || !adversarial)
      fail(
        id,
        'missing',
        `Pending ${!technical ? 'technical and adversarial' : 'adversarial'} review; neither generation nor a technical approval authorizes gameplay.`,
      );
    if (technical) {
      currentBinding(technical, 'technical');
      const review = technical.review;
      if (
        review.questionId !== id ||
        identity(review.authorId) !== identity(generation.authorId) ||
        review.questionFingerprint !== hash ||
        Date.parse(review.reviewedAt) <= Date.parse(generation.generatedAt) ||
        Date.parse(review.reviewedAt) < Date.parse(taxonomy.retrievedAt)
      )
        fail(
          id,
          'technical',
          'Technical pass must independently follow generation/current objective retrieval and bind this candidate.',
        );
      if (
        question.verificationStatus === 'verified' &&
        review.verdict !== 'verified'
      )
        fail(id, 'technical', 'Technical pass did not approve this candidate.');
      // Reuse every legacy source/option/chronology safeguard against the stage's own snapshot.
      findings.push(
        ...validateReviewAttestations(
          [
            {
              ...question,
              verificationStatus: review.verdict,
              verifiedAt: review.reviewedAt,
              verificationNotes: review.verificationNotes,
              confidenceReason: review.confidenceReason,
            },
          ],
          manifest,
          {
            schemaVersion: 1,
            requestId: 'technical-stage-validation',
            reviews: [review],
          },
        ).map((finding) => ({ ...finding, code: 'three-pass-technical' })),
      );
    }
    if (adversarial) {
      currentBinding(adversarial, 'adversarial');
      if (
        !technical ||
        identity(adversarial.reviewerId) === identity(generation.authorId) ||
        identity(adversarial.reviewerId) ===
          identity(technical.review.reviewerId)
      )
        fail(
          id,
          'adversarial',
          'Adversarial reviewer must differ from author and technical reviewer, with a prior technical pass.',
        );
      if (
        adversarial.questionFingerprint !== hash ||
        Date.parse(adversarial.reviewedAt) <=
          Date.parse(technical?.review.reviewedAt ?? '') ||
        Date.parse(adversarial.reviewedAt) < Date.parse(taxonomy.retrievedAt) ||
        Date.parse(adversarial.reviewedAt) > Date.now()
      )
        fail(
          id,
          'adversarial',
          'Adversarial review must follow technical review and bind the same exact current content.',
        );
      if (
        !sameIds(
          adversarial.optionChallenges.map((choice) => choice.choiceId),
          question.answerChoices.map((choice) => choice.id),
        ) ||
        adversarial.optionChallenges.some(
          (choice) =>
            new Set(choice.sourceIds).size !== choice.sourceIds.length ||
            choice.sourceIds.some(
              (source) => !question.sourceIds.includes(source),
            ),
        )
      )
        fail(
          id,
          'adversarial',
          'Every option needs one sourced counterexample and wrong-in-context analysis.',
        );
      if (
        !final ||
        final.reviewerId !== adversarial.reviewerId ||
        final.reviewedAt !== adversarial.reviewedAt ||
        final.verdict !== adversarial.verdict
      )
        fail(
          id,
          'adversarial',
          'Final independent ledger must attest the adversarial reviewer, date and verdict.',
        );
      if (
        question.verificationStatus === 'verified' &&
        adversarial.verdict !== 'verified'
      )
        fail(
          id,
          'adversarial',
          'Adversarial pass did not approve this candidate.',
        );
    }
    if (question.verificationStatus === 'verified') {
      const rubric = envelopes.encounters[id]?.rubric;
      if (
        !rubric ||
        rubric.version !== 2 ||
        !passesRealismRubric(rubric, policy.minimumRubricScore) ||
        rubric.reviewerId !== adversarial?.reviewerId ||
        rubric.reviewedAt !== adversarial?.reviewedAt
      )
        fail(
          id,
          'rubric',
          'Verified strict content requires the adversarial reviewer’s 12-criterion version 2 rubric at the configured threshold.',
        );
    }
  }
  return findings;
}
