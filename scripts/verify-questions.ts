import { resolve } from 'node:path';
import { examDirectory, examId } from './content-files';
import {
  argument,
  isMain,
  loadContent,
  readJsonFile,
} from './validate-questions';
import {
  validateReviewAttestations,
  questionFingerprint,
} from './review-helpers';
import { buildContentReport } from '../src/features/grounding/report';
import type { ContentFinding } from '../src/features/grounding/quality';
import type {
  GroundingManifest,
  Question,
} from '../src/features/grounding/schema';
import { verificationReviewSchema } from '../src/features/grounding/workflow';
import {
  readReviewLedger,
  reviewLedgerFindings,
  reviewLedgerPath,
} from './review-ledger';

export function verificationReviewFile(options: {
  questions?: string;
  reviews?: string;
  exam?: string;
}): string | undefined {
  if (options.reviews) return options.reviews;
  if (options.questions) return undefined;
  return resolve(
    examDirectory(options.exam ?? 'dp-700'),
    'verification-reviews.json',
  );
}

export async function checkReviewFile(
  questions: Question[],
  manifest: GroundingManifest,
  reviewFile: string,
): Promise<ContentFinding[]> {
  try {
    return validateReviewAttestations(
      questions,
      manifest,
      await readJsonFile(reviewFile),
    );
  } catch (error) {
    return [
      {
        code: 'review-file',
        category: 'verification',
        severity: 'error',
        questionIds: [],
        message: `Required review ledger could not be read: ${reviewFile}. ${error instanceof Error ? error.message : String(error)}`,
      },
    ];
  }
}

export async function runVerification() {
  const content = await loadContent(true);
  const report = buildContentReport(content);
  const reviewFile = verificationReviewFile({
    questions: argument('--questions'),
    reviews: argument('--reviews'),
    exam: examId(),
  });
  const reviewFindings = reviewFile
    ? await checkReviewFile(content.allQuestions, content.manifest, reviewFile)
    : [];
  if (!argument('--questions') && reviewFile) {
    const packageReviews = verificationReviewSchema.parse(
      await readJsonFile(reviewFile),
    );
    const ledger = await readReviewLedger();
    reviewFindings.push(
      ...reviewLedgerFindings(packageReviews.reviews, ledger, true).map(
        (message): ContentFinding => ({
          code: 'consolidated-review-ledger',
          category: 'verification',
          severity: 'error',
          questionIds: [],
          message,
        }),
      ),
    );
  }
  const findings = [...content.findings, ...reviewFindings];
  console.log(
    JSON.stringify(
      {
        mode: reviewFile
          ? 'independent-attestations'
          : 'recorded-verification-metadata',
        reviewFile: reviewFile ?? null,
        consolidatedReviewLedger: argument('--questions')
          ? null
          : reviewLedgerPath,
        attestationChecksPassed:
          Boolean(reviewFile) && reviewFindings.length === 0,
        disclaimer:
          'No answers generated or statuses changed. These checks do not prove factual correctness or reviewer independence; an actual separate reviewer must inspect MCP documentation.',
        statusCounts: report.statusCounts,
        playableVerifiedQuestions: content.questions.length,
        excludedQuestionIds: report.excludedQuestionIds,
        findings,
        questionFingerprints: Object.fromEntries(
          content.allQuestions.map((q) => [q.id, questionFingerprint(q)]),
        ),
      },
      null,
      2,
    ),
  );
  if (
    findings.some((finding) => finding.severity !== 'warning') ||
    (process.argv.includes('--strict') &&
      content.questions.length !== content.totalRecords)
  )
    process.exitCode = 1;
}

if (isMain(import.meta.url)) {
  try {
    await runVerification();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
