import { z } from 'zod';
import {
  configSchema,
  defaultConfig,
  defaultPreferences,
  preferencesSchema,
  sessionResultSchema,
  type Preferences,
  type QuizConfig,
  type SessionResult,
} from '../features/quiz/types';

export const STORAGE_KEY = 'fabric-challenge:v1';
export const savedDataSchema = z.object({
  version: z.literal(1),
  config: configSchema,
  preferences: preferencesSchema,
  history: z.array(sessionResultSchema).max(30),
});
export interface SavedData {
  version: 1;
  config: QuizConfig;
  preferences: Preferences;
  history: SessionResult[];
}
export const freshData = (): SavedData => ({
  version: 1,
  config: { ...defaultConfig },
  preferences: { ...defaultPreferences },
  history: [],
});

export function loadData(storage: Pick<Storage, 'getItem'>): {
  data: SavedData;
  error: string | null;
} {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { data: freshData(), error: null };
    const parsed = savedDataSchema.safeParse(JSON.parse(raw));
    if (!parsed.success)
      return {
        data: freshData(),
        error:
          'Saved study data has an unsupported or damaged format. Defaults are in use. Clear local data to reset it.',
      };
    return { data: parsed.data, error: null };
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof DOMException) {
      return {
        data: freshData(),
        error:
          'Local storage could not be read. This session can continue in memory, but settings and results may not persist.',
      };
    }
    throw error;
  }
}

export function saveData(
  storage: Pick<Storage, 'setItem'>,
  data: SavedData,
): string | null {
  const parsed = savedDataSchema.parse(data);
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    return null;
  } catch (error) {
    if (error instanceof DOMException)
      return 'Your browser could not save study data (storage may be full or disabled). Export this result before leaving.';
    throw error;
  }
}

export function clearData(storage: Pick<Storage, 'removeItem'>): string | null {
  try {
    storage.removeItem(STORAGE_KEY);
    return null;
  } catch (error) {
    if (error instanceof DOMException)
      return 'Your browser blocked clearing local data. Remove this site data in browser settings.';
    throw error;
  }
}

export function addResult(data: SavedData, result: SessionResult): SavedData {
  return {
    ...data,
    history: [
      sessionResultSchema.parse(result),
      ...data.history.filter((r) => r.id !== result.id),
    ].slice(0, 30),
  };
}
