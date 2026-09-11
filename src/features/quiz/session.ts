import type { Question } from '../grounding/schema';
import { addResult, freshData, type SavedData } from '../../services/storage';
import {
  advanceSession,
  completeSession,
  makeResponse,
  remainingSeconds,
} from './engine';
import {
  configSchema,
  preferencesSchema,
  type ActiveSession,
  type Preferences,
  type QuizConfig,
  type SessionResult,
} from './types';

export interface GameState {
  saved: SavedData;
  active: ActiveSession | null;
  lastResult: SessionResult | null;
  storageError: string | null;
  notices: string[];
  dirty: boolean;
}

export type GameAction =
  | { type: 'config'; config: QuizConfig }
  | { type: 'preferences'; preferences: Preferences }
  | {
      type: 'start';
      config: QuizConfig;
      questions: Question[];
      notices: string[];
      now: number;
      id: string;
      groundedAt: string;
    }
  | { type: 'notice'; notices: string[] }
  | { type: 'submit'; selected: string[]; flagged: boolean; now: number }
  | { type: 'next' | 'finish' | 'expire'; now: number; flagged?: boolean }
  | { type: 'abandon' }
  | { type: 'saved'; error: string | null }
  | { type: 'clear'; error: string | null };

function finish(
  state: GameState,
  active: ActiveSession,
  now: number,
): GameState {
  const result = completeSession(active, now);
  return {
    ...state,
    active: null,
    lastResult: result,
    saved: addResult(state.saved, result),
    dirty: true,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (action.type === 'config')
    return {
      ...state,
      saved: { ...state.saved, config: configSchema.parse(action.config) },
      dirty: true,
    };
  if (action.type === 'preferences')
    return {
      ...state,
      saved: {
        ...state.saved,
        preferences: preferencesSchema.parse(action.preferences),
      },
      dirty: true,
    };
  if (action.type === 'saved')
    return { ...state, storageError: action.error, dirty: false };
  if (action.type === 'clear')
    return action.error
      ? { ...state, storageError: action.error }
      : {
          saved: freshData(),
          active: null,
          lastResult: null,
          storageError: null,
          dirty: false,
          notices: ['Local study data cleared.'],
        };
  if (action.type === 'notice') return { ...state, notices: action.notices };
  if (action.type === 'abandon') return { ...state, active: null };
  if (action.type === 'start')
    return {
      ...state,
      notices: action.notices,
      dirty: true,
      lastResult: null,
      saved: { ...state.saved, config: action.config },
      active: {
        id: action.id,
        config: action.config,
        questions: action.questions,
        responses: [],
        currentIndex: 0,
        startedAt: new Date(action.now).toISOString(),
        questionStartedAt: action.now,
        groundedAt: action.groundedAt,
      },
    };
  const active = state.active;
  if (!active) return state;
  const question = active.questions[active.currentIndex];
  const response = active.responses.find((r) => r.questionId === question.id);
  const expired = remainingSeconds(active, action.now) === 0;
  if (action.type === 'finish') {
    if (expired) {
      const timed = gameReducer(state, {
        type: 'expire',
        now: action.now,
        flagged: action.flagged,
      });
      return timed.active ? finish(timed, timed.active, action.now) : timed;
    }
    const updated = response
      ? active
      : {
          ...active,
          responses: [
            ...active.responses,
            makeResponse(
              question,
              [],
              action.flagged ?? false,
              active.questionStartedAt,
              action.now,
            ),
          ],
        };
    return finish(state, updated, action.now);
  }
  if (action.type === 'expire' || (action.type === 'submit' && expired)) {
    if (!expired) return state;
    const start =
      active.config.timerMode === 'session'
        ? Date.parse(active.startedAt)
        : active.questionStartedAt;
    const deadline = start + active.config.timerSeconds * 1000;
    const updated = response
      ? active
      : {
          ...active,
          responses: [
            ...active.responses,
            makeResponse(
              question,
              [],
              action.flagged ?? false,
              active.questionStartedAt,
              deadline,
              true,
            ),
          ],
        };
    return active.config.timerMode === 'session'
      ? finish(state, updated, deadline)
      : { ...state, active: updated };
  }
  if (action.type === 'submit') {
    if (response) return state;
    return {
      ...state,
      active: {
        ...active,
        responses: [
          ...active.responses,
          makeResponse(
            question,
            action.selected,
            action.flagged,
            active.questionStartedAt,
            action.now,
          ),
        ],
      },
    };
  }
  if (action.type === 'next') {
    if (expired && active.config.timerMode === 'session')
      return gameReducer(state, { type: 'expire', now: action.now });
    if (!response)
      return {
        ...state,
        notices: ['Submit or skip this question before continuing.'],
      };
    return active.currentIndex === active.questions.length - 1
      ? finish(state, active, action.now)
      : { ...state, active: advanceSession(active, action.now) };
  }
  return state;
}
