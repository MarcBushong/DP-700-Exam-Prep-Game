import {
  difficulties,
  isPlayableQuestion,
  type Question,
  type Taxonomy,
} from '../grounding/schema';
import {
  configSchema,
  defaultConfig,
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
  const ids = new Set<string>();
  return bank.filter(
    (question) =>
      isPlayableQuestion(question) &&
      !ids.has(question.id) &&
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
        weakSkills.includes(question.skill)) &&
      Boolean(ids.add(question.id)),
  );
}

const conceptKey = (question: Question) =>
  (question.conceptId || question.id).trim().toLowerCase();

function uniqueConcepts(questions: Question[]) {
  const seen = new Set<string>();
  return questions.filter((question) => {
    const key = conceptKey(question);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function initialAdaptiveDifficulty(
  history: SessionResult[],
  config: QuizConfig = defaultConfig,
): Question['difficulty'] {
  const evidence: number[] = [];
  for (const result of history.slice(0, 20)) {
    for (const response of [...result.responses].reverse()) {
      const question = result.questions.find(
        (q) => q.id === response.questionId,
      );
      if (
        !question ||
        (config.objectiveDomains.length &&
          !config.objectiveDomains.includes(question.objectiveDomain)) ||
        (config.skills.length && !config.skills.includes(question.skill)) ||
        (config.subskills.length &&
          !config.subskills.includes(question.subskill)) ||
        (config.complexity !== 'mixed' &&
          config.complexity !== question.complexity) ||
        (config.format !== 'mixed' && config.format !== question.questionType)
      )
        continue;
      evidence.push(
        difficulties.indexOf(question.difficulty) +
          (isCorrect(question, response.selectedAnswer) ? 1 : -1),
      );
      if (evidence.length === 20) break;
    }
    if (evidence.length === 20) break;
  }
  if (evidence.length < 3) return 'intermediate';
  const level = Math.round(
    evidence.reduce((sum, value) => sum + value, 0) / evidence.length,
  );
  return difficulties[Math.max(0, Math.min(difficulties.length - 1, level))];
}

function balancedQuestions(
  pool: Question[],
  taxonomy: Taxonomy,
  config: QuizConfig,
  count: number,
  recentQuestionIds: readonly string[],
  initialDifficulty: Question['difficulty'],
) {
  const domains = taxonomy.domains.filter(
    (domain) =>
      !config.objectiveDomains.length ||
      config.objectiveDomains.includes(domain.id),
  );
  const totalWeight = domains.reduce(
    (sum, domain) => sum + (domain.weightRange[0] + domain.weightRange[1]) / 2,
    0,
  );
  const groups = domains.map((domain) => {
    const questions = pool.filter((q) => q.objectiveDomain === domain.id);
    const [low, high] = domain.weightRange;
    const subset = domains.length !== taxonomy.domains.length;
    const lowTotal = subset
      ? low +
        domains
          .filter((d) => d.id !== domain.id)
          .reduce((sum, d) => sum + d.weightRange[1], 0)
      : 100;
    const highTotal = subset
      ? high +
        domains
          .filter((d) => d.id !== domain.id)
          .reduce((sum, d) => sum + d.weightRange[0], 0)
      : 100;
    return {
      questions,
      weight: (low + high) / 2 / totalWeight,
      minimum: Math.ceil((count * low) / lowTotal - 1e-9),
      maximum: Math.floor((count * high) / highTotal + 1e-9),
      capacity: uniqueConcepts(questions).length,
      target: 0,
    };
  });
  const feasible =
    groups.every((g) => g.minimum <= Math.min(g.maximum, g.capacity)) &&
    groups.reduce((sum, g) => sum + g.minimum, 0) <= count &&
    groups.reduce((sum, g) => sum + Math.min(g.maximum, g.capacity), 0) >=
      count;
  for (const group of groups) group.target = feasible ? group.minimum : 0;
  for (
    let allocated = groups.reduce((sum, g) => sum + g.target, 0);
    allocated < count;
    allocated++
  ) {
    const group = groups
      .filter(
        (g) => g.target < Math.min(g.capacity, feasible ? g.maximum : count),
      )
      .sort(
        (a, b) => count * b.weight - b.target - (count * a.weight - a.target),
      )[0];
    if (!group) break;
    group.target++;
  }

  const slots: typeof groups = [];
  const scheduled = new Map<(typeof groups)[number], number>();
  for (let i = 0; i < count; i++) {
    const group = groups
      .filter((g) => (scheduled.get(g) ?? 0) < g.target)
      .sort(
        (a, b) =>
          ((i + 1) * b.target) / count -
          (scheduled.get(b) ?? 0) -
          (((i + 1) * a.target) / count - (scheduled.get(a) ?? 0)),
      )[0];
    if (!group) break;
    slots.push(group);
    scheduled.set(group, (scheduled.get(group) ?? 0) + 1);
  }
  const recent = new Set(recentQuestionIds);
  const assigned = new Map<string, number>();
  const selected: (Question | undefined)[] = [];
  // Match concepts to domain slots, allowing a shared concept to move to a
  // different domain instead of unnecessarily breaking the requested mix.
  const assign = (
    slot: number,
    unseenOnly: boolean,
    visited = new Set<string>(),
  ): boolean => {
    const candidates = [...slots[slot].questions];
    if (slot === 0 && config.difficulty === 'adaptive')
      candidates.sort(
        (a, b) =>
          Math.abs(
            difficulties.indexOf(a.difficulty) -
              difficulties.indexOf(initialDifficulty),
          ) -
          Math.abs(
            difficulties.indexOf(b.difficulty) -
              difficulties.indexOf(initialDifficulty),
          ),
      );
    candidates.sort(
      (a, b) =>
        Number(assigned.has(conceptKey(a))) -
        Number(assigned.has(conceptKey(b))),
    );
    for (const question of candidates) {
      const key = conceptKey(question);
      if (visited.has(key) || (unseenOnly && recent.has(question.id))) continue;
      visited.add(key);
      const owner = assigned.get(key);
      if (owner === undefined || assign(owner, unseenOnly, visited)) {
        assigned.set(key, slot);
        selected[slot] = question;
        return true;
      }
    }
    return false;
  };
  // Meet domain minimums before optional quota slots; otherwise an unseen
  // shared concept could crowd a required, previously seen domain out entirely.
  const requiredSlots: number[] = [];
  const optionalSlots: number[] = [];
  const occurrences = new Map<(typeof groups)[number], number>();
  for (let slot = 0; slot < slots.length; slot++) {
    const group = slots[slot];
    const occurrence = occurrences.get(group) ?? 0;
    (occurrence < group.minimum ? requiredSlots : optionalSlots).push(slot);
    occurrences.set(group, occurrence + 1);
  }
  for (const batch of [requiredSlots, optionalSlots]) {
    for (const slot of batch) assign(slot, true);
    for (const slot of batch) if (!selected[slot]) assign(slot, false);
  }
  // Sparse banks or cross-domain concept overlap can make the quotas impossible.
  for (let slot = 0; slot < slots.length; slot++) {
    if (selected[slot]) continue;
    const alternatives = [...groups].sort((a, b) => {
      const picked = (group: (typeof groups)[number]) =>
        selected.filter(
          (q) =>
            q && group.questions.some((candidate) => candidate.id === q.id),
        ).length;
      return (
        Number(picked(a) >= a.maximum) - Number(picked(b) >= b.maximum) ||
        count * b.weight - picked(b) - (count * a.weight - picked(a))
      );
    });
    for (const group of alternatives) {
      slots[slot] = group;
      if (assign(slot, true) || assign(slot, false)) break;
    }
  }
  const questions = selected.filter((q): q is Question => Boolean(q));
  const withinRanges = groups.every((group) => {
    const picked = questions.filter((q) =>
      group.questions.some((candidate) => candidate.id === q.id),
    ).length;
    return picked >= group.minimum && picked <= group.maximum;
  });
  return { questions, withinRanges };
}

export function selectQuestions(
  bank: Question[],
  taxonomy: Taxonomy,
  config: QuizConfig,
  history: SessionResult[] = [],
  random: () => number = Math.random,
  recentQuestionIds: readonly string[] = [],
) {
  let pool = eligibleQuestions(bank, config, history);
  const eligibleCount = uniqueConcepts(pool).length;
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
      `Only ${count} matching, distinct concepts are available. This session will contain ${count} unique questions, not ${config.questionCount}.`,
    );
  if (eligibleCount < pool.length)
    warnings.push(
      'Near-duplicate concepts are limited to one question per session.',
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
  const recent = new Map(recentQuestionIds.map((id, index) => [id, index]));
  const recency = (q: Question) =>
    recent.has(q.id) ? recentQuestionIds.length - recent.get(q.id)! : 0;
  pool = shuffle(pool, random).sort((a, b) => recency(a) - recency(b));
  const initialDifficulty = initialAdaptiveDifficulty(history, config);
  let selected: Question[];
  if (config.order === 'balanced') {
    const allocation = balancedQuestions(
      pool,
      taxonomy,
      config,
      count,
      recentQuestionIds,
      initialDifficulty,
    );
    selected = allocation.questions;
    if (!allocation.withinRanges)
      warnings.push(
        'Exact study-guide weight ranges are not possible with this question count and eligible domain/concept capacity. A capacity-adjusted weighted mix is used.',
      );
  } else {
    if (config.order === 'study-guide')
      pool.sort(
        (a, b) =>
          recency(a) - recency(b) ||
          skillOrder.indexOf(a.skill) - skillOrder.indexOf(b.skill) ||
          a.id.localeCompare(b.id),
      );
    if (config.order === 'weakest')
      pool.sort((a, b) => weakness(b) - weakness(a) || recency(a) - recency(b));
    if (config.difficulty === 'adaptive') {
      const domain = pool[0].objectiveDomain;
      const first = [...pool]
        .filter((q) => q.objectiveDomain === domain)
        .sort(
          (a, b) =>
            recency(a) - recency(b) ||
            Math.abs(
              difficulties.indexOf(a.difficulty) -
                difficulties.indexOf(initialDifficulty),
            ) -
              Math.abs(
                difficulties.indexOf(b.difficulty) -
                  difficulties.indexOf(initialDifficulty),
              ),
        )[0];
      pool = [first, ...pool.filter((q) => q.id !== first.id)];
    }
    selected = uniqueConcepts(pool).slice(0, count);
    if (config.order === 'study-guide')
      selected.sort(
        (a, b) => skillOrder.indexOf(a.skill) - skillOrder.indexOf(b.skill),
      );
  }
  if (config.difficulty === 'adaptive' && selected.length) {
    const first = closestRemainingQuestion(selected, 0, initialDifficulty);
    [selected[0], selected[first]] = [selected[first], selected[0]];
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
  actualDifficulty: Question['difficulty'] = 'intermediate',
): Question['difficulty'] {
  const recent = responses.slice(-3);
  if (!recent.length) return actualDifficulty;
  const last = questions.find((q) => q.id === recent.at(-1)?.questionId);
  const difficulty = last?.difficulty ?? actualDifficulty;
  const level = difficulties.indexOf(difficulty);
  const outcomes = recent.map((r) => {
    const question = questions.find((q) => q.id === r.questionId);
    return question?.difficulty === difficulty
      ? isCorrect(question, r.selectedAnswer)
      : undefined;
  });
  // Require three consecutive outcomes at the same actual difficulty. A
  // transition therefore needs fresh evidence, even if its target was unavailable.
  const delta =
    outcomes.length !== 3
      ? 0
      : outcomes.every((correct) => correct === true)
        ? 1
        : outcomes.every((correct) => correct === false)
          ? -1
          : 0;
  return difficulties[Math.max(0, Math.min(3, level + delta))];
}

function closestRemainingQuestion(
  questions: Question[],
  nextIndex: number,
  targetDifficulty: Question['difficulty'],
) {
  const target = difficulties.indexOf(targetDifficulty);
  const domain = questions[nextIndex].objectiveDomain;
  let closest = nextIndex;
  for (let i = nextIndex + 1; i < questions.length; i++) {
    if (
      questions[i].objectiveDomain === domain &&
      Math.abs(difficulties.indexOf(questions[i].difficulty) - target) <
        Math.abs(difficulties.indexOf(questions[closest].difficulty) - target)
    )
      closest = i;
  }
  return closest;
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
    // Keep the selected domain mix; adapt only within the next domain's remaining questions.
    const swapIndex = closestRemainingQuestion(
      questions,
      nextIndex,
      adaptiveDifficulty(
        questions,
        session.responses,
        session.actualDifficulty,
      ),
    );
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
    actualDifficulty: questions[nextIndex].difficulty,
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
