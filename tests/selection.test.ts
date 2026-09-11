import { describe, expect, it } from 'vitest';
import type { Question } from '../src/features/grounding/schema';
import {
  adaptiveDifficulty,
  advanceSession,
  eligibleQuestions,
  initialAdaptiveDifficulty,
  isCorrect,
  makeResponse,
  selectQuestions,
} from '../src/features/quiz/engine';
import { defaultConfig } from '../src/features/quiz/types';
import { active, question, result, taxonomy } from './fixtures';

function random(seed = 42) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function domainBank(capacities = [20, 20, 20]) {
  return taxonomy.domains.flatMap((domain, index) =>
    Array.from({ length: capacities[index] }, (_, i) =>
      question(`${domain.id}-${i}`, {
        objectiveDomain: domain.id,
        skill: domain.skills[0].id,
        subskill: domain.skills[0].subskills[0],
      }),
    ),
  );
}

const domainCounts = (questions: Question[]) =>
  taxonomy.domains.map(
    (domain) =>
      questions.filter((question) => question.objectiveDomain === domain.id)
        .length,
  );

describe('verified, diverse selection', () => {
  it('excludes every nonverified status and verified records still needing review', () => {
    const bank = [
      question('verified'),
      question('manual', { verificationStatus: 'manual-review-required' }),
      question('rejected', { verificationStatus: 'rejected' }),
      question('stale', { verificationStatus: 'stale' }),
      question('flagged', { requiresManualReview: true }),
    ];
    expect(eligibleQuestions(bank, defaultConfig).map((q) => q.id)).toEqual([
      'verified',
    ]);
  });

  it('deduplicates IDs and concepts before disclosing the effective eligible count', () => {
    const first = question('first', { conceptId: 'shared-concept' });
    const bank = [
      first,
      first,
      question('variant', { conceptId: 'SHARED-CONCEPT' }),
      question('different'),
    ];
    const selection = selectQuestions(bank, taxonomy, defaultConfig);
    expect(selection.eligibleCount).toBe(2);
    expect(selection.questions).toHaveLength(2);
    expect(new Set(selection.questions.map((q) => q.id)).size).toBe(2);
    expect(selection.warnings.join(' ')).toMatch(/distinct concepts/);
    expect(selection.warnings.join(' ')).toMatch(/Near-duplicate/);
  });

  it.each(['advanced', 'expert'] as const)(
    'keeps %s, complexity, format and objective filters',
    (difficulty) => {
      const matching = question('matching', {
        difficulty,
        complexity: 'troubleshooting',
        questionType: 'code',
        codeLanguage: 'sql',
        codeSnippet: 'SELECT 1;',
      });
      const selection = selectQuestions(
        [
          matching,
          question('wrong-complexity', { difficulty }),
          question('wrong-level', { complexity: 'troubleshooting' }),
          question('wrong-domain', {
            ...matching,
            id: 'wrong-domain',
            objectiveDomain: 'ingest',
          }),
        ],
        taxonomy,
        {
          ...defaultConfig,
          difficulty,
          complexity: 'troubleshooting',
          format: 'code',
          objectiveDomains: ['manage'],
        },
      );
      expect(selection.questions.map((q) => q.id)).toEqual(['matching']);
    },
  );

  it('maximizes unseen choices within the weighted domain quotas', () => {
    const bank = domainBank([8, 8, 8]);
    const seen = bank
      .filter((q) => !q.id.endsWith('-7') && !q.id.endsWith('-6'))
      .map((q) => q.id);
    const selection = selectQuestions(
      bank,
      taxonomy,
      { ...defaultConfig, questionCount: 6 },
      [],
      random(),
      seen,
    );
    expect(domainCounts(selection.questions)).toEqual([2, 2, 2]);
    expect(selection.questions.every((q) => !seen.includes(q.id))).toBe(true);
  });

  it('reuses older shown questions once unseen candidates cannot fill the request', () => {
    const bank = domainBank([8, 0, 0]);
    const recent = bank.slice(0, 6).map((q) => q.id);
    const selection = selectQuestions(
      bank,
      taxonomy,
      {
        ...defaultConfig,
        objectiveDomains: ['manage'],
        questionCount: 5,
        difficulty: 'intermediate',
      },
      [],
      random(),
      recent,
    );
    expect(new Set(selection.questions.map((q) => q.id))).toEqual(
      new Set(['manage-6', 'manage-7', 'manage-5', 'manage-4', 'manage-3']),
    );
    expect(selection.questions).toHaveLength(5);
  });

  it('prefers unseen membership without misrepresenting study-guide presentation order', () => {
    const bank = domainBank([8, 8, 8]);
    const recent = bank.filter((q) => !q.id.endsWith('-7')).map((q) => q.id);
    const selection = selectQuestions(
      bank,
      taxonomy,
      {
        ...defaultConfig,
        questionCount: 3,
        order: 'study-guide',
      },
      [],
      random(),
      recent,
    );
    expect(selection.questions.map((q) => q.id)).toEqual([
      'manage-7',
      'ingest-7',
      'monitor-7',
    ]);
  });

  it('uses seeded choice shuffling without changing multi-select correctness or mutating source data', () => {
    const multi = question('multi', {
      questionType: 'multi-select',
      correctAnswer: ['a', 'c'],
      whyOtherAnswersAreWrong: { b: 'Synthetic incorrect answer.' },
    });
    const before = structuredClone(multi);
    const select = () =>
      selectQuestions(
        [multi],
        taxonomy,
        {
          ...defaultConfig,
          questionCount: 1,
        },
        [],
        () => 0,
      ).questions[0];
    const shuffled = select();
    expect(shuffled.answerChoices.map((choice) => choice.id)).toEqual([
      'b',
      'c',
      'a',
    ]);
    expect(isCorrect(shuffled, ['c', 'a'])).toBe(true);
    expect(isCorrect(shuffled, ['b', 'c'])).toBe(false);
    expect(select()).toEqual(shuffled);
    expect(multi).toEqual(before);
  });
});

