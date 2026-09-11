import {
  isPlayableQuestion,
  type Question,
  type Taxonomy,
} from '../grounding/schema';
import { isCorrect } from '../quiz/engine';
import {
  historyForCredential,
  LEGACY_OBJECTIVE_VERSION,
  questionOrigin,
} from '../quiz/origins';
import type { ActiveSession, SessionResult } from '../quiz/types';

export interface CategoryScore {
  id: string;
  label: string;
  correct: number;
  total: number;
  percentage: number;
  insufficient: boolean;
  credentialId?: string;
  objectiveId?: string;
  uniqueQuestionCount?: number;
  verifiedSampleSize?: number;
  sampleSize?: number;
}

type ScoredKey =
  | 'objectiveDomain'
  | 'skill'
  | 'subskill'
  | 'difficulty'
  | 'complexity'
  | 'questionType';

// The optional taxonomy argument is retained for older callers. Historical
// objectives come only from the run's snapshot, never today's selected dungeon.
export function scoreSession(result: SessionResult, taxonomy?: Taxonomy) {
  void taxonomy;
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
    return {
      question,
      response,
      correct: right,
      answered,
      ...questionOrigin(result, question.id),
    };
  });
  const credentialIds = [...new Set(rows.map((row) => row.credentialId))];
  const mixed = credentialIds.length > 1;
  const group = (key: ScoredKey, selected = rows): CategoryScore[] => {
    const objective =
      key === 'objectiveDomain' || key === 'skill' || key === 'subskill';
    const groups = new Map<string, CategoryScore>();
    for (const row of selected) {
      const objectiveId = row.question[key];
      const id =
        objective && mixed
          ? `${row.credentialId}::${objectiveId}`
          : objectiveId;
      const snapshot = result.objectiveSnapshots?.[row.credentialId];
      const title = objective
        ? (snapshot?.domains.find((d) => d.id === objectiveId)?.title ??
          snapshot?.domains
            .flatMap((d) => d.skills)
            .find((s) => s.id === objectiveId)?.title ??
          objectiveId)
        : objectiveId;
      const current = groups.get(id) ?? {
        id,
        label: objective && mixed ? `${row.credentialId}: ${title}` : title,
        correct: 0,
        total: 0,
        percentage: 0,
        insufficient: true,
        sampleSize: 0,
        ...(objective ? { credentialId: row.credentialId, objectiveId } : {}),
      };
      current.total++;
      if (row.correct) current.correct++;
      current.sampleSize = (current.sampleSize ?? 0) + Number(row.answered);
      current.percentage = Math.round((current.correct / current.total) * 100);
      current.insufficient = current.sampleSize < 5;
      groups.set(id, current);
    }
    return [...groups.values()];
  };
  const bySkill = group('skill');
  const byDomain = group('objectiveDomain');
  const byCredential = credentialIds.map((credentialId) => {
    const ownRows = rows.filter((r) => r.credentialId === credentialId);
    const ownCorrect = ownRows.filter((r) => r.correct).length;
    const answeredRows = ownRows.filter((r) => r.answered);
    const snapshot = result.objectiveSnapshots?.[credentialId];
    const ownDomains = group('objectiveDomain', ownRows);
    const domainsCovered =
      snapshot?.domains.filter((d) =>
        ownDomains.some((s) => s.objectiveId === d.id),
      ).length ?? 0;
    const sufficient =
      Boolean(snapshot?.domains.length) &&
      answeredRows.length >= 15 &&
      snapshot!.domains.every((d) =>
        ownDomains.some((s) => s.objectiveId === d.id && !s.insufficient),
      );
    return {
      id: credentialId,
      credentialId,
      label: credentialId,
      correct: ownCorrect,
      total: ownRows.length,
      percentage: Math.round((ownCorrect / ownRows.length) * 100),
      insufficient: !sufficient,
      sampleSize: answeredRows.length,
      objectiveVersions: [...new Set(ownRows.map((r) => r.objectiveVersion))],
      objectiveSnapshotAvailable: Boolean(snapshot),
      advancedShare: answeredRows.length
        ? answeredRows.filter(
            (r) =>
              r.question.difficulty === 'advanced' ||
              r.question.difficulty === 'expert',
          ).length / answeredRows.length
        : 0,
      domainsCovered,
      domainsTotal: snapshot?.domains.length ?? null,
      byDomain: ownDomains,
      bySkill: group('skill', ownRows),
      bySubskill: group('subskill', ownRows),
      byType: group('questionType', ownRows),
      byDifficulty: group('difficulty', ownRows),
    };
  });
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
  const percentage = total ? Math.round((correct / total) * 100) : 0;
  const sufficient =
    byCredential.length > 0 && byCredential.every((c) => !c.insufficient);
  const verifiedSelectedCount = rows.filter((r) =>
    isPlayableQuestion(r.question),
  ).length;
  const verifiedSampleSize = rows.filter(
    (r) => r.answered && isPlayableQuestion(r.question),
  ).length;
  const answeredRows = rows.filter((r) => r.answered);
  const advancedShare = answeredRows.length
    ? answeredRows.filter(
        (r) =>
          r.question.difficulty === 'advanced' ||
          r.question.difficulty === 'expert',
      ).length / answeredRows.length
    : 0;
  const warnings: string[] = [];
  if (!sufficient)
    warnings.push(
      'Insufficient sample: at least 15 answered encounters and five answered per floor, per dungeon, are needed for a broad estimate.',
    );
  if (
    byCredential.some(
      (c) =>
        !c.objectiveSnapshotAvailable ||
        c.objectiveVersions.includes(LEGACY_OBJECTIVE_VERSION),
    )
  )
    warnings.push(
      'Legacy objective version or map is unknown. Historical points are preserved; current objectives are not substituted.',
    );
  if (byCredential.some((c) => c.advancedShare < 0.4))
    warnings.push(
      'Easy-heavy sample: fewer than 40% Advanced/Expert encounters. This is not balanced gauntlet evidence.',
    );
  if (verifiedSelectedCount !== total)
    warnings.push(
      'Some historical encounters lack verified evidence. Their original scores remain unchanged.',
    );
  const ready =
    sufficient &&
    byCredential.every((c) => c.advancedShare >= 0.4) &&
    verifiedSelectedCount === total &&
    percentage >= 80 &&
    warnings.length === 0;
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
    byCredential,
    byDungeon: byCredential,
    bySubskill: group('subskill'),
    byDifficulty: group('difficulty'),
    byComplexity: group('complexity'),
    byType: group('questionType'),
    weakest,
    strongest,
    rows,
    mastery: sufficient
      ? percentage >= 80
        ? 'Strong performance in sampled topics'
        : 'Developing performance in sampled topics'
      : 'Insufficient coverage to estimate mastery',
    readiness: {
      ready,
      label: ready
        ? 'Balanced in-game readiness estimate'
        : 'More varied practice needed',
      verifiedSampleSize,
      advancedShare,
      warnings,
      explanation:
        'In-game only: 80% correct, at least 15 answered encounters and five answered per floor per dungeon, at least 40% Advanced/Expert answers per dungeon, verified snapshots. Not an official score or pass prediction.',
      freshness: 'Saved evidence only; not a live documentation check.',
    },
    recommendations: weakest.map((skill) => ({
      ...skill,
      questions: rows
        .filter(
          (row) =>
            row.credentialId === skill.credentialId &&
            row.question.skill === skill.objectiveId &&
            !row.correct,
        )
        .map((row) => row.question),
    })),
  };
}

