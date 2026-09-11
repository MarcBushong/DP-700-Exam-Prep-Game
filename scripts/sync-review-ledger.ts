import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { packageIds, readRawPackage } from './content-files';
import {
  manifestSchema,
  questionSchema,
} from '../src/features/grounding/schema';
import {
  verificationReviewSchema,
  type QuestionReview,
} from '../src/features/grounding/workflow';
import { validateReviewAttestations } from './review-helpers';
import { reviewLedgerFindings, reviewLedgerPath } from './review-ledger';

try {
  const reviews: QuestionReview[] = [];
  for (const id of await packageIds()) {
    const raw = await readRawPackage(id);
    const questions = questionSchema.array().parse(raw.questions);
    const manifest = manifestSchema.parse(raw.manifest);
    const packageReviews = verificationReviewSchema.parse(raw.reviews);
    const findings = validateReviewAttestations(
      questions,
      manifest,
      packageReviews,
    );
    if (findings.length)
      throw new Error(
        `${id}: cannot copy mismatched attestations:\n${findings.map((finding) => finding.message).join('\n')}`,
      );
    reviews.push(...packageReviews.reviews);
  }
  const ledger = {
    schemaVersion: 1 as const,
    requestId: 'certification-dungeon-consolidated-audit',
    reviews,
  };
  const findings = reviewLedgerFindings(reviews, ledger);
  if (findings.length) throw new Error(findings.join('\n'));
  await mkdir(dirname(reviewLedgerPath), { recursive: true });
  await writeFile(reviewLedgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
  console.log(
    `Copied ${reviews.length} existing independent attestations into ${reviewLedgerPath}. No questions, verdicts, rationales, dates, or approvals were generated.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
