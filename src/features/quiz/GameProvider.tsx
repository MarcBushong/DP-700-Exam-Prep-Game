import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { getDungeonPackage } from '../dungeons/packages';
import { credentials, heroClasses } from '../dungeons/catalog';
import type { Question } from '../grounding/schema';
import { clearData, loadData, saveData } from '../../services/storage';
import { configSchema, type QuizConfig } from './types';
import { GameContext } from './context';
import { gameReducer, type GameAction, type GameState } from './session';
import { dungeonAccess, planDungeonSession } from './dungeonRuntime';
import { historyForCredential, LEGACY_CREDENTIAL_ID } from './origins';

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
    persistenceBlocked: Boolean(loaded.error),
    notices: [],
  };
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, reactDispatch] = useReducer(
    gameReducer,
    undefined,
    initialState,
  );
  const current = useRef(state);
  // Keep imperative commands in order even when React batches abandon + select.
  const dispatch = useCallback((action: GameAction) => {
    current.current = gameReducer(current.current, action);
    reactDispatch(action);
  }, []);
  useEffect(() => {
    if (state.dirty && !state.persistenceBlocked)
      dispatch({ type: 'saved', error: saveData(storage, state.saved) });
  }, [state.dirty, state.saved, state.persistenceBlocked, dispatch]);
  const selectDungeon = useCallback(
    (credentialId: string) => {
      const game = current.current;
      if (game.active && credentialId !== game.saved.selectedCredentialId) {
        dispatch({
          type: 'notice',
          notices: ['Abandon the active run before entering another dungeon.'],
        });
        return false;
      }
      const access = dungeonAccess(getDungeonPackage(credentialId));
      if (!access.allowed) {
        dispatch({ type: 'notice', notices: access.reasons });
        return false;
      }
      dispatch({ type: 'select-dungeon', credentialId });
      return true;
    },
    [dispatch],
  );
  const startSession = useCallback(
    (input: QuizConfig, overrideQuestions?: Question[]) => {
      const game = current.current;
      const parsed = configSchema.safeParse(input);
      if (!parsed.success) {
        dispatch({
          type: 'notice',
          notices: ['Invalid expedition configuration.'],
        });
        return false;
      }
      const config = parsed.data;
      if (game.active) {
        dispatch({
          type: 'notice',
          notices: [
            'Complete or abandon the active run before starting another expedition.',
          ],
        });
        return false;
      }
      const credentialId =
        config.credentialId ?? game.saved.selectedCredentialId;
      if (credentialId !== game.saved.selectedCredentialId) {
        dispatch({
          type: 'notice',
          notices: ['Select the dungeon before starting its expedition.'],
        });
        return false;
      }
      const selectedAccess = dungeonAccess(getDungeonPackage(credentialId));
      if (!selectedAccess.allowed) {
        dispatch({ type: 'notice', notices: selectedAccess.reasons });
        return false;
      }
      const ids =
        config.runMode === 'raid'
          ? (config.raidCredentialIds ?? [])
          : [credentialId];
      const selection = planDungeonSession(
        ids.map(getDungeonPackage),
        { ...config, credentialId },
        game.saved.history,
        game.saved.recentQuestionIdsByCredential,
        Math.random,
        overrideQuestions
          ? new Set(overrideQuestions.map((q) => q.id))
          : undefined,
      );
      if (!selection.ok) {
        dispatch({ type: 'notice', notices: selection.warnings });
        return false;
      }
      dispatch({
        type: 'start',
        ...selection.plan,
        notices: selection.plan.warnings,
        now: Date.now(),
        id: crypto.randomUUID(),
      });
      return true;
    },
    [dispatch],
  );
  const selectedDungeon = getDungeonPackage(state.saved.selectedCredentialId);
  const fallback = selectedDungeon ?? getDungeonPackage(LEGACY_CREDENTIAL_ID);
  if (!fallback)
    throw new Error(
      'The installed application is missing its default objective package.',
    );
  const selectedAccess = dungeonAccess(selectedDungeon);
  return (
    <GameContext.Provider
      value={{
        selectedCredentialId: state.saved.selectedCredentialId,
        selectedDungeon,
        selectDungeon,
        favoriteCredentialIds: state.saved.favoriteCredentialIds,
        toggleFavoriteCredential: (credentialId) => {
          if (credentials.some((c) => c.credentialId === credentialId))
            dispatch({ type: 'favorite', credentialId });
        },
        heroClassId: state.saved.heroClassId,
        setHeroClassId: (heroClassId) => {
          if (heroClasses.some((c) => c.id === heroClassId))
            dispatch({ type: 'hero-class', heroClassId });
        },
        credentialHistory: historyForCredential(
          state.saved.history,
          state.saved.selectedCredentialId,
        ),
        bank: selectedAccess.allowed ? selectedDungeon!.questions : [],
        taxonomy: fallback.taxonomy,
        manifest: fallback.manifest,
        config: state.saved.config,
        preferences: state.saved.preferences,
        history: state.saved.history,
        recentQuestionIds:
          state.saved.recentQuestionIdsByCredential[
            state.saved.selectedCredentialId
          ] ?? [],
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
        resetQuestionHistory: () =>
          dispatch({ type: 'reset-question-history' }),
      }}
    >
      {children}
    </GameContext.Provider>
  );
}