export function missedQuestions(
  result: SessionResult,
  credentialId?: string,
): Question[] {
  return result.questions.filter(
    (q) =>
      (!credentialId ||
        questionOrigin(result, q.id).credentialId === credentialId) &&
      !isCorrect(
        q,
        result.responses.find((r) => r.questionId === q.id)?.selectedAnswer ??
          [],
      ),
  );
}

export function cosmeticProgress(
  sessions: Pick<ActiveSession, 'questions' | 'responses'>[],
) {
  let correct = 0,
    mistakes = 0,
    streak = 0,
    bestStreak = 0;
  for (const session of sessions) {
    streak = 0;
    const seen = new Set<string>();
    for (const response of session.responses) {
      if (seen.has(response.questionId)) continue;
      seen.add(response.questionId);
      const question = session.questions.find(
        (q) => q.id === response.questionId,
      );
      if (!question) continue;
      if (isCorrect(question, response.selectedAnswer)) {
        correct++;
        streak++;
      } else {
        mistakes++;
        streak = 0;
      }
      bestStreak = Math.max(bestStreak, streak);
    }
  }
  const xp = correct * 10;
  return {
    xp,
    level: Math.floor(xp / 100) + 1,
    hp: Math.max(0, 100 - mistakes * 10),
    maxHp: 100,
    damageDealt: correct * 10,
    bestStreak,
    loot: Math.floor(correct / 5),
    cosmeticOnly: true as const,
  };
}

