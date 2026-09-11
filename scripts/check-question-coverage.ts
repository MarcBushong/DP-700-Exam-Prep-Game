import { buildReportData } from './content-report';

try {
  const report = await buildReportData();
  console.log(
    JSON.stringify(
      {
        playableVerifiedQuestions: report.playableVerifiedQuestions,
        statusCounts: report.statusCounts,
        counts: report.counts.playable,
        targets: report.targets,
        gaps: report.coverageGaps,
      },
      null,
      2,
    ),
  );
  if (
    report.findingCounts.errors ||
    report.findingCounts.blocking ||
    (process.argv.includes('--strict') &&
      (report.targets.questionShortfall ||
        !report.targets.meetsAdvancedExpertTarget ||
        report.coverageGaps.length))
  )
    process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
