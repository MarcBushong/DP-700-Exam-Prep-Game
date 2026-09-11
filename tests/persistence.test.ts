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
import { LEGACY_OBJECTIVE_VERSION } from '../src/features/quiz/origins';

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
  it('migrates all 30 original v1 scores, settings and MRU into the DP-700 namespace without inventing maps', () => {
    const config = {
      ...defaultConfig,
      difficulty: 'expert',
      timerMode: 'session',
    };
    const raw = JSON.stringify({
      version: 1,
      config: Object.fromEntries(
        Object.entries(config).filter(
          ([key]) =>
            !['credentialId', 'runMode', 'raidCredentialIds'].includes(key),
        ),
      ),
      preferences: { theme: 'light', reducedMotion: true, reducedBanter: true },
      recentQuestionIds: ['old-29', 'old-28'],
      history: Array.from({ length: 30 }, (_, i) => ({
        ...result([question(`old-${i}`)], [`old-${i}`]),
        id: `session-${i}`,
      })),
    });
    localStorage.setItem(STORAGE_KEY, raw);
    const loaded = loadData(localStorage);
    expect(loaded.error).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    expect(loaded.data.config).toMatchObject({
      credentialId: 'dp-700',
      difficulty: 'expert',
      timerMode: 'session',
    });
    expect(loaded.data.history).toHaveLength(30);
    expect(loaded.data.recentQuestionIdsByCredential['dp-700']).toEqual([
      'old-29',
      'old-28',
    ]);
    for (const session of loaded.data.history) {
      expect(session.credentialId).toBe('dp-700');
      expect(session.objectiveSnapshots).toEqual({});
      expect(
        session.questionOrigins?.[session.questions[0].id].objectiveVersion,
      ).toBe(LEGACY_OBJECTIVE_VERSION);
      expect(scoreSession(session, taxonomy).percentage).toBe(100);
      expect(scoreSession(session, taxonomy).readiness.ready).toBe(false);
    }
    expect(saveData(localStorage, loaded.data)).toBeNull();
    expect(loadData(localStorage).data).toEqual(loaded.data);
  });

  it('keeps per-dungeon configurations, classes, favorites and recent resets independent', () => {
    let game = start();
    game = gameReducer(game, { type: 'abandon' });
    game = gameReducer(game, {
      type: 'config',
      config: { ...defaultConfig, difficulty: 'expert' },
    });
    game = gameReducer(game, { type: 'favorite', credentialId: 'other' });
    game = gameReducer(game, {
      type: 'hero-class',
      heroClassId: 'data-engineer',
    });
    game = gameReducer(game, { type: 'select-dungeon', credentialId: 'other' });
    expect(game.saved.config.difficulty).toBe('adaptive');
    game.saved = rememberQuestion(game.saved, 'other-shown', 'other');
    game = gameReducer(game, { type: 'reset-question-history' });
    expect(game.saved.recentQuestionIdsByCredential.other).toEqual([]);
    expect(game.saved.recentQuestionIdsByCredential['dp-700']).toEqual([
      'shown',
    ]);
    game = gameReducer(game, {
      type: 'select-dungeon',
      credentialId: 'dp-700',
    });
    expect(game.saved.config.difficulty).toBe('expert');
    expect(game.saved.favoriteCredentialIds).toEqual(['other']);
    expect(game.saved.heroClassId).toBe('data-engineer');
    expect(saveData(localStorage, game.saved)).toBeNull();
    expect(loadData(localStorage).data).toEqual(game.saved);
  });
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
