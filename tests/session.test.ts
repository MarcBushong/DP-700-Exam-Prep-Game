import { describe, expect, it } from 'vitest';
import { gameReducer, type GameState } from '../src/features/quiz/session';
import { scoreSession } from '../src/features/results/scoring';
import { freshData } from '../src/services/storage';
import { defaultConfig } from '../src/features/quiz/types';
import { active, date, question, taxonomy } from './fixtures';

const start = Date.parse(date);
function state(): GameState {
  return {
    saved: freshData(),
    active: active([question('one'), question('two')]),
    lastResult: null,
    storageError: null,
    notices: [],
    dirty: false,
  };
}

describe('session state transitions', () => {
  it('locks submissions and saves exactly once at completion', () => {
    let game = state();
    game = gameReducer(game, {
      type: 'submit',
      selected: ['a'],
      flagged: true,
      now: start + 1000,
    });
    game = gameReducer(game, {
      type: 'submit',
      selected: ['b'],
      flagged: false,
      now: start + 1100,
    });
    expect(game.active?.responses).toHaveLength(1);
    expect(game.active?.responses[0]).toMatchObject({
      selectedAnswer: ['a'],
      flagged: true,
    });
    game = gameReducer(game, { type: 'next', now: start + 2000 });
    expect(game.active?.currentIndex).toBe(1);
    game = gameReducer(game, {
      type: 'submit',
      selected: [],
      flagged: false,
      now: start + 3000,
    });
    game = gameReducer(game, { type: 'next', now: start + 4000 });
    expect(game.active).toBeNull();
    expect(game.saved.history).toHaveLength(1);
    game = gameReducer(game, { type: 'finish', now: start + 5000 });
    expect(game.saved.history).toHaveLength(1);
  });
  it('warns rather than advancing an unlocked question', () => {
    const game = gameReducer(state(), { type: 'next', now: start + 1000 });
    expect(game.active?.currentIndex).toBe(0);
    expect(game.notices.join(' ')).toMatch(/Submit or skip/);
  });
  it('rejects just-late answers even when the interval has not fired', () => {
    const initial = state();
    if (!initial.active) throw new Error('Missing fixture');
    initial.active.config = {
      ...defaultConfig,
      timerMode: 'question',
      timerSeconds: 10,
    };
    const game = gameReducer(initial, {
      type: 'submit',
      selected: ['a'],
      flagged: true,
      now: start + 10100,
    });
    expect(game.active?.responses[0]).toMatchObject({
      selectedAnswer: [],
      timedOut: true,
      timeMs: 10000,
      flagged: true,
    });
    expect(game.active?.currentIndex).toBe(0);
    const repeated = gameReducer(game, { type: 'expire', now: start + 15000 });
    expect(repeated.active?.responses).toHaveLength(1);
    const next = gameReducer(repeated, { type: 'next', now: start + 16000 });
    expect(next.active?.questionStartedAt).toBe(start + 16000);
  });
  it('expires the whole session during feedback and scores unvisited questions unanswered', () => {
    const initial = state();
    if (!initial.active) throw new Error('Missing fixture');
    initial.active.config = {
      ...defaultConfig,
      timerMode: 'session',
      timerSeconds: 10,
    };
    const answered = gameReducer(initial, {
      type: 'submit',
      selected: ['a'],
      flagged: false,
      now: start + 1000,
    });
    const game = gameReducer(answered, { type: 'expire', now: start + 20000 });
    expect(game.active).toBeNull();
    expect(game.lastResult?.completedAt).toBe(
      new Date(start + 10000).toISOString(),
    );
    if (!game.lastResult) throw new Error('Missing result');
    expect(scoreSession(game.lastResult, taxonomy)).toMatchObject({
      correct: 1,
      unanswered: 1,
    });
  });
  it('early completion preserves visited time/flag and leaves unvisited unanswered', () => {
    const game = gameReducer(state(), {
      type: 'finish',
      now: start + 1200,
      flagged: true,
    });
    expect(game.lastResult?.responses[0]).toMatchObject({
      selectedAnswer: [],
      timeMs: 1200,
      flagged: true,
    });
    expect(game.lastResult?.responses).toHaveLength(1);
  });
  it('ignores premature timer events and abandoned-session callbacks', () => {
    expect(
      gameReducer(state(), { type: 'expire', now: start + 1000 }).active
        ?.responses,
    ).toHaveLength(0);
    let game = gameReducer(state(), { type: 'abandon' });
    game = gameReducer(game, { type: 'expire', now: start + 50000 });
    expect(game.saved.history).toHaveLength(0);
  });
  it('starts a configured session and persists preferences without clearing history', () => {
    let game = gameReducer(state(), {
      type: 'start',
      now: start,
      id: 'new',
      questions: [question()],
      config: defaultConfig,
      notices: ['Shortage'],
      groundedAt: date,
    });
    expect(game.active?.id).toBe('new');
    game = gameReducer(game, {
      type: 'preferences',
      preferences: { theme: 'light', reducedBanter: true, reducedMotion: true },
    });
    expect(game.saved.preferences.theme).toBe('light');
    expect(game.dirty).toBe(true);
    game = gameReducer(game, { type: 'saved', error: 'Storage full' });
    expect(game.storageError).toBe('Storage full');
    game = gameReducer(game, { type: 'clear', error: null });
    expect(game.saved.preferences.theme).toBe('dark');
    expect(game.active).toBeNull();
  });
});
