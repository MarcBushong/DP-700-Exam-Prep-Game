import { describe, expect, it } from 'vitest';
import {
  credentials,
  getDungeonPackage,
  getDungeonPersonalityExtensions,
  listDungeons,
} from '../src/features/dungeons/packages';
import { packageIds } from '../scripts/content-files';
import { content } from '../src/features/grounding/content';
import {
  mergeCatalog,
  reactionCatalog,
} from '../src/features/personality/catalog';

describe('eager package registry', () => {
  it('loads all theme extensions without turning sealed personality-only directories into encounter packages', async () => {
    const extensions = getDungeonPersonalityExtensions();
    expect(extensions).toHaveLength(18);
    expect(getDungeonPersonalityExtensions()).toBe(extensions);
    expect(mergeCatalog(reactionCatalog, extensions)).toHaveLength(
      reactionCatalog.length + 36,
    );
    const installed = await packageIds();
    for (const credential of credentials)
      if (!installed.includes(credential.credentialId))
        expect(getDungeonPackage(credential.credentialId)).toBeUndefined();
  });
  it('loads the preserved package and exposes only one DP-700 compatibility instance', () => {
    const dungeon = getDungeonPackage('dp-700');
    expect(dungeon).toBeDefined();
    expect(content).toBe(dungeon);
    expect(dungeon!.credential.credentialId).toBe('dp-700');
    expect(dungeon!.allQuestions.length).toBeGreaterThanOrEqual(150);
    expect(dungeon!.objectiveVersion).toBe(
      dungeon!.taxonomy.studyGuideEffectiveDate,
    );
    expect(getDungeonPackage('unknown-dungeon')).toBeUndefined();
  });
  it('keeps sealed catalog entries visible without advertising available encounters', () => {
    const list = listDungeons();
    expect(list).toHaveLength(credentials.length);
    for (const entry of list) {
      const dungeon = getDungeonPackage(entry.credentialId);
      expect(entry.verifiedQuestionCount).toBe(dungeon?.questions.length ?? 0);
      if (!entry.isVerified || entry.status !== 'active') {
        expect(entry.readiness.study).toBe(false);
        expect(entry.readiness.gauntlet).toBe(false);
      }
      if (!dungeon) expect(entry.readiness.reasons.length).toBeGreaterThan(0);
    }
  });
});