describe('weighted quotas and capacity', () => {
  it.each([20, 30, 50])(
    'keeps integer allocations inside the current ranges for %i questions',
    (questionCount) => {
      const selection = selectQuestions(
        domainBank(),
        taxonomy,
        {
          ...defaultConfig,
          questionCount,
        },
        [],
        random(),
      );
      for (const count of domainCounts(selection.questions)) {
        expect(count / questionCount).toBeGreaterThanOrEqual(0.3);
        expect(count / questionCount).toBeLessThanOrEqual(0.35);
      }
      expect(selection.warnings).toEqual([]);
    },
  );

  it('renormalizes published ranges when only selected domains are practiced', () => {
    const selection = selectQuestions(domainBank(), taxonomy, {
      ...defaultConfig,
      questionCount: 10,
      objectiveDomains: ['manage', 'monitor'],
    });
    expect(domainCounts(selection.questions)).toEqual([5, 0, 5]);
    expect(selection.warnings).toEqual([]);
  });

  it('honors asymmetric taxonomy weights rather than hard-coded equal thirds', () => {
    const weighted = structuredClone(taxonomy);
    weighted.domains[0].weightRange = [50, 60];
    weighted.domains[1].weightRange = [25, 30];
    weighted.domains[2].weightRange = [15, 20];
    const selection = selectQuestions(domainBank(), weighted, {
      ...defaultConfig,
      questionCount: 20,
    });
    expect(domainCounts(selection.questions)).toEqual([11, 6, 3]);
    expect(selection.warnings).toEqual([]);
  });

  it('redistributes sparse-domain capacity, fills the session, and discloses the range shortfall', () => {
    const selection = selectQuestions(domainBank([1, 20, 20]), taxonomy, {
      ...defaultConfig,
      questionCount: 20,
    });
    const counts = domainCounts(selection.questions);
    expect(selection.questions).toHaveLength(20);
    expect(counts[0]).toBe(1);
    expect(Math.abs(counts[1] - counts[2])).toBeLessThanOrEqual(1);
    expect(selection.warnings.join(' ')).toMatch(
      /weight ranges are not possible/,
    );
  });

  it('discloses integer rounding when a tiny count cannot fit the published ranges', () => {
    const selection = selectQuestions(domainBank(), taxonomy, {
      ...defaultConfig,
      questionCount: 10,
    });
    expect(domainCounts(selection.questions)).toEqual([4, 3, 3]);
    expect(selection.warnings.join(' ')).toMatch(/question count/);
  });

  it('assigns a cross-domain concept to the domain that needs it without violating quotas', () => {
    const bank = domainBank([2, 1, 2]);
    bank.push(
      question('shared-manage', {
        conceptId: 'shared',
        objectiveDomain: 'manage',
      }),
      question('shared-ingest', {
        conceptId: 'shared',
        objectiveDomain: 'ingest',
        skill: 'batch',
        subskill: 'Loading',
      }),
    );
    const selection = selectQuestions(
      bank,
      taxonomy,
      {
        ...defaultConfig,
        questionCount: 6,
      },
      [],
      random(),
    );
    expect(domainCounts(selection.questions)).toEqual([2, 2, 2]);
    expect(selection.questions.find((q) => q.conceptId === 'shared')?.id).toBe(
      'shared-ingest',
    );
    expect(selection.warnings.join(' ')).not.toMatch(/weight ranges/);
  });

  it('keeps seeded random order distinct from weighted allocation', () => {
    const config = {
      ...defaultConfig,
      questionCount: 6,
      order: 'random' as const,
    };
    const bank = domainBank([20, 2, 2]);
    const first = selectQuestions(bank, taxonomy, config, [], random());
    const repeated = selectQuestions(bank, taxonomy, config, [], random());
    expect(first).toEqual(repeated);
    expect(first.warnings.join(' ')).not.toMatch(/weighted/);
  });

  it('protects domain minimums when recent shared concepts require a different feasible apportionment', () => {
    const weighted = structuredClone(taxonomy);
    weighted.domains[0].weightRange = [50, 60];
    weighted.domains[1].weightRange = [25, 30];
    weighted.domains[2].weightRange = [15, 20];
    const bank = domainBank([12, 0, 0]);
    bank.push(
      ...Array.from({ length: 6 }, (_, i) =>
        question(`ingest-shared-${i}`, {
          objectiveDomain: 'ingest',
          skill: 'batch',
          subskill: 'Loading',
          conceptId: `shared-${i}`,
        }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        question(`monitor-shared-${i + 3}`, {
          objectiveDomain: 'monitor',
          skill: 'performance',
          subskill: 'Tuning',
          conceptId: `shared-${i + 3}`,
        }),
      ),
    );
    const recent = bank
      .filter((q) => q.objectiveDomain === 'monitor')
      .map((q) => q.id);
    const selection = selectQuestions(
      bank,
      weighted,
      { ...defaultConfig, questionCount: 20 },
      [],
      random(),
      recent,
    );
    expect(domainCounts(selection.questions)).toEqual([12, 5, 3]);
    expect(selection.warnings.join(' ')).not.toMatch(/weight ranges/);
    expect(new Set(selection.questions.map((q) => q.conceptId)).size).toBe(20);
  });
});

describe('sustained adaptive evidence', () => {
  const responses = (questions: Question[], outcomes: boolean[]) =>
    outcomes.map((correct, i) =>
      makeResponse(questions[i], [correct ? 'a' : 'b'], false, 0, 100),
    );

  it('starts near intermediate, including one-question sessions across selection modes', () => {
    const bank = [
      question('easy', { difficulty: 'beginner' }),
      question('expert', { difficulty: 'expert' }),
      question('middle'),
    ];
    for (const order of [
      'balanced',
      'random',
      'study-guide',
      'weakest',
    ] as const)
      expect(
        selectQuestions(
          bank,
          taxonomy,
          { ...defaultConfig, questionCount: 1, order },
          [],
          random(),
        ).questions[0].difficulty,
      ).toBe('intermediate');
  });

  it('uses only actual historical responses and requires at least three observations', () => {
    const questions = Array.from({ length: 5 }, (_, i) =>
      question(`history-${i}`),
    );
    const history = result(
      questions,
      questions.map((q) => q.id),
    );
    expect(initialAdaptiveDifficulty([history])).toBe('advanced');
    expect(initialAdaptiveDifficulty([result(questions)])).toBe('beginner');
    history.responses = history.responses.slice(0, 2);
    expect(initialAdaptiveDifficulty([history])).toBe('intermediate');
    expect(
      initialAdaptiveDifficulty([result(questions)], {
        ...defaultConfig,
        objectiveDomains: ['ingest'],
      }),
    ).toBe('intermediate');
  });

  it('starts at a history-informed level when an eligible candidate is present', () => {
    const previous = Array.from({ length: 3 }, (_, i) =>
      question(`previous-${i}`),
    );
    const selected = selectQuestions(
      [question('middle'), question('hard', { difficulty: 'advanced' })],
      taxonomy,
      { ...defaultConfig, questionCount: 1 },
      [
        result(
          previous,
          previous.map((q) => q.id),
        ),
      ],
    );
    expect(selected.questions[0].difficulty).toBe('advanced');
  });

  it('requires three consecutive correct or incorrect answers at one actual level', () => {
    const questions = Array.from({ length: 6 }, (_, i) =>
      question(`evidence-${i}`),
    );
    for (const outcomes of [
      [true],
      [false],
      [true, true],
      [true, false, true],
      [false, true, false],
    ])
      expect(
        adaptiveDifficulty(questions, responses(questions, outcomes)),
      ).toBe('intermediate');
    expect(
      adaptiveDifficulty(questions, responses(questions, [true, true, true])),
    ).toBe('advanced');
    expect(
      adaptiveDifficulty(
        questions,
        responses(questions, [false, false, false]),
      ),
    ).toBe('beginner');
  });

  it('resets transition evidence at the actual chosen difficulty and does not oscillate after a miss', () => {
    const questions = [
      question('one'),
      question('two'),
      question('three'),
      question('hard-one', { difficulty: 'advanced' }),
      question('hard-two', { difficulty: 'advanced' }),
      question('hard-three', { difficulty: 'advanced' }),
    ];
    expect(
      adaptiveDifficulty(
        questions,
        responses(questions, [true, true, true, true]),
      ),
    ).toBe('advanced');
    expect(
      adaptiveDifficulty(
        questions,
        responses(questions, [true, true, true, false]),
      ),
    ).toBe('advanced');
    expect(
      adaptiveDifficulty(
        questions,
        responses(questions, [true, true, true, false, false, false]),
      ),
    ).toBe('intermediate');
    expect(
      adaptiveDifficulty(
        questions,
        responses(questions, [true, true, true, true, true, true]),
      ),
    ).toBe('expert');
  });

  it('swaps only remaining same-domain preselected questions and records actual fallback difficulty', () => {
    const questions = [
      question('one'),
      question('two'),
      question('three'),
      question('easy', { difficulty: 'beginner' }),
      question('other-domain', {
        difficulty: 'advanced',
        objectiveDomain: 'ingest',
      }),
      question('hard', { difficulty: 'advanced' }),
    ];
    const session = {
      ...active(questions),
      currentIndex: 2,
      responses: responses(questions, [true, true, true]),
    };
    const advanced = advanceSession(session, 1234);
    expect(advanced.questions[3].id).toBe('hard');
    expect(advanced.questions[4].id).toBe('other-domain');
    expect(advanced.actualDifficulty).toBe('advanced');
    expect(new Set(advanced.questions.map((q) => q.id))).toEqual(
      new Set(questions.map((q) => q.id)),
    );
    expect(advanced.questions.slice(0, 3)).toEqual(questions.slice(0, 3));

    const fallback = advanceSession(
      { ...session, questions: questions.slice(0, 5) },
      1234,
    );
    expect(fallback.questions[3].id).toBe('easy');
    expect(fallback.actualDifficulty).toBe('beginner');
    const withFallback = [
      ...session.responses,
      makeResponse(fallback.questions[3], ['a'], false, 0, 100),
    ];
    expect(
      adaptiveDifficulty(
        fallback.questions,
        withFallback,
        fallback.actualDifficulty,
      ),
    ).toBe('beginner');
  });
});
