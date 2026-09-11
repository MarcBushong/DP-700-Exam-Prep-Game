import { describe, expect, it } from 'vitest';
import {
  adaptiveDifficulty,
  advanceSession,
  completeSession,
  eligibleQuestions,
  feedbackVisibility,
  isCorrect,
  makeResponse,
  remainingSeconds,
  selectQuestions,
  shuffle,
  topicPerformance,
} from '../src/features/quiz/engine';
import {
  configSchema,
  defaultConfig,
  type QuizConfig,
} from '../src/features/quiz/types';
import { active, date, question, result, taxonomy } from './fixtures';

const bank = taxonomy.domains.flatMap((domain) =>
  Array.from({ length: 8 }, (_, i) =>
    question(`${domain.id}-${i}`, {
      objectiveDomain: domain.id,
      skill: domain.skills[0].id,
      subskill: domain.skills[0].subskills[0],
      difficulty: (['beginner', 'intermediate', 'advanced', 'expert'] as const)[
        i % 4
      ],
      complexity: i % 2 ? 'technical-implementation' : 'concept-recall',
    }),
  ),
);

describe('quiz configuration and selection', () => {
  it('accepts complete defaults and rejects unsafe counts and timer lengths', () => {
    expect(configSchema.parse(defaultConfig)).toEqual(defaultConfig);
    for (const questionCount of [0, 51, 1.5, NaN])
      expect(
        configSchema.safeParse({ ...defaultConfig, questionCount }).success,
      ).toBe(false);
    for (const timerSeconds of [0, 7201, 10.5])
      expect(
        configSchema.safeParse({ ...defaultConfig, timerSeconds }).success,
      ).toBe(false);
  });
  it('intersects domains, skills, subskills, difficulty, complexity and format', () => {
    const config: QuizConfig = {
      ...defaultConfig,
      objectiveDomains: ['ingest'],
      skills: ['batch'],
      subskills: ['Loading'],
      difficulty: 'intermediate',
      complexity: 'technical-implementation',
      format: 'single-select',
    };
    const selected = eligibleQuestions(bank, config);
    expect(selected).toHaveLength(2);
    expect(
      selected.every(
        (q) =>
          q.objectiveDomain === 'ingest' && q.difficulty === 'intermediate',
      ),
    ).toBe(true);
    expect(
      eligibleQuestions(bank, { ...config, skills: ['security'] }),
    ).toHaveLength(0);
  });
  it('allows multiple domains and discloses shortages without duplicates', () => {
    const selected = selectQuestions(bank, taxonomy, {
      ...defaultConfig,
      objectiveDomains: ['manage', 'monitor'],
      questionCount: 50,
    });
    expect(selected.questions).toHaveLength(16);
    expect(new Set(selected.questions.map((q) => q.id)).size).toBe(16);
    expect(selected.warnings.join(' ')).toMatch(/16 unique questions/);
  });
  it('reports empty combinations instead of silently dropping filters', () => {
    const selected = selectQuestions(bank, taxonomy, {
      ...defaultConfig,
      format: 'code',
    });
    expect(selected.questions).toEqual([]);
    expect(selected.warnings).toHaveLength(1);
  });
  it('balances normalized manifest weights and respects study guide order', () => {
    const selected = selectQuestions(
      bank,
      taxonomy,
      { ...defaultConfig, questionCount: 12, order: 'balanced' },
      [],
      () => 0.4,
    ).questions;
    for (const domain of taxonomy.domains)
      expect(
        selected.filter((q) => q.objectiveDomain === domain.id),
      ).toHaveLength(4);
    const weighted = structuredClone(taxonomy);
    weighted.domains[0].weightRange = [60, 60];
    weighted.domains[1].weightRange = [20, 20];
    weighted.domains[2].weightRange = [20, 20];
    const weightedSelection = selectQuestions(bank, weighted, {
      ...defaultConfig,
      questionCount: 10,
    }).questions;
    expect(
      weightedSelection.filter((q) => q.objectiveDomain === 'manage'),
    ).toHaveLength(6);
    const ordered = selectQuestions(bank, taxonomy, {
      ...defaultConfig,
      questionCount: 10,
      order: 'study-guide',
    }).questions;
    expect(ordered[0].objectiveDomain).toBe('manage');
    expect(ordered[8].objectiveDomain).toBe('ingest');
  });
  it('prioritizes actual missed topics and discloses absent weak-area evidence', () => {
    const history = [result([bank[0], bank[8]], [bank[0].id])];
    expect(topicPerformance(history).get('batch')).toEqual({
      total: 1,
      correct: 0,
    });
    const weak = selectQuestions(
      bank,
      taxonomy,
      { ...defaultConfig, practiceMode: 'weak' },
      history,
    );
    expect(weak.questions.every((q) => q.skill === 'batch')).toBe(true);
    const ordered = selectQuestions(
      bank,
      taxonomy,
      { ...defaultConfig, order: 'weakest' },
      history,
    );
    expect(ordered.questions[0].skill).toBe('batch');
    expect(
      selectQuestions(bank, taxonomy, {
        ...defaultConfig,
        practiceMode: 'weak',
      }).warnings.join(' '),
    ).toMatch(/general practice/);
  });
  it('shuffles without mutating inputs or changing answer identities', () => {
    const input = ['a', 'b', 'c', 'd'];
    expect(shuffle(input, () => 0)).toEqual(['b', 'c', 'd', 'a']);
    expect(input).toEqual(['a', 'b', 'c', 'd']);
    const before = structuredClone(bank);
    const selected = selectQuestions(
      bank,
      taxonomy,
      { ...defaultConfig, order: 'random' },
      [],
      () => 0,
    );
    expect(bank).toEqual(before);
    for (const q of selected.questions)
      expect(isCorrect(q, q.correctAnswer)).toBe(true);
  });
});

