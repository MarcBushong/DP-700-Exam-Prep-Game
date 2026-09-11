import type { Credential, DungeonReadiness } from '../dungeons/schema';
import {
  isPlayableQuestion,
  type GroundingManifest,
  type Question,
  type Taxonomy,
} from '../grounding/schema';
import { eligibleQuestions, selectQuestions, shuffle } from './engine';
import {
  configSchema,
  type QuestionOrigin,
  type QuizConfig,
  type SessionResult,
} from './types';
import { LEGACY_CREDENTIAL_ID } from './origins';

export interface RuntimeDungeon {
  credential: Credential;
  questions: Question[];
  taxonomy: Taxonomy;
  manifest: GroundingManifest;
  readiness: DungeonReadiness;
  objectiveVersion: string;
}

export function dungeonAccess(
  dungeon: RuntimeDungeon | undefined,
  gauntlet = false,
): { allowed: boolean; reasons: string[] } {
  if (!dungeon)
    return {
      allowed: false,
      reasons: ['Sealed dungeon — no verified package is available.'],
    };
  const { credential, readiness } = dungeon;
  const reasons: string[] = [];
  if (!credential.isVerified || credential.status !== 'active')
    reasons.push(
      credential.sealedReason ??
        'Only verified active dungeons can be entered.',
    );
  if (!['ready', 'limited'].includes(credential.contentReadiness))
    reasons.push(
      `This dungeon is ${credential.contentReadiness}; independent validation is required.`,
    );
  if (
    !credential.objectiveVersion ||
    credential.objectiveVersion !== dungeon.objectiveVersion
  )
    reasons.push(
      'The dungeon objective version changed. Its encounters require independent re-review.',
    );
  if (!readiness.study) reasons.push('Torchlight readiness has not been met.');
  if (gauntlet && !readiness.gauntlet)
    reasons.push('Boss Gauntlet readiness has not been met.');
  if (reasons.length) reasons.push(...readiness.reasons);
  return { allowed: !reasons.length, reasons: [...new Set(reasons)] };
}

function currentQuestions(dungeon: RuntimeDungeon): Question[] {
  return dungeon.questions.filter((q) => {
    if (!isPlayableQuestion(q)) return false;
    const skill = dungeon.taxonomy.domains
      .find((d) => d.id === q.objectiveDomain)
      ?.skills.find((s) => s.id === q.skill);
    if (!skill?.subskills.includes(q.subskill)) return false;
    return q.sourceIds.every((id) => {
      const source = dungeon.manifest.sources.find((s) => s.sourceId === id);
      return (
        source &&
        Date.parse(source.lastReviewedAt) <=
          Date.parse(q.sourceLastReviewedAt ?? '')
      );
    });
  });
}

export function balancedRaidQuotas(
  ids: string[],
  count: number,
): Record<string, number> {
  const unique = [...new Set(ids)];
  if (!unique.length || !Number.isInteger(count) || count < unique.length)
    return {};
  return Object.fromEntries(
    unique.map((id, index) => [
      id,
      Math.floor(count / unique.length) + Number(index < count % unique.length),
    ]),
  );
}

interface SelectionPlan {
  config: QuizConfig;
  questions: Question[];
  questionOrigins: Record<string, QuestionOrigin>;
  objectiveSnapshots: Record<string, Taxonomy>;
  credentialId: string;
  groundedAt: string;
  warnings: string[];
}

export type DungeonSessionPlan =
  { ok: true; plan: SelectionPlan } | { ok: false; warnings: string[] };

