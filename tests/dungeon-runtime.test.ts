import { describe, expect, it } from 'vitest';
import {
  balancedRaidQuotas,
  dungeonAccess,
  planDungeonSession,
} from '../src/features/quiz/dungeonRuntime';
import { configSchema, defaultConfig } from '../src/features/quiz/types';
import {
  topicPerformance,
  initialAdaptiveDifficulty,
  feedbackVisibility,
} from '../src/features/quiz/engine';
import { historyForCredential } from '../src/features/quiz/origins';
import {
  scoreSession,
  cosmeticProgress,
  discoveryProgress,
  historyInsights,
} from '../src/features/results/scoring';
import { dungeon } from './runtime-fixtures';
import { question, result, taxonomy } from './fixtures';

const bank = (id: string, count: number) =>
  Array.from({ length: count }, (_, i) => {
    const domain = taxonomy.domains[i % taxonomy.domains.length];
    return question(`${id}-${i}`, {
      objectiveDomain: domain.id,
      skill: domain.skills[0].id,
      subskill: domain.skills[0].subskills[0],
      difficulty: 'advanced',
    });
  });

describe('credential-aware runtime gates', () => {
  it('refuses every nonactive, unverified, stale and unreadied package without trusting direct callers', () => {
    const base = dungeon();
    expect(dungeonAccess(undefined).allowed).toBe(false);
    for (const status of [
      'retired',
      'retiring',
      'beta',
      'announced',
      'replaced',
      'unverified',
    ] as const) {
      const locked = { ...base, credential: { ...base.credential, status } };
      expect(planDungeonSession([locked], defaultConfig).ok).toBe(false);
    }
    for (const contentReadiness of [
      'stale',
      'validating',
      'unavailable',
    ] as const) {
      expect(
        dungeonAccess({
          ...base,
          credential: { ...base.credential, contentReadiness },
        }).allowed,
      ).toBe(false);
    }
    expect(
      dungeonAccess({
        ...base,
        credential: { ...base.credential, isVerified: false },
      }).allowed,
    ).toBe(false);
    expect(
      dungeonAccess({
        ...base,
        objectiveVersion: 'changed-version',
      }).allowed,
    ).toBe(false);
    expect(
      dungeonAccess({
        ...base,
        readiness: { study: false, gauntlet: true, reasons: [] },
      }).allowed,
    ).toBe(false);
  });

  it('excludes removed objectives, source-newer snapshots and stale/manual questions', () => {
    const fixture = dungeon('dp-700', [
      question('good'),
      question('old-floor', { objectiveDomain: 'removed' }),
      question('old-source', {
        sourceLastReviewedAt: '2026-09-10T00:00:00.000Z',
      }),
      question('stale', { verificationStatus: 'stale' }),
      question('manual', { requiresManualReview: true }),
    ]);
    const selection = planDungeonSession([fixture], defaultConfig);
    expect(selection.ok).toBe(true);
    if (!selection.ok) return;
    expect(selection.plan.questions.map((q) => q.id)).toEqual(['good']);
  });

  it('requires gauntlet readiness even through the legacy exam answer mode and suppresses feedback', () => {
    const limited = dungeon();
    limited.readiness.gauntlet = false;
    expect(
      planDungeonSession([limited], { ...defaultConfig, answerMode: 'exam' })
        .ok,
    ).toBe(false);
    expect(
      planDungeonSession([limited], { ...defaultConfig, runMode: 'gauntlet' })
        .ok,
    ).toBe(false);
    const allowed = planDungeonSession([dungeon()], {
      ...defaultConfig,
      runMode: 'gauntlet',
      answerMode: 'study',
      timerMode: 'session',
      timerSeconds: 600,
      objectiveDomains: ['removed-floor'],
      skills: ['removed-skill'],
      subskills: ['removed-subskill'],
      practiceMode: 'weak',
      order: 'weakest',
    });
    if (!allowed.ok) throw new Error(allowed.warnings.join(' '));
    expect(allowed.plan.config).toMatchObject({
      answerMode: 'exam',
      timerSeconds: 600,
      order: 'balanced',
      objectiveDomains: [],
      skills: [],
      subskills: [],
      practiceMode: 'all',
    });
    expect(feedbackVisibility(allowed.plan.config.answerMode, true)).toEqual({
      explanation: false,
      answer: false,
      sources: false,
      coaching: false,
    });
    const legacy = planDungeonSession([dungeon()], {
      ...defaultConfig,
      answerMode: 'exam',
    });
    if (!legacy.ok) throw new Error(legacy.warnings.join(' '));
    expect(legacy.plan.config.runMode).toBe('gauntlet');
  });
});