describe('answers and feedback', () => {
  it('awards multi-select credit only for the exact distinct set', () => {
    const q = question('multi', {
      questionType: 'multi-select',
      correctAnswer: ['a', 'c'],
      whyOtherAnswersAreWrong: { b: 'Incorrect.' },
    });
    expect(isCorrect(q, ['c', 'a'])).toBe(true);
    for (const selected of [[], ['a'], ['a', 'b', 'c'], ['a', 'a']])
      expect(isCorrect(q, selected)).toBe(false);
  });
  it('rejects invalid or multiple single-select choices', () => {
    expect(() => makeResponse(question(), ['unknown'], false, 0, 10)).toThrow(
      'Invalid',
    );
    expect(() => makeResponse(question(), ['a', 'a'], false, 0, 10)).toThrow(
      'Invalid',
    );
    expect(() => makeResponse(question(), ['a', 'b'], false, 0, 10)).toThrow(
      'Choose one',
    );
    expect(makeResponse(question(), [], true, 100, 90)).toMatchObject({
      selectedAnswer: [],
      timeMs: 0,
      flagged: true,
    });
  });
  it.each(['hidden', 'exam'] as const)(
    'reveals no answers, explanation or sources in %s',
    (mode) => {
      expect(feedbackVisibility(mode, true)).toEqual({
        answer: false,
        explanation: false,
        sources: false,
        coaching: false,
      });
      expect(feedbackVisibility(mode, true, true)).toMatchObject({
        answer: true,
        explanation: true,
        sources: true,
      });
    },
  );
  it('explanation-only feedback does not mark correctness; study supports coaching', () => {
    expect(feedbackVisibility('explanations-only', true)).toMatchObject({
      answer: false,
      explanation: true,
      sources: false,
    });
    expect(feedbackVisibility('immediate', false)).toMatchObject({
      answer: false,
      explanation: false,
    });
    expect(feedbackVisibility('immediate', true)).toMatchObject({
      answer: true,
      explanation: true,
    });
    expect(feedbackVisibility('study', false)).toMatchObject({
      answer: false,
      sources: true,
      coaching: true,
    });
  });
});

describe('timing and adaptive transitions', () => {
  it('uses elapsed wall time, not interval counts, and clamps at zero', () => {
    const session = active();
    const start = Date.parse(date);
    expect(remainingSeconds(session, start + 999999)).toBeNull();
    session.config = {
      ...session.config,
      timerMode: 'question',
      timerSeconds: 60,
    };
    expect(remainingSeconds(session, start + 59100)).toBe(1);
    expect(remainingSeconds(session, start + 61000)).toBe(0);
    session.config.timerMode = 'session';
    session.questionStartedAt += 30000;
    expect(remainingSeconds(session, start + 31000)).toBe(29);
  });
  it('raises/lowers difficulty based on actual responses, within the selected domain', () => {
    const questions = [
      question('first'),
      question('easy', { difficulty: 'beginner' }),
      question('hard', { difficulty: 'advanced' }),
      question('other', { objectiveDomain: 'ingest', difficulty: 'expert' }),
    ];
    const session = active(questions);
    session.responses = [makeResponse(questions[0], ['a'], false, 0, 100)];
    expect(adaptiveDifficulty(questions, session.responses)).toBe('advanced');
    const advanced = advanceSession(session, 200);
    expect(advanced.questions[1].id).toBe('hard');
    expect(advanced.questions[3].id).toBe('other');
    expect(advanced.questionStartedAt).toBe(200);
    expect(new Set(advanced.questions.map((q) => q.id)).size).toBe(4);
    session.responses = [makeResponse(questions[0], ['b'], false, 0, 100)];
    expect(adaptiveDifficulty(questions, session.responses)).toBe('beginner');
    expect(adaptiveDifficulty(questions, [])).toBe('intermediate');
  });
  it('keeps snapshot questions and leaves unvisited questions unanswered', () => {
    const session = active([question('one'), question('two')]);
    const completed = completeSession(session, Date.parse(date) + 1000);
    expect(completed.questions).toHaveLength(2);
    expect(completed.responses).toHaveLength(0);
    expect(completed.completedAt).toBe('2026-09-11T16:05:01.000Z');
  });
});
