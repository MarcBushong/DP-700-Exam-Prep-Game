import type { Question, Taxonomy } from '../grounding/schema';
import { isCorrect } from '../quiz/engine';
import type { SessionResult } from '../quiz/types';

export interface CategoryScore {
  id: string;
  label: string;
  correct: number;
  total: number;
  percentage: number;
  insufficient: boolean;
}

export function scoreSession(result: SessionResult, taxonomy: Taxonomy) {
  let correct = 0,
    incorrect = 0,
    unanswered = 0,
    currentStreak = 0,
    bestStreak = 0;
  const flagged: string[] = [];
  const missed: string[] = [];
  const rows = result.questions.map((question) => {
    const response = result.responses.find((r) => r.questionId === question.id);
    const answered = Boolean(response?.selectedAnswer.length);
    const right =
      answered && isCorrect(question, response?.selectedAnswer ?? []);
    if (right) {
      correct++;
      currentStreak++;
    } else {
      currentStreak = 0;
      missed.push(question.id);
      if (answered) incorrect++;
      else unanswered++;
    }
    bestStreak = Math.max(bestStreak, currentStreak);
    if (response?.flagged) flagged.push(question.id);
    return { question, response, correct: right, answered };
  });
  const group = (
    key: 'objectiveDomain' | 'skill' | 'subskill' | 'difficulty' | 'complexity',
  ): CategoryScore[] => {
    const groups = new Map<string, { correct: number; total: number }>();
    for (const row of rows) {
      const id = row.question[key];
      const current = groups.get(id) ?? { correct: 0, total: 0 };
      current.total++;
      if (row.correct) current.correct++;
      groups.set(id, current);
    }
    return [...groups].map(([id, value]) => ({
      id,
      label:
        taxonomy.domains.find((d) => d.id === id)?.title ??
        taxonomy.domains.flatMap((d) => d.skills).find((s) => s.id === id)
          ?.title ??
        id,
      ...value,
      percentage: Math.round((value.correct / value.total) * 100),
      insufficient: value.total < 5,
    }));
  };
  const bySkill = group('skill');
  const byDomain = group('objectiveDomain');
  const weakest = [...bySkill]
    .filter((s) => s.correct < s.total)
    .sort((a, b) => a.percentage - b.percentage || b.total - a.total)
    .slice(0, 3);
  const strongest = [...bySkill]
    .sort((a, b) => b.percentage - a.percentage || b.total - a.total)
    .slice(0, 3);
  const timedResponses = result.responses.filter((r) =>
    result.questions.some((q) => q.id === r.questionId),
  );
  const totalTimeMs = timedResponses.reduce((sum, r) => sum + r.timeMs, 0);
  const total = result.questions.length;
  const percentage = Math.round((correct / total) * 100);
  const sufficient =
    total >= 15 &&
    taxonomy.domains.every((d) =>
      byDomain.some((s) => s.id === d.id && !s.insufficient),
    );
  return {
    correct,
    incorrect,
    unanswered,
    total,
    percentage,
    flagged,
    missed,
    currentStreak,
    bestStreak,
    totalTimeMs,
    averageTimeMs: timedResponses.length
      ? totalTimeMs / timedResponses.length
      : 0,
    byDomain,
    bySkill,
    bySubskill: group('subskill'),
    byDifficulty: group('difficulty'),
    byComplexity: group('complexity'),
    weakest,
    strongest,
    rows,
    mastery: sufficient
      ? percentage >= 80
        ? 'Strong performance in sampled topics'
        : 'Developing performance in sampled topics'
      : 'Insufficient coverage to estimate mastery',
    recommendations: weakest.map((skill) => ({
      ...skill,
      questions: rows
        .filter((row) => row.question.skill === skill.id && !row.correct)
        .map((row) => row.question),
    })),
  };
}

export function missedQuestions(result: SessionResult): Question[] {
  return result.questions.filter(
    (q) =>
      !isCorrect(
        q,
        result.responses.find((r) => r.questionId === q.id)?.selectedAnswer ??
          [],
      ),
  );
}
