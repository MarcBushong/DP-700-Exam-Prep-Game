import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { validateContent } from '../src/features/grounding/schema';

export async function loadContent() {
  const files = [
    'questions.json',
    'grounding-manifest.json',
    'objectives.json',
  ];
  const [questions, manifest, taxonomy] = await Promise.all(
    files.map(
      async (file) =>
        JSON.parse(
          await readFile(
            new NodeURL(`../src/data/${file}`, import.meta.url),
            'utf8',
          ),
        ) as unknown,
    ),
  );
  return validateContent(questions, manifest, taxonomy);
}

export function isMain(url: string) {
  return (
    Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(url)
  );
}

if (isMain(import.meta.url)) {
  try {
    const { questions, manifest, taxonomy } = await loadContent();
    console.log(
      `Content valid: ${questions.length} original questions, ${manifest.sources.length} sources, ${taxonomy.domains.length} objective domains.`,
    );
    console.log(
      'Structural validation passed. This does not independently verify documentation claims or current feature status.',
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
