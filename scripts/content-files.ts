import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { credentials } from '../src/features/dungeons/catalog';
import {
  validateDungeonPackage,
  type RawDungeonPackage,
} from '../src/features/dungeons/validation';
import {
  applyRegistryCollisions,
  findQuestionIdCollisions,
  questionIdsFromRaw,
} from '../src/features/dungeons/registry';

export function argument(name: string) {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--'))
    throw new Error(`${name} requires a value.`);
  return value;
}

export function examId(value = argument('--exam') ?? 'dp-700'): string {
  if (!credentials.some((credential) => credential.credentialId === value))
    throw new Error(
      `Unknown credential ${value}. Use a catalog credentialId; no arbitrary package paths are permitted.`,
    );
  return value;
}

export function examDirectory(id = examId()): string {
  return resolve('src', 'content', 'exams', examId(id));
}

export async function readJsonFile(path: string | URL): Promise<unknown> {
  return JSON.parse(
    (await readFile(path, 'utf8')).replace(/^\uFEFF/, ''),
  ) as unknown;
}

export async function packageIds(): Promise<string[]> {
  const root = resolve('src', 'content', 'exams');
  const directories = (await readdir(root, { withFileTypes: true })).filter(
    (entry) => entry.isDirectory(),
  );
  const packages: string[] = [];
  for (const directory of directories) {
    const files = await readdir(resolve(root, directory.name));
    const themeOnly = files.length === 1 && files[0] === 'personality.json';
    if (
      !themeOnly ||
      !credentials.some((entry) => entry.credentialId === directory.name)
    )
      packages.push(directory.name);
  }
  return packages.sort();
}

export async function readRawPackage(
  id = examId(),
): Promise<RawDungeonPackage> {
  const directory = examDirectory(id);
  const files = [
    'manifest',
    'questions',
    'objectives',
    'sources',
    'verification-reviews',
    'encounter-metadata',
    'personality',
  ];
  const [
    packageManifest,
    questions,
    taxonomy,
    manifest,
    reviews,
    encounterMetadata,
    personality,
  ] = await Promise.all(
    files.map((file) => readJsonFile(resolve(directory, `${file}.json`))),
  );
  return {
    packageManifest,
    questions,
    taxonomy,
    manifest,
    reviews,
    encounterMetadata,
    personality,
  };
}

export async function loadDungeonPackage(id = examId()) {
  const credential = credentials.find(
    (item) => item.credentialId === examId(id),
  )!;
  return applyRegistryCollisions(
    validateDungeonPackage(credential, await readRawPackage(id)),
    await registryCollisions(),
  );
}

export async function registryCollisions() {
  const packages = await Promise.all(
    (await packageIds()).map(async (id) => {
      let questions: unknown;
      try {
        questions = await readJsonFile(
          resolve('src', 'content', 'exams', id, 'questions.json'),
        );
      } catch {
        // The all-package gate reports malformed/missing files; they cannot supply playable IDs.
        questions = undefined;
      }
      return { credentialId: id, questionIds: questionIdsFromRaw(questions) };
    }),
  );
  return findQuestionIdCollisions(packages);
}
