import { z } from 'zod';
import {
  LEGACY_CREDENTIAL_ID,
  withSessionOrigins,
} from '../features/quiz/origins';
import {
  configSchema,
  defaultConfig,
  defaultPreferences,
  preferencesSchema,
  sessionResultSchema,
  type QuizConfig,
  type SessionResult,
} from '../features/quiz/types';

export const STORAGE_KEY = 'fabric-challenge:v1';
export const RECENT_QUESTION_LIMIT = 200;
const recentIdsSchema = z
  .array(z.string().trim().min(1))
  .default([])
  .transform((ids) => [...new Set(ids)].slice(0, RECENT_QUESTION_LIMIT));
const savedDataFieldsSchema = z.object({
  version: z.literal(1),
  config: configSchema,
  preferences: preferencesSchema,
  history: z.array(sessionResultSchema.transform(withSessionOrigins)),
  recentQuestionIds: recentIdsSchema,
  selectedCredentialId: z.string().trim().min(1).default(LEGACY_CREDENTIAL_ID),
  favoriteCredentialIds: z
    .array(z.string().trim().min(1))
    .default([])
    .transform((ids) => [...new Set(ids)]),
  heroClassId: z.string().trim().min(1).default('wanderer'),
  configByCredential: z.record(z.string(), configSchema).default({}),
  recentQuestionIdsByCredential: z
    .record(z.string(), recentIdsSchema)
    .default({}),
});
export const savedDataSchema = savedDataFieldsSchema.transform((data) => {
  const config: QuizConfig = {
    ...data.config,
    credentialId: data.selectedCredentialId,
    runMode: data.config.runMode ?? 'study',
  };
  const recentQuestionIdsByCredential: Record<string, string[]> = {
    ...data.recentQuestionIdsByCredential,
    [LEGACY_CREDENTIAL_ID]: data.recentQuestionIds,
  };
  return {
    ...data,
    config,
    configByCredential: {
      ...data.configByCredential,
      [data.selectedCredentialId]: config,
    },
    recentQuestionIdsByCredential,
  };
});
export type SavedData = z.infer<typeof savedDataSchema>;
export const freshData = (): SavedData =>
  savedDataSchema.parse({
    version: 1,
    config: { ...defaultConfig },
    preferences: { ...defaultPreferences },
    history: [],
    recentQuestionIds: [],
  });

export function rememberQuestion(
  data: SavedData,
  questionId: string,
  credentialId = LEGACY_CREDENTIAL_ID,
): SavedData {
  const recent = [
    questionId,
    ...(data.recentQuestionIdsByCredential[credentialId] ?? []).filter(
      (id) => id !== questionId,
    ),
  ].slice(0, RECENT_QUESTION_LIMIT);
  return {
    ...data,
    recentQuestionIds:
      credentialId === LEGACY_CREDENTIAL_ID ? recent : data.recentQuestionIds,
    recentQuestionIdsByCredential: {
      ...data.recentQuestionIdsByCredential,
      [credentialId]: recent,
    },
  };
}

export function saveCredentialConfig(
  data: SavedData,
  config: QuizConfig,
): SavedData {
  const normalized = configSchema.parse({
    ...config,
    credentialId: data.selectedCredentialId,
    runMode: config.runMode ?? 'study',
  });
  return {
    ...data,
    config: normalized,
    configByCredential: {
      ...data.configByCredential,
      [data.selectedCredentialId]: normalized,
    },
  };
}

export function selectSavedCredential(
  data: SavedData,
  credentialId: string,
): SavedData {
  return saveCredentialConfig(
    { ...data, selectedCredentialId: credentialId },
    data.configByCredential[credentialId] ?? {
      ...defaultConfig,
      credentialId,
    },
  );
}

export function loadData(storage: Pick<Storage, 'getItem'>): {
  data: SavedData;
  error: string | null;
} {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { data: freshData(), error: null };
    const decoded: unknown = JSON.parse(raw);
    const parsed = savedDataSchema.safeParse(decoded);
    if (!parsed.success) {
      const record = z.record(z.string(), z.unknown()).safeParse(decoded);
      if (record.success && record.data.version === 1) {
        const recovered: Record<string, unknown> = { ...freshData() };
        for (const [key, schema] of Object.entries(
          savedDataFieldsSchema.shape,
        )) {
          if (key === 'history') continue;
          const field = schema.safeParse(record.data[key]);
          if (field.success) recovered[key] = field.data;
        }
        const entries = z.array(z.unknown()).safeParse(record.data.history);
        if (entries.success)
          recovered.history = entries.data.flatMap((entry) => {
            const result = sessionResultSchema.safeParse(entry);
            return result.success ? [result.data] : [];
          });
        return {
          data: savedDataSchema.parse(recovered),
          error:
            'Saved study data has a damaged format. Readable records were recovered in memory; the original is unchanged. Saving is paused until you explicitly clear local data.',
        };
      }
      return {
        data: freshData(),
        error:
          'Saved study data has an unsupported or damaged format. Defaults are in use. Clear local data to reset it.',
      };
    }
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
      withSessionOrigins(sessionResultSchema.parse(result)),
      ...data.history.filter((r) => r.id !== result.id),
    ],
  };
}
