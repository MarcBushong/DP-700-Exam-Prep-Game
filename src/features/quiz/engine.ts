import {
  difficulties,
  type Question,
  type Taxonomy,
} from '../grounding/schema';
import {
  configSchema,
  type ActiveSession,
  type QuizConfig,
  type QuizResponse,
  type SessionResult,
} from './types';

export function shuffle<T>(
  values: readonly T[],
  random: () => number = Math.random,
): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(
      Math.min(0.999999999, Math.max(0, random())) * (i + 1),
    );
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function isCorrect(question: Question, selected: string[]): boolean {
  return (
    selected.length === question.correctAnswer.length &&
    new Set(selected).size === selected.length &&
    selected.every((id) => question.correctAnswer.includes(id))
  );
}

export function topicPerformance(history: SessionResult[]) {
  const topics = new Map<string, { total: number; correct: number }>();
  for (const result of history.slice(0, 20)) {
    for (const question of result.questions) {
      const topic = topics.get(question.skill) ?? { total: 0, correct: 0 };
      topic.total++;
      const response = result.responses.find(
        (r) => r.questionId === question.id,
      );
      if (response && isCorrect(question, response.selectedAnswer))
        topic.correct++;
      topics.set(question.skill, topic);
    }
  }
  return topics;
}

export function eligibleQuestions(
  bank: Question[],
  config: QuizConfig,
  history: SessionResult[] = [],
) {
  configSchema.parse(config);
  const topics = topicPerformance(history);
  const weakSkills = [...topics]
    .filter(([, p]) => p.correct < p.total)
    .map(([id]) => id);
  return bank.filter(
    (question) =>
      (config.objectiveDomains.length === 0 ||
        config.objectiveDomains.includes(question.objectiveDomain)) &&
      (config.skills.length === 0 || config.skills.includes(question.skill)) &&
      (config.subskills.length === 0 ||
        config.subskills.includes(question.subskill)) &&
      (config.difficulty === 'adaptive' ||
        question.difficulty === config.difficulty) &&
      (config.complexity === 'mixed' ||
        question.complexity === config.complexity) &&
      (config.format === 'mixed' || question.questionType === config.format) &&
      (config.practiceMode !== 'weak' ||
        weakSkills.length === 0 ||
        weakSkills.includes(question.skill)),
  );
}

export function selectQuestions(
  bank: Question[],
  taxonomy: Taxonomy,
  config: QuizConfig,
  history: SessionResult[] = [],
  random: () => number = Math.random,
) {
  let pool = eligibleQuestions(bank, config, history);
  const eligibleCount = pool.length;
  const warnings: string[] = [];
  if (!eligibleCount)
    return {
      questions: [],
      eligibleCount,
      warnings: ['No questions match these filters. Broaden your selection.'],
    };
  const count = Math.min(config.questionCount, eligibleCount);
  if (count < config.questionCount)
    warnings.push(
      `Only ${count} matching questions are available. This session will contain ${count} unique questions, not ${config.questionCount}.`,
    );
  const topics = topicPerformance(history);
  if (
    config.practiceMode === 'weak' &&
    ![...topics.values()].some((p) => p.correct < p.total)
  ) {
    warnings.push(
      'No previously missed topics are available. This will be a general practice session.',
    );
  }
  const skillOrder = taxonomy.domains.flatMap((d) => d.skills.map((s) => s.id));
  const weakness = (q: Question) => {
    const score = topics.get(q.skill);
    return score ? 1 - score.correct / score.total : -1;
  };
  pool = shuffle(pool, random);
  let selected: Question[];
  if (config.order === 'balanced') {
    const groups = taxonomy.domains
      .map((domain) => ({
        domain,
        weight: (domain.weightRange[0] + domain.weightRange[1]) / 2,
        questions: pool.filter((q) => q.objectiveDomain === domain.id),
        picked: 0,
      }))
      .filter((group) => group.questions.length);
    const totalWeight = groups.reduce((sum, group) => sum + group.weight, 0);
    selected = [];
    for (let i = 0; i < count; i++) {
      const group = groups
        .filter((g) => g.questions.length)
        .sort(
          (a, b) =>
            ((i + 1) * b.weight) / totalWeight -
            b.picked -
            (((i + 1) * a.weight) / totalWeight - a.picked),
        )[0];
      const next = group.questions.shift();
      if (!next) throw new Error('Question allocation failed.');
      selected.push(next);
      group.picked++;
    }
  } else {
    if (config.order === 'study-guide')
      pool.sort(
        (a, b) =>
          skillOrder.indexOf(a.skill) - skillOrder.indexOf(b.skill) ||
          a.id.localeCompare(b.id),
      );
    if (config.order === 'weakest')
      pool.sort((a, b) => weakness(b) - weakness(a));
    selected = pool.slice(0, count);
  }
  return {
    questions: selected.map((q) => ({
      ...q,
      answerChoices:
        q.questionType === 'true-false'
          ? [...q.answerChoices]
          : shuffle(q.answerChoices, random),
    })),
    warnings,
    eligibleCount,
  };
}

