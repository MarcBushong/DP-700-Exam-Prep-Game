import { loadContent } from './validate-questions';
import { qualityFindings } from '../src/features/grounding/quality';
import { crossExamDuplicateReport } from '../src/features/dungeons/duplicateReview';
import {
  argument,
  examId,
  loadDungeonPackage,
  readJsonFile,
} from './content-files';

try {
  const content = await loadContent(true);
  const findings = [
    ...content.findings,
    ...qualityFindings(content.allQuestions),
  ];
  const crossIds = argument('--cross-exam')
    ?.split(',')
    .map((id) => examId(id.trim()));
  const crossExam = crossIds
    ? crossExamDuplicateReport(
        await Promise.all(
          [...new Set([examId(), ...crossIds])].map(async (id) => ({
            ...(await loadDungeonPackage(id)),
            credentialId: id,
          })),
        ),
        argument('--semantic-reviews')
          ? await readJsonFile(argument('--semantic-reviews')!)
          : undefined,
      )
    : null;
  console.log(
    JSON.stringify(
      {
        disclaimer:
          'Deterministic duplicate checks and editorial warnings are not semantic verification.',
        blocking: findings.filter((f) => f.severity !== 'warning'),
        reviewWarnings: findings.filter((f) => f.severity === 'warning'),
        crossExam,
      },
      null,
      2,
    ),
  );
  if (findings.some((f) => f.severity !== 'warning')) process.exitCode = 1;
  if (crossExam?.decisionErrors.length) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
