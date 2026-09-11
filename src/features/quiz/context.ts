import { createContext, useContext } from 'react';
import type { DungeonPackage } from '../dungeons/packages';
import type {
  GroundingManifest,
  Question,
  Taxonomy,
} from '../grounding/schema';
import type {
  ActiveSession,
  Preferences,
  PreferencesInput,
  QuizConfig,
  SessionResult,
} from './types';

export interface GameContextValue {
  selectedCredentialId: string;
  selectedDungeon: DungeonPackage | undefined;
  selectDungeon: (credentialId: string) => boolean;
  favoriteCredentialIds: string[];
  toggleFavoriteCredential: (credentialId: string) => void;
  heroClassId: string;
  setHeroClassId: (heroClassId: string) => void;
  credentialHistory: SessionResult[];
  bank: Question[];
  taxonomy: Taxonomy;
  manifest: GroundingManifest;
  config: QuizConfig;
  preferences: Preferences;
  history: SessionResult[];
  recentQuestionIds: string[];
  active: ActiveSession | null;
  lastResult: SessionResult | null;
  storageError: string | null;
  notices: string[];
  setConfig: (config: QuizConfig) => void;
  setPreferences: (preferences: PreferencesInput) => void;
  startSession: (config: QuizConfig, overrideQuestions?: Question[]) => boolean;
  submitAnswer: (selected: string[], flagged: boolean) => void;
  nextQuestion: () => void;
  expireTimer: (flagged?: boolean) => void;
  finishSession: (flagged?: boolean) => void;
  abandonSession: () => void;
  clearLocalData: () => void;
  resetQuestionHistory: () => void;
}

export const GameContext = createContext<GameContextValue | null>(null);
export function useGame() {
  const value = useContext(GameContext);
  if (!value) throw new Error('Quiz components require GameProvider.');
  return value;
}