describe('balanced multi-dungeon raids', () => {
  it('allows incomplete saved raid drafts but refuses to start them', () => {
    for (const raidCredentialIds of [[], ['dp-700'], ['dp-700', 'dp-700']]) {
      const draft = {
        ...defaultConfig,
        runMode: 'raid' as const,
        raidCredentialIds,
      };
      expect(configSchema.safeParse(draft).success).toBe(true);
      expect(planDungeonSession([dungeon()], draft).ok).toBe(false);
    }
  });

  it('gates raids, uses equal quotas despite uneven banks, and snapshots every origin', () => {
    const a = dungeon('dp-700', bank('dp-700', 90));
    const b = dungeon('other', bank('other', 25));
    const config = {
      ...defaultConfig,
      runMode: 'raid' as const,
      raidCredentialIds: ['dp-700', 'other'],
      questionCount: 11,
    };
    expect(planDungeonSession([a], config).ok).toBe(false);
    expect(balancedRaidQuotas(['dp-700', 'other'], 11)).toEqual({
      'dp-700': 6,
      other: 5,
    });
    const selection = planDungeonSession([a, b], config, [], {}, () => 0.5);
    if (!selection.ok) throw new Error(selection.warnings.join(' '));
    const plan = selection.plan;
    expect(plan.questions).toHaveLength(11);
    const origins = Object.values(plan.questionOrigins);
    expect(origins.filter((o) => o.credentialId === 'dp-700')).toHaveLength(6);
    expect(origins.filter((o) => o.credentialId === 'other')).toHaveLength(5);
    expect(
      origins
        .filter((o) => o.credentialId === 'other')
        .every((origin) => origin.groundedAt === b.manifest.lastGroundedAt),
    ).toBe(true);
    expect(plan.objectiveSnapshots.other).toEqual(b.taxonomy);
    b.taxonomy.domains[0].title = 'Changed after start';
    expect(plan.objectiveSnapshots.other.domains[0].title).not.toBe(
      'Changed after start',
    );
    expect(new Set(plan.questions.map((q) => q.id)).size).toBe(11);
  });

  it('never lets scarce capacity or shared concepts produce domination or repeats', () => {
    const a = dungeon('dp-700', bank('dp-700', 30));
    const b = dungeon('other', bank('other', 3));
    b.questions[0].conceptId = a.questions[0].conceptId;
    const selection = planDungeonSession(
      [a, b],
      {
        ...defaultConfig,
        runMode: 'raid',
        raidCredentialIds: ['dp-700', 'other'],
        questionCount: 20,
      },
      [],
      {},
      () => 0.5,
    );
    if (!selection.ok) throw new Error(selection.warnings.join(' '));
    const counts = Object.values(selection.plan.questionOrigins).reduce<
      Record<string, number>
    >(
      (totals, origin) => ({
        ...totals,
        [origin.credentialId]: (totals[origin.credentialId] ?? 0) + 1,
      }),
      {},
    );
    expect(Math.abs(counts['dp-700'] - counts.other)).toBeLessThanOrEqual(1);
    expect(selection.plan.questions.length).toBeLessThanOrEqual(7);
    expect(new Set(selection.plan.questions.map((q) => q.conceptId)).size).toBe(
      selection.plan.questions.length,
    );
    const collision = dungeon('collision', [a.questions[0]]);
    expect(
      planDungeonSession([a, collision], {
        ...defaultConfig,
        runMode: 'raid',
        raidCredentialIds: ['dp-700', 'collision'],
      }).ok,
    ).toBe(false);
  });

  it('isolates shared floor/skill IDs in scoring, weak practice and adaptive history', () => {
    const a = dungeon('dp-700', bank('dp-700', 15));
    const b = dungeon('other', bank('other', 15));
    const selection = planDungeonSession(
      [a, b],
      {
        ...defaultConfig,
        runMode: 'raid',
        raidCredentialIds: ['dp-700', 'other'],
        questionCount: 30,
      },
      [],
      {},
      () => 0.5,
    );
    if (!selection.ok) throw new Error(selection.warnings.join(' '));
    const plan = selection.plan;
    const session = {
      ...result(
        plan.questions,
        plan.questions
          .filter((q) => q.id.startsWith('dp-700'))
          .map((q) => q.id),
      ),
      ...plan,
    };
    const score = scoreSession(session);
    expect(score.byCredential.find((s) => s.id === 'dp-700')?.percentage).toBe(
      100,
    );
    expect(score.byCredential.find((s) => s.id === 'other')?.percentage).toBe(
      0,
    );
    expect(
      score.bySkill.find((s) => s.id === 'dp-700::security')?.correct,
    ).toBe(5);
    expect(score.bySkill.find((s) => s.id === 'other::security')?.correct).toBe(
      0,
    );
    expect(topicPerformance([session], 'dp-700').get('security')).toEqual({
      total: 5,
      correct: 5,
    });
    expect(topicPerformance([session], 'other').get('security')).toEqual({
      total: 5,
      correct: 0,
    });
    expect(historyForCredential([session], 'other')[0].questions).toHaveLength(
      15,
    );
    expect(
      initialAdaptiveDifficulty([session], {
        ...defaultConfig,
        credentialId: 'dp-700',
      }),
    ).toBe('expert');
    expect(
      initialAdaptiveDifficulty([session], {
        ...defaultConfig,
        credentialId: 'other',
      }),
    ).toBe('intermediate');
    expect(score.byType[0].total).toBe(30);
    expect(
      discoveryProgress(
        [session],
        [
          {
            credentialId: 'dp-700',
            personas: ['data'],
            productAreas: ['Fabric'],
          },
          {
            credentialId: 'other',
            personas: ['network'],
            productAreas: ['Networking'],
          },
        ],
      ).byClass.find((s) => s.id === 'network')?.percentage,
    ).toBe(0);
  });
});