export interface DiscoveryCredential {
  credentialId: string;
  personas: string[];
  productAreas: string[];
}

export function discoveryProgress(
  history: SessionResult[],
  credentials: DiscoveryCredential[],
) {
  const group = (key: 'personas' | 'productAreas'): CategoryScore[] => {
    const groups = new Map<
      string,
      {
        correct: number;
        total: number;
        ids: Set<string>;
        verifiedIds: Set<string>;
      }
    >();
    for (const result of history) {
      for (const question of result.questions) {
        const origin = questionOrigin(result, question.id);
        const credential = credentials.find(
          (c) => c.credentialId === origin.credentialId,
        );
        const response = result.responses.find(
          (r) => r.questionId === question.id,
        );
        const correct = isCorrect(question, response?.selectedAnswer ?? []);
        for (const id of new Set(credential?.[key] ?? [])) {
          const score = groups.get(id) ?? {
            correct: 0,
            total: 0,
            ids: new Set<string>(),
            verifiedIds: new Set<string>(),
          };
          score.total++;
          if (correct) score.correct++;
          const identity = `${origin.credentialId}::${(question.conceptId || question.id).trim().toLowerCase()}`;
          score.ids.add(identity);
          if (response?.selectedAnswer.length && isPlayableQuestion(question))
            score.verifiedIds.add(identity);
          groups.set(id, score);
        }
      }
    }
    return [...groups].map(([id, score]) => ({
      id,
      label: id,
      correct: score.correct,
      total: score.total,
      percentage: Math.round((score.correct / score.total) * 100),
      insufficient: score.verifiedIds.size < 5,
      uniqueQuestionCount: score.ids.size,
      verifiedSampleSize: score.verifiedIds.size,
    }));
  };
  return { byClass: group('personas'), byArea: group('productAreas') };
}

export function historyInsights(
  history: SessionResult[],
  credentialId: string,
) {
  const ownHistory = historyForCredential(history, credentialId).sort(
    (a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt),
  );
  const latest = ownHistory[0];
  const comparableKey = (session: SessionResult) =>
    JSON.stringify({
      versions: [
        ...new Set(
          session.questions.map(
            (q) => questionOrigin(session, q.id).objectiveVersion,
          ),
        ),
      ].sort(),
      domains: [...session.config.objectiveDomains].sort(),
      skills: [...session.config.skills].sort(),
      subskills: [...session.config.subskills].sort(),
      difficulty: session.config.difficulty,
      complexity: session.config.complexity,
      format: session.config.format,
      answerMode: session.config.answerMode,
      runMode: session.config.runMode ?? 'study',
    });
  const comparable = (session: SessionResult) =>
    session.responses.filter((r) => r.selectedAnswer.length > 0).length >= 5 &&
    Boolean(session.objectiveSnapshots?.[credentialId]) &&
    session.questions.every(
      (q) =>
        questionOrigin(session, q.id).objectiveVersion !==
        LEGACY_OBJECTIVE_VERSION,
    );
  const previous =
    latest && comparable(latest)
      ? ownHistory
          .slice(1)
          .find(
            (r) => comparable(r) && comparableKey(r) === comparableKey(latest),
          )
      : undefined;
  const misses = new Map<
    string,
    { questionId: string; misses: number; lastMissedAt: string }
  >();
  for (const session of ownHistory) {
    for (const question of missedQuestions(session)) {
      if (
        !session.responses.find((r) => r.questionId === question.id)
          ?.selectedAnswer.length
      )
        continue;
      const existing = misses.get(question.id);
      if (existing) existing.misses++;
      else
        misses.set(question.id, {
          questionId: question.id,
          misses: 1,
          lastMissedAt: session.completedAt,
        });
    }
  }
  const recentScore = latest ? scoreSession(latest).percentage : null;
  const previousComparableScore = previous
    ? scoreSession(previous).percentage
    : null;
  return {
    credentialId,
    recentScore,
    previousComparableScore,
    improvementPercentagePoints:
      recentScore !== null && previousComparableScore !== null
        ? recentScore - previousComparableScore
        : null,
    improvementReason: previous
      ? 'Difference between the latest two comparable runs: same objective version and filters, with at least five encounters each. Small samples remain uncertain.'
      : 'Not enough comparable, versioned runs to estimate improvement.',
    repeatedErrors: [...misses.values()]
      .filter((m) => m.misses >= 2)
      .sort(
        (a, b) =>
          b.misses - a.misses || a.questionId.localeCompare(b.questionId),
      ),
  };
}
