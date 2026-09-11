import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  inspectContent,
  validateContent,
} from '../src/features/grounding/schema';
import { credentials } from '../src/features/dungeons/catalog';
import {
  validateDungeonPackage,
  type DungeonPackage,
} from '../src/features/dungeons/validation';
import {
  argument,
  examDirectory,
  examId,
  readJsonFile,
  readRawPackage,
  registryCollisions,
} from './content-files';
import { applyRegistryCollisions } from '../src/features/dungeons/registry';
export { argument, readJsonFile } from './content-files';

export async function loadRawContent() {
  const files = ['questions.json', 'sources.json', 'objectives.json'];
  const [questions, manifest, taxonomy] = await Promise.all(
    files.map((file, index) =>
      readJsonFile(
        argument(['--questions', '--manifest', '--taxonomy'][index]) ??
          resolve(examDirectory(), file),
      ),
    ),
  );
  return { questions, manifest, taxonomy };
}

export async function loadContent(
  diagnostic = false,
): Promise<DungeonPackage | ReturnType<typeof inspectContent>> {
  const { questions, manifest, taxonomy } = await loadRawContent();
  const credential = credentials.find(
    (entry) => entry.credentialId === examId(),
  )!;
  if (!argument('--questions')) {
    const dungeon = applyRegistryCollisions(
      validateDungeonPackage(credential, {
        ...(await readRawPackage()),
        questions,
        manifest,
        taxonomy,
      }),
      await registryCollisions(),
    );
    if (!diagnostic) {
      const failures = dungeon.findings.filter(
        (finding) => finding.severity !== 'warning',
      );
      if (failures.length)
        throw new Error(failures.map((finding) => finding.message).join('\n'));
    }
    return dungeon;
  }
  return (diagnostic ? inspectContent : validateContent)(
    questions,
    manifest,
    taxonomy,
    credential,
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
