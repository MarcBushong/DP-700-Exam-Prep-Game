import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import {
  inspectContent,
  validateContent,
} from '../src/features/grounding/schema';

export function argument(name: string) {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--'))
    throw new Error(`${name} requires a value.`);
  return value;
}

export async function readJsonFile(path: string | URL): Promise<unknown> {
  return JSON.parse(
    (await readFile(path, 'utf8')).replace(/^\uFEFF/, ''),
  ) as unknown;
}

export async function loadRawContent() {
  const files = [
    'questions.json',
    'grounding-manifest.json',
    'objectives.json',
  ];
  const [questions, manifest, taxonomy] = await Promise.all(
    files.map((file, index) =>
      readJsonFile(
        argument(['--questions', '--manifest', '--taxonomy'][index]) ??
          new NodeURL(`../src/data/${file}`, import.meta.url),
      ),
    ),
  );
  return { questions, manifest, taxonomy };
}

export async function loadContent(diagnostic = false) {
  const { questions, manifest, taxonomy } = await loadRawContent();
  return (diagnostic ? inspectContent : validateContent)(
    questions,
    manifest,
    taxonomy,
  );
}

export function isMain(url: string) {
  return (
    Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(url)
  );
}

if (isMain(import.meta.url)) {
  try {
    const { questions, allQuestions, manifest, taxonomy, findings } =
      await loadContent();
    console.log(
      `Content valid: ${allQuestions.length} candidate records; ${questions.length} playable verified; ${allQuestions.length - questions.length} excluded; ${manifest.sources.length} sources, ${taxonomy.domains.length} objective domains.`,
    );
    for (const finding of findings)
      console.log(`${finding.severity}: ${finding.message}`);
    console.log(
      'Structural validation passed. This does not independently verify documentation claims or current feature status.',
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
