import type { Question, Taxonomy } from '../grounding/schema';
import { hasPlayableIdentity } from './availability';
import {
  readinessThresholdsSchema,
  type Credential,
  type DungeonReadiness,
  type ReadinessThresholds,
  type RealismRubric,
} from './schema';

export interface ContentStats {
  verifiedQuestionCount: number;
  majorFloorCount: number;
  coveredFloorCount: number;
  skillCount: number;
  coveredSkillCount: number;
  bossQuestionCount: number;
  blockingFailures: string[];
  majorGaps: string[];
  objectiveVersion: string | null;
  weightingPublished: boolean;
  weightingAvailable: boolean;
  thresholds?: ReadinessThresholds;
}

export function passesRealismRubric(
  rubric: RealismRubric | null,
  minimum = 18,
): boolean {
  if (!rubric) return false;
  const scores = Object.values(rubric.scores);
  if (rubric.version === 2)
    return (
      scores.length === 12 &&
      scores.every(
        (score) => Number.isInteger(score) && score >= 1 && score <= 4,
      ) &&
      scores.reduce((sum, score) => sum + score, 0) >= Math.max(44, minimum) &&
      rubric.scores.accuracy === 4 &&
      rubric.scores.answerUniqueness === 4 &&
      rubric.scores.documentationStrength === 4 &&
      rubric.scores.citationSpecificity === 4 &&
      rubric.scores.distractorEvidence >= 3
    );
  return (
    scores.length === 10 &&
    scores.every(
      (score) => score >= 1 && score <= 2 && Number.isInteger(score),
    ) &&
    scores.reduce((sum, score) => sum + score, 0) >= Math.max(18, minimum) &&
    rubric.scores.accuracy === 2 &&
    rubric.scores.answerUniqueness === 2 &&
    rubric.scores.documentationStrength === 2
  );
}

export function getDungeonReadiness(
  credential: Credential,
  stats: ContentStats,
): DungeonReadiness {
  const threshold = stats.thresholds ?? readinessThresholdsSchema.parse({});
  const common: string[] = [];
  if (!hasPlayableIdentity(credential))
    common.push(
      credential.sealedReason ??
        'Sealed dungeon — requires a verified active identity or explicitly enabled beta study access.',
    );
  if (
    ['stale', 'unavailable', 'validating'].includes(credential.contentReadiness)
  )
    common.push(
      `The catalog marks this dungeon ${credential.contentReadiness}.`,
    );
  if (
    !credential.objectiveVersion ||
    credential.objectiveVersion !== stats.objectiveVersion
  )
    common.push(
      'The objective map is missing or changed; independent re-review is required.',
    );
  if (!stats.majorFloorCount || stats.coveredFloorCount < stats.majorFloorCount)
    common.push('Not every major floor has verified encounters.');
  common.push(...stats.blockingFailures);
  const studyReasons = [...common];
  const studyMinimum = Math.max(
    threshold.studyMinimum,
    credential.minimumPlayableQuestionCount,
  );
  if (stats.verifiedQuestionCount < studyMinimum)
    studyReasons.push(
      `Torchlight Run needs ${studyMinimum} verified encounters; ${stats.verifiedQuestionCount} available.`,
    );
  const gauntletReasons = [...studyReasons];
  if (stats.verifiedQuestionCount < threshold.gauntletMinimum)
    gauntletReasons.push(
      `Boss Gauntlet needs ${threshold.gauntletMinimum} verified encounters; ${stats.verifiedQuestionCount} available.`,
    );
  if (!stats.skillCount || stats.coveredSkillCount < stats.skillCount)
    gauntletReasons.push(
      'Boss Gauntlet needs verified breadth across every skill.',
    );
  if (!stats.bossQuestionCount)
    gauntletReasons.push(
      'Boss Gauntlet needs independently reviewed Advanced or Expert encounters.',
    );
  if (stats.weightingPublished && !stats.weightingAvailable)
    gauntletReasons.push(
      'Published floor weighting must be available before the gauntlet opens.',
    );
  gauntletReasons.push(...stats.majorGaps);
  return {
    study: studyReasons.length === 0,
    gauntlet: gauntletReasons.length === 0,
    reasons: [...new Set(gauntletReasons)],
  };
}

export function buildContentStats(
  questions: Question[],
  taxonomy: Taxonomy,
  objectiveVersion: string,
  blockingFailures: string[] = [],
  thresholds = readinessThresholdsSchema.parse({}),
): ContentStats {
  const skills = taxonomy.domains.flatMap((domain) =>
    domain.skills.map((skill) => ({ domainId: domain.id, skillId: skill.id })),
  );
  const weightCount = taxonomy.domains.filter(
    (domain) => domain.weightRange != null,
  ).length;
  return {
    verifiedQuestionCount: questions.length,
    majorFloorCount: taxonomy.domains.length,
    coveredFloorCount: taxonomy.domains.filter((domain) =>
      questions.some((q) => q.objectiveDomain === domain.id),
    ).length,
    skillCount: skills.length,
    coveredSkillCount: skills.filter(
      ({ domainId, skillId }) =>
        questions.filter(
          (q) => q.objectiveDomain === domainId && q.skill === skillId,
        ).length >= thresholds.minimumQuestionsPerSkill,
    ).length,
    bossQuestionCount: questions.filter((q) =>
      ['advanced', 'expert'].includes(q.difficulty),
    ).length,
    blockingFailures,
    majorGaps: [],
    objectiveVersion,
    weightingPublished: weightCount > 0,
    weightingAvailable: weightCount === taxonomy.domains.length,
    thresholds,
  };
}
