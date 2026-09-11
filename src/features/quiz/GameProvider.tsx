import { useCallback, useEffect, useReducer, type ReactNode } from 'react';
import { content } from '../grounding/content';
import type { Question } from '../grounding/schema';
import { clearData, loadData, saveData } from '../../services/storage';
import { selectQuestions } from './engine';
import { configSchema, type QuizConfig } from './types';
import { GameContext } from './context';
import { gameReducer, type GameState } from './session';

const storage = {
  getItem: (key: string) => window.localStorage.getItem(key),
  setItem: (key: string, value: string) =>
    window.localStorage.setItem(key, value),
  removeItem: (key: string) => window.localStorage.removeItem(key),
};

function initialState(): GameState {
  const loaded = loadData(storage);
  return {
    saved: loaded.data,
    storageError: loaded.error,
    active: null,
    lastResult: null,
    dirty: false,
    notices: [],
  };
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, initialState);
  useEffect(() => {
    if (state.dirty)
      dispatch({ type: 'saved', error: saveData(storage, state.saved) });
  }, [state.dirty, state.saved]);
  const startSession = useCallback(
    (config: QuizConfig, overrideQuestions?: Question[]) => {
      const validConfig = configSchema.parse(config);
      const selection = overrideQuestions
        ? {
            questions: overrideQuestions.slice(0, 50),
            warnings: [],
            eligibleCount: overrideQuestions.length,
          }
        : selectQuestions(
            content.questions,
            content.taxonomy,
            validConfig,
            state.saved.history,
          );
      if (!selection.questions.length) {
        dispatch({
          type: 'notice',
          notices: selection.warnings.length
            ? selection.warnings
            : ['No missed questions to retry.'],
        });
        return false;
      }
      dispatch({
        type: 'start',
        config: validConfig,
        questions: selection.questions,
        notices: selection.warnings,
        now: Date.now(),
        id: crypto.randomUUID(),
        groundedAt: content.manifest.lastGroundedAt,
      });
      return true;
    },
    [state.saved.history],
  );
  return (
    <GameContext.Provider
      value={{
        bank: content.questions,
        taxonomy: content.taxonomy,
        manifest: content.manifest,
        config: state.saved.config,
        preferences: state.saved.preferences,
        history: state.saved.history,
        active: state.active,
        lastResult: state.lastResult,
        storageError: state.storageError,
        notices: state.notices,
        setConfig: (config) => dispatch({ type: 'config', config }),
        setPreferences: (preferences) =>
          dispatch({ type: 'preferences', preferences }),
        startSession,
        submitAnswer: (selected, flagged) =>
          dispatch({ type: 'submit', selected, flagged, now: Date.now() }),
        nextQuestion: () => dispatch({ type: 'next', now: Date.now() }),
        expireTimer: (flagged) =>
          dispatch({ type: 'expire', now: Date.now(), flagged }),
        finishSession: (flagged) =>
          dispatch({ type: 'finish', now: Date.now(), flagged }),
        abandonSession: () => dispatch({ type: 'abandon' }),
        clearLocalData: () =>
          dispatch({ type: 'clear', error: clearData(storage) }),
      }}
    >
      {children}
    </GameContext.Provider>
  );
}