describe('honest snapshot scoring and cosmetics', () => {
  it('does not count an unvisited floor as readiness evidence even at 80% overall', () => {
    const questions = taxonomy.domains.flatMap((domain, index) =>
      Array.from({ length: index ? 5 : 15 }, (_, i) =>
        question(`${domain.id}-${i}`, {
          objectiveDomain: domain.id,
          skill: domain.skills[0].id,
          subskill: domain.skills[0].subskills[0],
          difficulty: 'advanced',
        }),
      ),
    );
    const selection = planDungeonSession([dungeon('dp-700', questions)], {
      ...defaultConfig,
      questionCount: 25,
    });
    if (!selection.ok) throw new Error(selection.warnings.join(' '));
    const session = {
      ...result(
        questions,
        questions.map((q) => q.id),
      ),
      ...selection.plan,
    };
    session.responses = session.responses.filter(
      (r) => !r.questionId.startsWith('monitor'),
    );
    const score = scoreSession(session);
    expect(score).toMatchObject({ percentage: 80, unanswered: 5 });
    expect(score.byDomain.find((d) => d.id === 'monitor')?.insufficient).toBe(
      true,
    );
    expect(score.readiness).toMatchObject({
      ready: false,
      verifiedSampleSize: 20,
    });
  });

  it('compares only sufficiently answered runs on the same objective version', () => {
    const questions = bank('dp-700', 6);
    const selection = planDungeonSession([dungeon('dp-700', questions)], {
      ...defaultConfig,
      questionCount: 6,
    });
    if (!selection.ok) throw new Error(selection.warnings.join(' '));
    const latest = {
      ...result(
        questions,
        questions.map((q) => q.id),
      ),
      ...selection.plan,
    };
    const prior = {
      ...result(
        questions,
        questions.slice(0, 3).map((q) => q.id),
      ),
      ...structuredClone(selection.plan),
      id: 'prior',
      completedAt: '2026-09-11T16:09:00.000Z',
    };
    expect(
      historyInsights([latest, prior], 'dp-700').improvementPercentagePoints,
    ).toBe(50);
    prior.objectiveSnapshots['dp-700'].studyGuideEffectiveDate =
      'Prior fixture version';
    Object.values(prior.questionOrigins).forEach((origin) => {
      origin.objectiveVersion = 'Prior fixture version';
    });
    expect(
      historyInsights([latest, prior], 'dp-700').improvementPercentagePoints,
    ).toBeNull();
  });

  it('does not infer broad class mastery from repeated practice on one fact or tiny improvement samples', () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      ...result([question()], i % 2 ? ['q1'] : []),
      id: `repeat-${i}`,
    }));
    const progress = discoveryProgress(history, [
      {
        credentialId: 'dp-700',
        personas: ['data'],
        productAreas: ['Fabric'],
      },
    ]);
    expect(progress.byClass[0]).toMatchObject({
      total: 10,
      correct: 5,
      uniqueQuestionCount: 1,
      verifiedSampleSize: 1,
      insufficient: true,
    });
    expect(historyInsights(history, 'dp-700')).toMatchObject({
      improvementPercentagePoints: null,
      repeatedErrors: [{ questionId: 'q1', misses: 5 }],
    });
    expect(historyInsights(history, 'other').repeatedErrors).toEqual([]);
  });

  it('labels unpublished weights as a practice heuristic rather than inventing an exam blueprint', () => {
    const fixture = dungeon('dp-700', bank('dp-700', 15));
    fixture.taxonomy.domains.forEach((domain) => {
      domain.weightRange = null;
    });
    const selection = planDungeonSession(
      [fixture],
      {
        ...defaultConfig,
        questionCount: 6,
      },
      [],
      {},
      () => 0.5,
    );
    if (!selection.ok) throw new Error(selection.warnings.join(' '));
    expect(selection.plan.warnings.join(' ')).toContain('practice heuristic');
    for (const domain of fixture.taxonomy.domains)
      expect(
        selection.plan.questions.filter((q) => q.objectiveDomain === domain.id),
      ).toHaveLength(2);
  });
  it('preserves old objective labels and never awards balanced readiness to an easy-heavy run', () => {
    const questions = bank('dp-700', 15);
    const selection = planDungeonSession([dungeon('dp-700', questions)], {
      ...defaultConfig,
      questionCount: 15,
    });
    if (!selection.ok) throw new Error(selection.warnings.join(' '));
    const session = {
      ...result(
        questions,
        questions.map((q) => q.id),
      ),
      ...selection.plan,
    };
    const changed = structuredClone(taxonomy);
    changed.domains[0].title = 'Renamed floor';
    expect(
      scoreSession(session, changed).byDomain.find((s) => s.id === 'manage')
        ?.label,
    ).toBe('Manage');
    expect(scoreSession(session, changed).readiness.ready).toBe(true);
    session.questions = session.questions.map((q) => ({
      ...q,
      difficulty: 'beginner',
    }));
    expect(scoreSession(session, changed).percentage).toBe(100);
    expect(scoreSession(session, changed).readiness.ready).toBe(false);
    expect(
      scoreSession(session, changed).readiness.warnings.join(' '),
    ).toContain('Easy-heavy');
  });

  it('computes deterministic cosmetics only from submitted outcomes without ending a run at zero HP', () => {
    const questions = bank('cosmetic', 20);
    const session = result(
      questions,
      questions.slice(0, 10).map((q) => q.id),
    );
    const progress = cosmeticProgress([session]);
    expect(progress).toMatchObject({
      xp: 100,
      level: 2,
      hp: 0,
      loot: 2,
      cosmeticOnly: true,
    });
    expect(cosmeticProgress([session])).toEqual(progress);
    expect(session.questions).toHaveLength(20);
    expect(cosmeticProgress([{ questions, responses: [] }]).xp).toBe(0);
  });
});
