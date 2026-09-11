import type { DungeonPackage } from './validation';

export interface QuestionIdCollision {
  questionId: string;
  credentialIds: string[];
}

export function questionIdsFromRaw(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((record: unknown) =>
    record &&
    typeof record === 'object' &&
    'id' in record &&
    typeof record.id === 'string'
      ? [record.id]
      : [],
  );
}

export function findQuestionIdCollisions(
  packages: { credentialId: string; questionIds: string[] }[],
): QuestionIdCollision[] {
  const owners = new Map<string, Set<string>>();
  for (const dungeon of packages)
    for (const id of dungeon.questionIds) {
      const existing = owners.get(id) ?? new Set<string>();
      existing.add(dungeon.credentialId);
      owners.set(id, existing);
    }
  return [...owners.entries()]
    .filter(([, credentialIds]) => credentialIds.size > 1)
    .map(([questionId, credentialIds]) => ({
      questionId,
      credentialIds: [...credentialIds].sort(),
    }));
}

export function applyRegistryCollisions(
  dungeon: DungeonPackage,
  collisions: QuestionIdCollision[],
): DungeonPackage {
  const relevant = collisions.filter((collision) =>
    collision.credentialIds.includes(dungeon.credential.credentialId),
  );
  if (!relevant.length) return dungeon;
  const findings = relevant.map((collision) => ({
    code: 'cross-dungeon-question-id',
    category: 'schema' as const,
    severity: 'error' as const,
    questionIds: [collision.questionId],
    message: `${collision.questionId}: question IDs must be globally unique; found in ${collision.credentialIds.join(', ')}.`,
  }));
  return {
    ...dungeon,
    questions: [],
    findings: [...dungeon.findings, ...findings],
    readiness: {
      study: false,
      gauntlet: false,
      reasons: [
        ...dungeon.readiness.reasons,
        ...findings.map((finding) => finding.message),
      ],
    },
  };
}
