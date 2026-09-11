import { credentials } from './catalog';
import {
  validateDungeonPackage,
  type DungeonPackage,
  type RawDungeonPackage,
} from './validation';
import type { Credential } from './schema';
import {
  applyRegistryCollisions,
  findQuestionIdCollisions,
  questionIdsFromRaw,
} from './registry';

export { credentials } from './catalog';
export type { Credential } from './schema';
export type { DungeonPackage } from './validation';

const packageFiles = import.meta.glob(
  '../../content/exams/*/{manifest,questions,objectives,sources,verification-reviews,encounter-metadata,personality}.json',
  { eager: true, import: 'default' },
);
const loaded = new Map<string, DungeonPackage>();
const failures = new Map<string, string>();
const personalityExtensions = Object.entries(packageFiles)
  .filter(([path]) => path.endsWith('/personality.json'))
  .map(([, document]) => document);

const folderIds = [
  ...new Set(
    Object.keys(packageFiles)
      .filter((path) => !path.endsWith('/personality.json'))
      .map((path) => path.split('/').at(-2)!),
  ),
];
for (const id of folderIds) {
  const credential = credentials.find((item) => item.credentialId === id);
  if (!credential) {
    failures.set(id, 'Package has no catalog entry.');
    continue;
  }
  const read = (file: string) =>
    packageFiles[`../../content/exams/${id}/${file}.json`];
  const raw: RawDungeonPackage = {
    packageManifest: read('manifest'),
    questions: read('questions'),
    taxonomy: read('objectives'),
    manifest: read('sources'),
    reviews: read('verification-reviews'),
    encounterMetadata: read('encounter-metadata'),
    personality: read('personality'),
  };
  try {
    loaded.set(id, validateDungeonPackage(credential, raw));
  } catch (error) {
    failures.set(id, error instanceof Error ? error.message : String(error));
  }
}
const collisions = findQuestionIdCollisions(
  folderIds.map((id) => ({
    credentialId: id,
    questionIds: questionIdsFromRaw(
      packageFiles[`../../content/exams/${id}/questions.json`],
    ),
  })),
);
for (const [id, dungeon] of loaded)
  loaded.set(id, applyRegistryCollisions(dungeon, collisions));

export function getDungeonPackage(id: string): DungeonPackage | undefined {
  return loaded.get(id);
}

export function getDungeonPersonalityExtensions(): unknown[] {
  return personalityExtensions;
}

export function listDungeons(): (Credential & {
  readiness: DungeonPackage['readiness'];
})[] {
  return credentials.map((credential) => {
    const dungeon = loaded.get(credential.credentialId);
    return {
      ...credential,
      verifiedQuestionCount: dungeon?.questions.length ?? 0,
      readiness: dungeon?.readiness ?? {
        study: false,
        gauntlet: false,
        reasons: [
          failures.get(credential.credentialId) ??
            credential.sealedReason ??
            'Sealed dungeon — no independently verified encounter package is installed.',
        ],
      },
    };
  });
}
