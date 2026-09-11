import { z } from 'zod';
import {
  answerModes,
  complexities,
  difficulties,
  formats,
  orders,
  questionSchema,
  taxonomySchema,
  timestampSchema,
} from '../grounding/schema';

export const configSchema = z.object({
  credentialId: z.string().trim().min(1).optional(),
  runMode: z.enum(['study', 'gauntlet', 'raid']).optional(),
  raidCredentialIds: z.array(z.string().trim().min(1)).optional(),
  difficulty: z.enum([...difficulties, 'adaptive']),
  complexity: z.enum([...complexities, 'mixed']),
  questionCount: z.number().int().min(1).max(50),
  objectiveDomains: z.array(z.string()),
  skills: z.array(z.string()),
  subskills: z.array(z.string()),
  format: z.enum([...formats, 'mixed']),
  answerMode: z.enum(answerModes),
  timerMode: z.enum(['off', 'question', 'session']),
  timerSeconds: z.number().int().min(10).max(7200),
  order: z.enum(orders),
  practiceMode: z.enum(['all', 'weak']),
});
export type QuizConfig = z.infer<typeof configSchema>;
export const defaultConfig: QuizConfig = {
  credentialId: 'dp-700',
  runMode: 'study',
  difficulty: 'adaptive',
  complexity: 'mixed',
  questionCount: 10,
  objectiveDomains: [],
  skills: [],
  subskills: [],
  format: 'mixed',
  answerMode: 'immediate',
  timerMode: 'off',
  timerSeconds: 60,
  order: 'balanced',
  practiceMode: 'all',
};

export const banterLevels = ['full', 'balanced', 'reduced', 'none'] as const;
export type BanterLevel = (typeof banterLevels)[number];
export const preferencesSchema = z
  .object({
    theme: z.enum(['dark', 'light', 'system']),
    reducedBanter: z.boolean(),
    banterLevel: z.enum(banterLevels).optional(),
    reducedMotion: z.boolean(),
  })
  .transform((preferences) => {
    const banterLevel =
      preferences.banterLevel ??
      (preferences.reducedBanter ? 'reduced' : 'balanced');
    return {
      ...preferences,
      banterLevel,
      reducedBanter: banterLevel === 'reduced' || banterLevel === 'none',
    };
  });
export type Preferences = z.infer<typeof preferencesSchema>;
export type PreferencesInput = z.input<typeof preferencesSchema>;
export const defaultPreferences: Preferences = {
  theme: 'dark',
  reducedBanter: false,
  banterLevel: 'balanced',
  reducedMotion: false,
};

export const responseSchema = z.object({
  questionId: z.string(),
  selectedAnswer: z.array(z.string()),
  timeMs: z.number().nonnegative(),
  flagged: z.boolean(),
  submittedAt: timestampSchema,
  timedOut: z.boolean(),
});
export type QuizResponse = z.infer<typeof responseSchema>;
export const questionOriginSchema = z.object({
  credentialId: z.string().trim().min(1),
  objectiveVersion: z.string().trim().min(1),
  groundedAt: timestampSchema.optional(),
});
export type QuestionOrigin = z.infer<typeof questionOriginSchema>;
export const sessionMetadataSchema = z.object({
  credentialId: z.string().trim().min(1).optional(),
  questionOrigins: z.record(z.string(), questionOriginSchema).optional(),
  objectiveSnapshots: z.record(z.string(), taxonomySchema).optional(),
});
export const sessionResultSchema = z
  .object({
    ...sessionMetadataSchema.shape,
    id: z.string(),
    startedAt: timestampSchema,
    completedAt: timestampSchema,
    groundedAt: timestampSchema,
    config: configSchema,
    questions: z.array(questionSchema).min(1).max(50),
    responses: z.array(responseSchema).max(50),
  })
  .superRefine((result, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (
      result.credentialId &&
      result.config.credentialId &&
      result.credentialId !== result.config.credentialId
    )
      fail('Session identity must match its saved configuration.');
    if (
      new Set(result.questions.map((q) => q.id)).size !==
      result.questions.length
    )
      fail('Session question IDs must be unique.');
    if (result.questionOrigins) {
      const origins = result.questionOrigins;
      if (
        result.questions.some((q) => !origins[q.id]) ||
        Object.keys(origins).some(
          (id) => !result.questions.some((q) => q.id === id),
        )
      )
        fail('Every session question must have exactly one dungeon origin.');
      const primary =
        result.credentialId ?? result.config.credentialId ?? 'dp-700';
      if (
        result.config.runMode !== 'raid' &&
        Object.values(origins).some((origin) => origin.credentialId !== primary)
      )
        fail('Single-dungeon sessions cannot contain another dungeon.');
      for (const origin of Object.values(origins)) {
        const snapshot = result.objectiveSnapshots?.[origin.credentialId];
        if (
          snapshot &&
          snapshot.studyGuideEffectiveDate !== origin.objectiveVersion
        )
          fail('A saved objective map must match the question origin version.');
      }
    }
    if (
      new Set(result.responses.map((r) => r.questionId)).size !==
      result.responses.length
    )
      fail('Each question can only have one response.');
    for (const response of result.responses) {
      const question = result.questions.find(
        (q) => q.id === response.questionId,
      );
      if (
        !question ||
        response.selectedAnswer.some(
          (id) => !question.answerChoices.some((c) => c.id === id),
        )
      )
        fail('Response refers to an unknown question or answer.');
      if (
        new Set(response.selectedAnswer).size !== response.selectedAnswer.length
      )
        fail('Response selections must be unique.');
      if (
        question?.questionType !== 'multi-select' &&
        response.selectedAnswer.length > 1
      )
        fail('Only multi-select questions can have multiple selections.');
      if (response.timedOut && response.selectedAnswer.length)
        fail('A timeout must remain unanswered.');
    }
  });
export type SessionResult = z.infer<typeof sessionResultSchema>;

export interface ActiveSession {
  id: string;
  config: QuizConfig;
  questions: z.infer<typeof questionSchema>[];
  responses: QuizResponse[];
  startedAt: string;
  groundedAt: string;
  currentIndex: number;
  questionStartedAt: number;
  actualDifficulty?: (typeof difficulties)[number];
  credentialId?: string;
  questionOrigins?: Record<string, QuestionOrigin>;
  objectiveSnapshots?: z.infer<
    typeof sessionMetadataSchema
  >['objectiveSnapshots'];
}

export const labels: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
  adaptive: 'Adaptive',
  'concept-recall': 'Concept recall',
  'technical-implementation': 'Technical implementation',
  'scenario-based': 'Scenario based',
  troubleshooting: 'Troubleshooting',
  'architecture-design': 'Architecture and design',
  mixed: 'Mixed',
  'single-select': 'Single select',
  'multi-select': 'Multi-select',
  'true-false': 'True or false',
  scenario: 'Scenario based',
  code: 'Code interpretation',
  immediate: 'Immediate answers',
  'explanations-only': 'Explanations only',
  hidden: 'Answers at completion',
  study: 'Study coaching',
  exam: 'Exam mode',
  random: 'Random',
  'study-guide': 'Study-guide order',
  weakest: 'Weakest topics first',
  balanced: 'Balanced exam-style',
};
