import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  buildContentReport,
  reportMarkdown,
} from '../src/features/grounding/report';
import { argument, isMain, loadContent } from './validate-questions';
import { examDirectory } from './content-files';

export async function buildReportData() {
  const content = await loadContent(true);
  return buildContentReport(
    content,
    undefined,
    'packageManifest' in content
      ? content.packageManifest.readinessThresholds
      : undefined,
  );
}

export async function buildReport() {
  return reportMarkdown(await buildReportData());
}

export async function runReport() {
  const report = await buildReportData();
  if (process.argv.includes('--write')) {
    const output = resolve(argument('--output') ?? examDirectory());
    await mkdir(output, { recursive: true });
    for (const [name, text] of [
      ['content-coverage.md', reportMarkdown(report)],
      ['question-bank-report.json', `${JSON.stringify(report, null, 2)}\n`],
    ]) {
      const file = resolve(output, name);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, text);
      console.log(`Wrote ${file}`);
    }
  } else {
    console.log(
      process.argv.includes('--json')
        ? JSON.stringify(report, null, 2)
        : reportMarkdown(report),
    );
  }
  if (report.findingCounts.errors || report.findingCounts.blocking)
    process.exitCode = 1;
}

if (isMain(import.meta.url)) {
  try {
    await runReport();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
