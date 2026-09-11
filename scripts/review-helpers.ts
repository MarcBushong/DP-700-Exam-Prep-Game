import { createHash } from 'node:crypto';
import type {
  GroundingManifest,
  Question,
} from '../src/features/grounding/schema';
import { verificationReviewSchema } from '../src/features/grounding/workflow';
import type { ContentFinding } from '../src/features/grounding/quality';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

/** Bind the attestation to content, answer mapping, citations, and generation dates. */
export function questionFingerprint(question: Question): string {
  const metadata = new Set([
    'verificationStatus',
    'verifiedAt',
    'verifiedAgainstSourceIds',
    'verificationNotes',
    'requiresManualReview',
    'sourceLastReviewedAt',
    'confidenceReason',
  ]);
  const authored = Object.fromEntries(
    Object.entries(question).filter(([key]) => !metadata.has(key)),
  );
  return createHash('sha256').update(canonical(authored)).digest('hex');
}

export function validateReviewAttestations(
  questions: Question[],
  manifest: GroundingManifest,
  data: unknown,
): ContentFinding[] {
  const findings: ContentFinding[] = [];
  const fail = (id: string, message: string) =>
    findings.push({
      code: 'review-attestation',
      category: 'verification',
      severity: 'error',
      questionIds: [id],
      message: `${id}: ${message}`,
    });
  const parsed = verificationReviewSchema.safeParse(data);
  if (!parsed.success)
    return [
      {
        code: 'review-schema',
        category: 'verification',
        severity: 'error',
        questionIds: [],
        message: parsed.error.message,
      },
    ];
  const reviews = parsed.data.reviews;
  const reviewedIds = new Set<string>();
  for (const review of reviews) {
    const id = review.questionId;
    if (reviewedIds.has(id)) fail(id, 'Duplicate review attestation.');
    reviewedIds.add(id);
    const question = questions.find((q) => q.id === id);
    if (!question) {
      fail(id, 'Attestation references an unknown candidate.');
      continue;
    }
    if (review.questionFingerprint !== questionFingerprint(question))
      fail(
        id,
        'Question changed after the attested review; independently re-review.',
      );
    if (review.verdict !== question.verificationStatus)
      fail(id, 'Attested verdict does not match the candidate status.');
    if (
      Date.parse(review.reviewedAt) < Date.parse(question.lastValidatedAt) ||
      Date.parse(review.reviewedAt) > Date.now()
    )
      fail(
        id,
        'Review timestamp must follow generation/validation and not be in the future.',
      );
    if (
      (question.verificationStatus === 'verified' &&
        review.reviewedAt !== question.verifiedAt) ||
      review.verificationNotes !== question.verificationNotes ||
      review.confidenceReason !== question.confidenceReason
    )
      fail(
        id,
        'Recorded verification metadata does not match the independent attestation.',
      );
    const sourceIds = review.sourceReviews.map((source) => source.sourceId);
    if (
      sourceIds.length !== question.sourceIds.length ||
      question.sourceIds.some((source) => !sourceIds.includes(source))
    )
      fail(id, 'Review must cover exactly all cited sources.');
    for (const source of review.sourceReviews) {
      const recorded = manifest.sources.find(
        (s) => s.sourceId === source.sourceId,
      );
      if (
        !recorded ||
        source.url !== recorded.url ||
        source.retrievedAt !== recorded.retrievedAt ||
        source.lastReviewedAt !== recorded.lastReviewedAt
      )
        fail(
          id,
          `${source.sourceId}: source attestation differs from the current manifest.`,
        );
      if (
        Date.parse(source.lastReviewedAt) > Date.parse(review.reviewedAt) ||
        Date.parse(source.retrievedAt) > Date.parse(source.lastReviewedAt)
      )
        fail(id, `${source.sourceId}: inconsistent evidence chronology.`);
    }
    const choiceIds = review.choiceReviews.map((choice) => choice.choiceId);
    if (
      choiceIds.length !== question.answerChoices.length ||
      question.answerChoices.some((choice) => !choiceIds.includes(choice.id))
    )
      fail(id, 'Independently explain every answer choice exactly once.');
    for (const choice of review.choiceReviews) {
      if (!choice.sourceIds.every((source) => sourceIds.includes(source)))
        fail(id, `${choice.choiceId}: rationale cites an unreviewed source.`);
      if (
        question.verificationStatus === 'verified' &&
        choice.assessment !==
          (question.correctAnswer.includes(choice.choiceId)
            ? 'supported'
            : 'contradicted')
      )
        fail(
          id,
          `${choice.choiceId}: assessment does not support the recorded answer key.`,
        );
    }
  }
  for (const question of questions)
    if (!reviewedIds.has(question.id))
      fail(
        question.id,
        'Candidate lacks an independent attestation in the supplied review file (required for every status).',
      );
  return findings;
}
