import {
  credentials,
  heroClasses,
  validateCatalog,
} from '../src/features/dungeons/catalog';
import { buildContentReport } from '../src/features/grounding/report';
import { loadDungeonPackage, packageIds } from './content-files';
import { isMain } from './validate-questions';
import { readReviewLedger, reviewLedgerFindings } from './review-ledger';
import type { QuestionReview } from '../src/features/grounding/workflow';

export async function inspectAllPackages() {
  const catalogFindings = validateCatalog(credentials, heroClasses);
  const ids = await packageIds();
  const packages = [];
  const packageReviews: QuestionReview[] = [];
  for (const id of ids) {
    try {
      const dungeon = await loadDungeonPackage(id);
      packageReviews.push(...dungeon.reviews.reviews);
      const report = buildContentReport(
        dungeon,
        undefined,
        dungeon.packageManifest.readinessThresholds,
      );
      if (dungeon.credential.verifiedQuestionCount !== dungeon.questions.length)
        catalogFindings.push(
          `${id}: catalog verified count ${dungeon.credential.verifiedQuestionCount} differs from playable package count ${dungeon.questions.length}.`,
        );
      if (
        dungeon.credential.contentReadiness === 'ready' &&
        !dungeon.readiness.gauntlet
      )
        catalogFindings.push(
          `${id}: ready catalog state requires both supported game modes.`,
        );
      if (
        dungeon.credential.contentReadiness === 'limited' &&
        !dungeon.readiness.study
      )
        catalogFindings.push(
          `${id}: limited catalog state requires at least Study Run readiness.`,
        );
      packages.push({
        credentialId: id,
        objectiveVersion: dungeon.objectiveVersion,
        readiness: dungeon.readiness,
        verifiedQuestionCount: dungeon.questions.length,
        reviewedVerifiedQuestionCount: dungeon.reviewedQuestions.length,
        totalCandidateRecords: dungeon.totalRecords,
        availability: report.availability,
        threePass: report.threePass,
        statusCounts: report.statusCounts,
        coverage: report.counts.playable,
        coverageBasis: 'playable-only',
        reviewedCoverage: report.counts.reviewed,
        excludedQuestionIds: report.excludedQuestionIds,
        findings: dungeon.findings,
        freshness: report.freshness,
        targets: report.targets,
      });
    } catch (error) {
      catalogFindings.push(
        `${id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  for (const credential of credentials)
    if (
      !ids.includes(credential.credentialId) &&
      (credential.verifiedQuestionCount > 0 ||
        ['ready', 'limited'].includes(credential.contentReadiness))
    )
      catalogFindings.push(
        `${credential.credentialId}: catalog claims playable content without an installed package.`,
      );
  catalogFindings.push(
    ...reviewLedgerFindings(packageReviews, await readReviewLedger()),
  );
  return {
    generatedAt: new Date().toISOString(),
    disclaimer:
      'Structure, ledger bindings, evidence envelopes, realism scores, source policies and readiness are checked. This report does not perform semantic review or retrieve current vendor status.',
    catalogFindings,
    packages,
    uncarvedCredentials: credentials
      .filter((credential) => !ids.includes(credential.credentialId))
      .map((credential) => ({
        credentialId: credential.credentialId,
        currentName: credential.currentName,
        status: credential.status,
        isVerified: credential.isVerified,
        contentReadiness: credential.contentReadiness,
        verifiedQuestionCount: 0,
        reason:
          credential.sealedReason ??
          'No independently reviewed encounter package installed.',
      })),
  };
}

if (isMain(import.meta.url)) {
  try {
    const report = await inspectAllPackages();
    console.log(JSON.stringify(report, null, 2));
    if (
      report.catalogFindings.length ||
      report.packages.some((dungeon) =>
        dungeon.findings.some((finding) => finding.severity !== 'warning'),
      )
    )
      process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
