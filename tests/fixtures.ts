import type { Question, Taxonomy } from '../src/features/grounding/schema';
import {
  defaultConfig,
  type ActiveSession,
  type SessionResult,
} from '../src/features/quiz/types';

export const date = '2026-09-11T16:05:00.000Z';
export const taxonomy: Taxonomy = {
  schemaVersion: 1,
  retrievedAt: date,
  studyGuideEffectiveDate: 'July 21, 2026',
  studyGuideUrl:
    'https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700',
  domains: [
    {
      id: 'manage',
      title: 'Manage',
      weightRange: [30, 35],
      skills: [{ id: 'security', title: 'Security', subskills: ['Access'] }],
    },
    {
      id: 'ingest',
      title: 'Ingest',
      weightRange: [30, 35],
      skills: [{ id: 'batch', title: 'Batch', subskills: ['Loading'] }],
    },
    {
      id: 'monitor',
      title: 'Monitor',
      weightRange: [30, 35],
      skills: [
        { id: 'performance', title: 'Performance', subskills: ['Tuning'] },
      ],
    },
  ],
};

export function question(
  id = 'q1',
  overrides: Partial<Question> = {},
): Question {
  return {
    id,
    question: `Original fixture ${id}: which documented option fits the stated data requirement?`,
    questionType: 'single-select',
    answerChoices: [
      { id: 'a', text: 'A suitable option' },
      { id: 'b', text: 'An unsuitable option' },
      { id: 'c', text: 'Another unsuitable option' },
    ],
    correctAnswer: ['a'],
    explanation: 'A is supported by the fixture.',
    deepExplanation:
      'This is synthetic test data, never shipped in the content bank.',
    whyOtherAnswersAreWrong: {
      b: 'This does not fit the requirement.',
      c: 'This also does not fit.',
    },
    objectiveDomain: 'manage',
    skill: 'security',
    subskill: 'Access',
    difficulty: 'intermediate',
    complexity: 'concept-recall',
    sourceIds: ['fixture'],
    sourceUrls: [
      'https://learn.microsoft.com/en-us/fabric/security/security-overview',
    ],
    documentationTitles: ['Fixture source'],
    generatedAt: date,
    lastValidatedAt: date,
    featureStatus: 'GA',
    tags: ['fixture'],
    ...overrides,
  };
}

export function active(questions = [question()]): ActiveSession {
  return {
    id: 'session',
    config: { ...defaultConfig, questionCount: questions.length },
    questions,
    responses: [],
    startedAt: date,
    groundedAt: date,
    currentIndex: 0,
    questionStartedAt: Date.parse(date),
  };
}

export function result(
  questions = [question()],
  correctIds: string[] = [],
): SessionResult {
  return {
    id: 'result',
    startedAt: date,
    completedAt: '2026-09-11T16:10:00.000Z',
    groundedAt: date,
    config: { ...defaultConfig, questionCount: questions.length },
    questions,
    responses: questions.map((q) => ({
      questionId: q.id,
      selectedAnswer: correctIds.includes(q.id) ? q.correctAnswer : ['b'],
      timeMs: 2000,
      flagged: false,
      submittedAt: date,
      timedOut: false,
    })),
  };
}