export function planDungeonSession(
  packages: (RuntimeDungeon | undefined)[],
  input: QuizConfig,
  history: SessionResult[] = [],
  recentByCredential: Record<string, string[]> = {},
  random: () => number = Math.random,
  retryIds?: ReadonlySet<string>,
): DungeonSessionPlan {
  const parsed = configSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, warnings: ['Invalid expedition configuration.'] };
  const config: QuizConfig = {
    ...parsed.data,
    credentialId: parsed.data.credentialId ?? LEGACY_CREDENTIAL_ID,
    runMode: parsed.data.runMode ?? 'study',
  };
  const raid = config.runMode === 'raid';
  const gauntlet =
    config.runMode === 'gauntlet' || config.answerMode === 'exam';
  if (gauntlet) {
    config.answerMode = 'exam';
    config.order = 'balanced';
    config.objectiveDomains = [];
    config.skills = [];
    config.subskills = [];
    config.practiceMode = 'all';
    if (!raid) config.runMode = 'gauntlet';
  }
  const requestedIds = raid
    ? [...new Set(config.raidCredentialIds ?? [])]
    : [config.credentialId!];
  if (
    raid &&
    (requestedIds.length < 2 || config.questionCount < requestedIds.length)
  )
    return {
      ok: false,
      warnings: [
        'A raid needs at least two open dungeons and one encounter from each.',
      ],
    };
  if (raid) {
    config.objectiveDomains = [];
    config.skills = [];
    config.subskills = [];
    config.raidCredentialIds = requestedIds;
  }
  const dungeons: RuntimeDungeon[] = [];
  for (const id of requestedIds) {
    const dungeon = packages.find((p) => p?.credential.credentialId === id);
    const access = dungeonAccess(dungeon, gauntlet);
    if (!access.allowed || !dungeon)
      return {
        ok: false,
        warnings: access.reasons.map((reason) => `${id}: ${reason}`),
      };
    dungeons.push(dungeon);
  }
  // Global IDs identify saved answers, so a collision must fail rather than
  // silently score one credential's answer against another credential's question.
  const ids = dungeons.flatMap((d) => d.questions.map((q) => q.id));
  if (new Set(ids).size !== ids.length)
    return {
      ok: false,
      warnings: [
        'Question ID collision across the selected packages. The raid is blocked.',
      ],
    };
  const warnings: string[] = [];
  if (gauntlet)
    warnings.push(
      'Gauntlet timing uses your configured practice timer, not an official exam duration.',
    );
  const pools = dungeons.map((dungeon) => {
    const bank = currentQuestions(dungeon).filter(
      (q) => !retryIds || retryIds.has(q.id),
    );
    const ownConfig: QuizConfig = {
      ...config,
      credentialId: dungeon.credential.credentialId,
      ...(raid ? { objectiveDomains: [], skills: [], subskills: [] } : {}),
    };
    return { dungeon, bank, config: ownConfig };
  });
  if (retryIds) {
    const available = new Set(pools.flatMap((p) => p.bank.map((q) => q.id)));
    const unavailable = [...retryIds].filter((id) => !available.has(id)).length;
    if (unavailable)
      warnings.push(
        `${unavailable} missed question(s) are no longer verified and available in the current bank, and cannot be retried.`,
      );
  }
  let questions: Question[] = [];
  if (!raid) {
    const pool = pools[0];
    const selection = selectQuestions(
      pool.bank,
      pool.dungeon.taxonomy,
      config,
      history,
      random,
      recentByCredential[pool.dungeon.credential.credentialId],
    );
    questions = selection.questions;
    warnings.push(...selection.warnings);
  } else {
    const ordered = shuffle(pools, random);
    for (let count = config.questionCount; count >= ordered.length; count--) {
      const quotas = balancedRaidQuotas(
        ordered.map((p) => p.dungeon.credential.credentialId),
        count,
      );
      const allocationWarnings: string[] = [];
      const candidates = ordered.map((pool) => {
        const selection = selectQuestions(
          pool.bank,
          pool.dungeon.taxonomy,
          {
            ...pool.config,
            questionCount: quotas[pool.dungeon.credential.credentialId],
          },
          history,
          random,
          recentByCredential[pool.dungeon.credential.credentialId],
        );
        const preferred = selection.questions;
        allocationWarnings.push(
          ...selection.warnings.map(
            (warning) => `${pool.dungeon.credential.credentialId}: ${warning}`,
          ),
        );
        const preferredIds = new Set(preferred.map((q) => q.id));
        return [
          ...preferred,
          ...shuffle(
            eligibleQuestions(pool.bank, pool.config, history),
            random,
          ).filter((q) => !preferredIds.has(q.id)),
        ];
      });
      const slots: number[] = [];
      for (let round = 0; slots.length < count; round++) {
        ordered.forEach((pool, index) => {
          if (round < quotas[pool.dungeon.credential.credentialId])
            slots.push(index);
        });
      }
      const owner = new Map<string, number>();
      const assigned: Question[] = [];
      const assign = (slot: number, visited = new Set<string>()): boolean => {
        const choices = [...candidates[slots[slot]]].sort(
          (a, b) =>
            Number(owner.has(a.conceptId!.trim().toLowerCase())) -
            Number(owner.has(b.conceptId!.trim().toLowerCase())),
        );
        for (const question of choices) {
          const key = question.conceptId!.trim().toLowerCase();
          if (visited.has(key)) continue;
          visited.add(key);
          const previous = owner.get(key);
          if (previous === undefined || assign(previous, visited)) {
            owner.set(key, slot);
            assigned[slot] = question;
            return true;
          }
        }
        return false;
      };
      if (!slots.every((_, slot) => assign(slot))) continue;
      questions = assigned.map((q) => ({
        ...q,
        answerChoices:
          q.questionType === 'true-false'
            ? [...q.answerChoices]
            : shuffle(q.answerChoices, random),
      }));
      warnings.push(...allocationWarnings);
      if (count !== config.questionCount)
        warnings.push(
          `Only ${count} distinct encounters can keep this raid balanced. No dungeon is allowed to dominate.`,
        );
      break;
    }
    warnings.push(
      'Raid quotas are equal (within one encounter) per dungeon. Floor filters are reset; difficulty, complexity, and type filters still apply.',
    );
    warnings.push(
      'Each dungeon prefers its published floor mix where available; shared-concept constraints can change that mix. Raid scores are in-game estimates, not an exam simulation.',
    );
  }
  if (!questions.length)
    return {
      ok: false,
      warnings: [
        ...warnings,
        'No verified encounters can satisfy this expedition. Broaden the filters or choose another open dungeon.',
      ],
    };
  const questionOrigins: Record<string, QuestionOrigin> = {};
  for (const dungeon of dungeons) {
    const ownIds = new Set(dungeon.questions.map((q) => q.id));
    for (const q of questions)
      if (ownIds.has(q.id))
        questionOrigins[q.id] = {
          credentialId: dungeon.credential.credentialId,
          objectiveVersion: dungeon.objectiveVersion,
          groundedAt: dungeon.manifest.lastGroundedAt,
        };
  }
  return {
    ok: true,
    plan: {
      config,
      questions,
      questionOrigins,
      objectiveSnapshots: Object.fromEntries(
        dungeons.map((d) => [
          d.credential.credentialId,
          structuredClone(d.taxonomy),
        ]),
      ),
      credentialId: config.credentialId!,
      groundedAt: dungeons.map((d) => d.manifest.lastGroundedAt).sort()[0],
      warnings,
    },
  };
}