export function feedbackVisibility(
  mode: QuizConfig['answerMode'],
  submitted: boolean,
  complete = false,
) {
  if (complete)
    return { explanation: true, answer: true, sources: true, coaching: false };
  const feedback = submitted && mode !== 'hidden' && mode !== 'exam';
  return {
    explanation: feedback,
    answer: feedback && mode !== 'explanations-only',
    sources: (feedback && mode !== 'explanations-only') || mode === 'study',
    coaching: mode === 'study',
  };
}

export function remainingSeconds(
  session: ActiveSession,
  now: number,
): number | null {
  if (session.config.timerMode === 'off') return null;
  const start =
    session.config.timerMode === 'session'
      ? Date.parse(session.startedAt)
      : session.questionStartedAt;
  return Math.max(
    0,
    Math.ceil((start + session.config.timerSeconds * 1000 - now) / 1000),
  );
}

export function makeResponse(
  question: Question,
  selected: string[],
  flagged: boolean,
  startedAt: number,
  now: number,
  timedOut = false,
): QuizResponse {
  if (
    selected.some(
      (id) => !question.answerChoices.some((choice) => choice.id === id),
    ) ||
    new Set(selected).size !== selected.length
  )
    throw new Error('Invalid answer selection.');
  if (question.questionType !== 'multi-select' && selected.length > 1)
    throw new Error('Choose one answer for this question.');
  return {
    questionId: question.id,
    selectedAnswer: [...selected],
    flagged,
    timeMs: Math.max(0, now - startedAt),
    submittedAt: new Date(now).toISOString(),
    timedOut,
  };
}

export function adaptiveDifficulty(
  questions: Question[],
  responses: QuizResponse[],
): Question['difficulty'] {
  const recent = responses.slice(-3);
  if (!recent.length) return 'intermediate';
  const last = questions.find((q) => q.id === recent.at(-1)?.questionId);
  const level = last ? difficulties.indexOf(last.difficulty) : 1;
  const correct = recent.filter((r) => {
    const question = questions.find((q) => q.id === r.questionId);
    return question && isCorrect(question, r.selectedAnswer);
  }).length;
  const delta =
    correct / recent.length >= 2 / 3
      ? 1
      : correct / recent.length <= 1 / 3
        ? -1
        : 0;
  return difficulties[Math.max(0, Math.min(3, level + delta))];
}

export function advanceSession(
  session: ActiveSession,
  now: number,
): ActiveSession {
  const nextIndex = session.currentIndex + 1;
  if (nextIndex >= session.questions.length)
    throw new Error('Session is already at its last question.');
  const questions = [...session.questions];
  if (session.config.difficulty === 'adaptive') {
    const target = difficulties.indexOf(
      adaptiveDifficulty(questions, session.responses),
    );
    // Keep the selected domain mix; adapt only within the next domain's remaining questions.
    const domain = questions[nextIndex].objectiveDomain;
    const remaining = questions.slice(nextIndex);
    const next = remaining
      .filter((q) => q.objectiveDomain === domain)
      .sort(
        (a, b) =>
          Math.abs(difficulties.indexOf(a.difficulty) - target) -
          Math.abs(difficulties.indexOf(b.difficulty) - target),
      )[0];
    const swapIndex = questions.findIndex((q) => q.id === next.id);
    [questions[nextIndex], questions[swapIndex]] = [
      questions[swapIndex],
      questions[nextIndex],
    ];
  }
  return {
    ...session,
    questions,
    currentIndex: nextIndex,
    questionStartedAt: now,
  };
}

export function completeSession(
  session: ActiveSession,
  now: number,
): SessionResult {
  return {
    id: session.id,
    config: session.config,
    questions: session.questions,
    responses: session.responses,
    startedAt: session.startedAt,
    completedAt: new Date(now).toISOString(),
    groundedAt: session.groundedAt,
  };
}
