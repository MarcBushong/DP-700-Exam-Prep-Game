import { beforeEach, describe, expect, it } from 'vitest';
import { gameReducer, type GameState } from '../src/features/quiz/session';
import { defaultConfig, preferencesSchema } from '../src/features/quiz/types';
import { scoreSession } from '../src/features/results/scoring';
import {
  addResult,
  freshData,
  loadData,
  RECENT_QUESTION_LIMIT,
  rememberQuestion,
  saveData,
  STORAGE_KEY,
} from '../src/services/storage';
import { date, question, result, taxonomy } from './fixtures';

const now = Date.parse(date);
const state = (): GameState => ({
  saved: freshData(),
  active: null,
  lastResult: null,
  storageError: null,
  notices: [],
  dirty: false,
});
const start = (game = state()) =>
  gameReducer(game, {
    type: 'start',
    id: 'new',
    config: defaultConfig,
    now,
    groundedAt: date,
    questions: [question('shown'), question('unused'), question('also-unused')],
    notices: [],
  });

beforeEach(() => localStorage.clear());

describe('recent local question history', () => {
  it('records only questions actually shown, even for early completion or abandonment', () => {
    const game = start();
    expect(game.saved.recentQuestionIds).toEqual(['shown']);
    expect(
      gameReducer(game, { type: 'finish', now: now + 1000 }).saved
        .recentQuestionIds,
    ).toEqual(['shown']);
    expect(
      gameReducer(game, { type: 'abandon' }).saved.recentQuestionIds,
    ).toEqual(['shown']);
    expect(
      gameReducer(game, { type: 'next', now: now + 1000 }).saved
        .recentQuestionIds,
    ).toEqual(['shown']);
    const answered = gameReducer(game, {
      type: 'submit',
      selected: ['a'],
      flagged: false,
      now: now + 1000,
    });
    const next = gameReducer(answered, { type: 'next', now: now + 2000 });
    expect(next.saved.recentQuestionIds).toEqual(['unused', 'shown']);
    expect(next.dirty).toBe(true);
  });

  it('does not mark unvisited preselected questions when the session timer expires', () => {
    const game = start();
    if (!game.active) throw new Error('Missing active fixture');
    game.active.config = {
      ...defaultConfig,
      timerMode: 'session',
      timerSeconds: 10,
    };
    const finished = gameReducer(game, { type: 'expire', now: now + 10000 });
    expect(finished.saved.history).toHaveLength(1);
    expect(finished.saved.recentQuestionIds).toEqual(['shown']);
  });

  it('keeps at most 200 unique MRU IDs and makes old questions eligible for repetition', () => {
    let data = freshData();
    for (let i = 0; i < RECENT_QUESTION_LIMIT + 20; i++)
      data = rememberQuestion(data, `question-${i}`);
    expect(data.recentQuestionIds).toHaveLength(RECENT_QUESTION_LIMIT);
    expect(data.recentQuestionIds).not.toContain('question-0');
    data = rememberQuestion(data, 'question-20');
    expect(data.recentQuestionIds[0]).toBe('question-20');
    expect(data.recentQuestionIds).toHaveLength(RECENT_QUESTION_LIMIT);
    expect(new Set(data.recentQuestionIds).size).toBe(RECENT_QUESTION_LIMIT);
    expect(saveData(localStorage, data)).toBeNull();
    expect(loadData(localStorage).data.recentQuestionIds).toEqual(
      data.recentQuestionIds,
    );
  });

  it('resets recent IDs independently of completed snapshots, settings and the active session', () => {
    const game = start();
    game.saved = addResult(game.saved, result());
    game.lastResult = game.saved.history[0];
    const reset = gameReducer(game, { type: 'reset-question-history' });
    expect(reset.saved.recentQuestionIds).toEqual([]);
    expect(reset.saved.history).toEqual(game.saved.history);
    expect(reset.saved.config).toEqual(game.saved.config);
    expect(reset.saved.preferences).toEqual(game.saved.preferences);
    expect(reset.active).toEqual(game.active);
    expect(reset.lastResult).toEqual(game.lastResult);
    expect(reset.dirty).toBe(true);
  });
});

describe('version-one compatibility and banter preferences', () => {
  it.each([true, false])(
    'migrates legacy reducedBanter=%s without resetting historical scores',
    (reducedBanter) => {
      const data = addResult(freshData(), result([question('old')], ['old']));
      const legacyFields = [
        'conceptId',
        'verificationStatus',
        'verifiedAt',
        'verifiedAgainstSourceIds',
        'verificationNotes',
        'requiresManualReview',
        'sourceLastReviewedAt',
        'confidenceReason',
        'generationReview',
        'answerVerification',
      ];
      const raw = {
        version: 1,
        config: data.config,
        preferences: { theme: 'light', reducedMotion: true, reducedBanter },
        history: data.history.map((history) => ({
          ...history,
          questions: history.questions.map((q) =>
            Object.fromEntries(
              Object.entries(q).filter(([key]) => !legacyFields.includes(key)),
            ),
          ),
        })),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
      const loaded = loadData(localStorage);
      expect(loaded.error).toBeNull();
      expect(loaded.data.preferences).toMatchObject({
        banterLevel: reducedBanter ? 'reduced' : 'balanced',
        reducedBanter,
        theme: 'light',
      });
      expect(loaded.data.recentQuestionIds).toEqual([]);
      expect(loaded.data.history[0].questions[0].verificationStatus).toBe(
        'manual-review-required',
      );
      expect(scoreSession(loaded.data.history[0], taxonomy).correct).toBe(1);
      expect(saveData(localStorage, loaded.data)).toBeNull();
      expect(loadData(localStorage).data.history).toEqual(loaded.data.history);
    },
  );

  it.each(['full', 'balanced', 'reduced', 'none'] as const)(
    'persists %s and normalizes the legacy boolean',
    (banterLevel) => {
      const data = freshData();
      data.preferences = preferencesSchema.parse({
        ...data.preferences,
        banterLevel,
      });
      expect(saveData(localStorage, data)).toBeNull();
      expect(loadData(localStorage).data.preferences).toMatchObject({
        banterLevel,
        reducedBanter: banterLevel === 'reduced' || banterLevel === 'none',
      });
    },
  );

  it('keeps legacy preference setters working alongside the new level setter', () => {
    let game = state();
    game.saved = addResult(game.saved, result());
    game = gameReducer(game, {
      type: 'preferences',
      preferences: { ...game.saved.preferences, reducedBanter: true },
    });
    expect(game.saved.preferences.banterLevel).toBe('reduced');
    game = gameReducer(game, {
      type: 'preferences',
      preferences: { ...game.saved.preferences, banterLevel: 'full' },
    });
    expect(game.saved.preferences.reducedBanter).toBe(false);
    game = gameReducer(game, {
      type: 'preferences',
      preferences: { ...game.saved.preferences, banterLevel: 'none' },
    });
    expect(game.saved.preferences.reducedBanter).toBe(true);
    game = gameReducer(game, {
      type: 'preferences',
      preferences: { ...game.saved.preferences, reducedBanter: false },
    });
    expect(game.saved.preferences.banterLevel).toBe('balanced');
    expect(game.saved.history).toHaveLength(1);
  });
});
