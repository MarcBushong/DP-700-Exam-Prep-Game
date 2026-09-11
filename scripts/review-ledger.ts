import { isDeepStrictEqual } from 'node:util';
import { resolve } from 'node:path';
import { readJsonFile } from './content-files';
import {
  verificationReviewSchema,
  type QuestionReview,
  type VerificationReview,
} from '../src/features/grounding/workflow';

export const reviewLedgerPath = resolve(
  'src',
  'data',
  'verification-reviews.json',
);

export async function readReviewLedger(): Promise<VerificationReview> {
  return verificationReviewSchema.parse(await readJsonFile(reviewLedgerPath));
}

export function reviewLedgerFindings(
  expected: QuestionReview[],
  ledger: VerificationReview,
  allowOtherPackages = false,
): string[] {
  const findings: string[] = [];
  const entries = new Map<string, QuestionReview>();
  for (const review of ledger.reviews) {
    if (entries.has(review.questionId))
      findings.push(
        `Audit ledger contains duplicate review ${review.questionId}.`,
      );
    entries.set(review.questionId, review);
  }
  const expectedIds = new Set<string>();
  for (const review of expected) {
    if (expectedIds.has(review.questionId))
      findings.push(`Multiple packages claim review ${review.questionId}.`);
    expectedIds.add(review.questionId);
    const recorded = entries.get(review.questionId);
    if (!recorded)
      findings.push(
        `Audit ledger is missing independent review ${review.questionId}.`,
      );
    else if (!isDeepStrictEqual(recorded, review))
      findings.push(
        `Audit ledger differs from the independently authored package review ${review.questionId}.`,
      );
  }
  if (!allowOtherPackages)
    for (const id of entries.keys())
      if (!expectedIds.has(id))
        findings.push(
          `Audit ledger contains review ${id} with no installed package candidate.`,
        );
  return findings;
}
