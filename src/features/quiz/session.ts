import type { Question } from '../grounding/schema';
import {
  addResult,
  freshData,
  rememberQuestion,
  saveCredentialConfig,
  selectSavedCredential,
  type SavedData,
} from '../../services/storage';
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
  type PreferencesInput,
  type QuizConfig,
  type QuestionOrigin,
  type SessionResult,
} from './types';
import { LEGACY_CREDENTIAL_ID, questionOrigin } from './origins';
import type { Taxonomy } from '../grounding/schema';

export interface GameState {
  saved: SavedData;
  active: ActiveSession | null;
  lastResult: SessionResult | null;
  storageError: string | null;
  notices: string[];
  dirty: boolean;
  persistenceBlocked?: boolean;
}

export type GameAction =
  | { type: 'config'; config: QuizConfig }
  | { type: 'preferences'; preferences: PreferencesInput }
  | { type: 'select-dungeon'; credentialId: string }
  | { type: 'favorite'; credentialId: string }
  | { type: 'hero-class'; heroClassId: string }
  | {
      type: 'start';
      config: QuizConfig;
      questions: Question[];
      notices: string[];
      now: number;
      id: string;
      groundedAt: string;
      credentialId?: string;
      questionOrigins?: Record<string, QuestionOrigin>;
      objectiveSnapshots?: Record<string, Taxonomy>;
    }
  | { type: 'notice'; notices: string[] }
  | { type: 'submit'; selected: string[]; flagged: boolean; now: number }
  | { type: 'next' | 'finish' | 'expire'; now: number; flagged?: boolean }
  | { type: 'abandon' }
  | { type: 'reset-question-history' }
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
      saved: saveCredentialConfig(
        state.saved,
        configSchema.parse(action.config),
      ),
      dirty: true,
    };
  if (action.type === 'select-dungeon') {
    if (
      state.active &&
      state.saved.selectedCredentialId !== action.credentialId
    )
      return {
        ...state,
        notices: ['Abandon the active run before entering another dungeon.'],
      };
    return {
      ...state,
      saved: selectSavedCredential(state.saved, action.credentialId),
      notices: [],
      dirty: true,
    };
  }
  if (action.type === 'favorite')
    return {
      ...state,
      saved: {
        ...state.saved,
        favoriteCredentialIds: state.saved.favoriteCredentialIds.includes(
          action.credentialId,
        )
          ? state.saved.favoriteCredentialIds.filter(
              (id) => id !== action.credentialId,
            )
          : [...state.saved.favoriteCredentialIds, action.credentialId],
      },
      dirty: true,
    };
  if (action.type === 'hero-class')
    return {
      ...state,
      saved: { ...state.saved, heroClassId: action.heroClassId },
      dirty: true,
    };
  if (action.type === 'preferences') {
    const previous = state.saved.preferences;
    const legacyToggle =
      action.preferences.banterLevel === previous.banterLevel &&
      action.preferences.reducedBanter !== previous.reducedBanter;
    return {
      ...state,
      saved: {
        ...state.saved,
        preferences: preferencesSchema.parse({
          ...action.preferences,
          ...(legacyToggle ? { banterLevel: undefined } : {}),
        }),
      },
      dirty: true,
    };
  }
  if (action.type === 'reset-question-history')
    return {
      ...state,
      saved: {
        ...state.saved,
        recentQuestionIds:
          state.saved.selectedCredentialId === LEGACY_CREDENTIAL_ID
            ? []
            : state.saved.recentQuestionIds,
        recentQuestionIdsByCredential: {
          ...state.saved.recentQuestionIdsByCredential,
          [state.saved.selectedCredentialId]: [],
        },
      },
      notices: [
        'Recent question history reset. Saved scores and preferences are unchanged.',
      ],
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
          persistenceBlocked: false,
          notices: ['Local study data cleared.'],
        };
  if (action.type === 'notice') return { ...state, notices: action.notices };
  if (action.type === 'abandon') return { ...state, active: null };
  if (action.type === 'start') {
    if (!action.questions.length) return state;
    return {
      ...state,
      notices: action.notices,
      dirty: true,
      lastResult: null,
      saved: rememberQuestion(
        saveCredentialConfig(state.saved, action.config),
        action.questions[0].id,
        action.questionOrigins?.[action.questions[0].id]?.credentialId ??
          action.credentialId ??
          action.config.credentialId ??
          LEGACY_CREDENTIAL_ID,
      ),
      active: {
        id: action.id,
        config: action.config,
        questions: action.questions,
        responses: [],
        currentIndex: 0,
        startedAt: new Date(action.now).toISOString(),
        questionStartedAt: action.now,
        groundedAt: action.groundedAt,
        actualDifficulty: action.questions[0].difficulty,
        credentialId:
          action.credentialId ??
          action.config.credentialId ??
          LEGACY_CREDENTIAL_ID,
        questionOrigins: action.questionOrigins,
        objectiveSnapshots: action.objectiveSnapshots,
      },
    };
  }
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
    if (active.currentIndex === active.questions.length - 1)
      return finish(state, active, action.now);
    const next = advanceSession(active, action.now);
    return {
      ...state,
      active: next,
      saved: rememberQuestion(
        state.saved,
        next.questions[next.currentIndex].id,
        questionOrigin(next, next.questions[next.currentIndex].id).credentialId,
      ),
      dirty: true,
    };
  }
  return state;
}
