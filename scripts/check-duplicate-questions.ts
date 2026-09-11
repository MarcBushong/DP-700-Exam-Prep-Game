import { loadContent } from './validate-questions';
import { qualityFindings } from '../src/features/grounding/quality';

try {
  const content = await loadContent(true);
  const findings = [
    ...content.findings,
    ...qualityFindings(content.allQuestions),
  ];
  console.log(
    JSON.stringify(
      {
        disclaimer:
          'Deterministic duplicate checks and editorial warnings are not semantic verification.',
        blocking: findings.filter((f) => f.severity !== 'warning'),
        reviewWarnings: findings.filter((f) => f.severity === 'warning'),
      },
      null,
      2,
    ),
  );
  if (findings.some((f) => f.severity !== 'warning')) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
