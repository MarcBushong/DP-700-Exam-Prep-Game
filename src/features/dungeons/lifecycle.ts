import type { Question, Taxonomy } from '../grounding/schema';

export function diffObjectives(
  previous: Taxonomy,
  current: Taxonomy,
  questions: Question[] = [],
) {
  const flatten = (taxonomy: Taxonomy) =>
    taxonomy.domains.flatMap((domain) =>
      domain.skills.flatMap((skill) =>
        skill.subskills.map((subskill) =>
          JSON.stringify([
            domain.id,
            domain.title,
            domain.weightRange ?? null,
            skill.id,
            skill.title,
            subskill,
          ]),
        ),
      ),
    );
  const before = flatten(previous);
  const after = flatten(current);
  const removed = before.filter((entry) => !after.includes(entry));
  const added = after.filter((entry) => !before.includes(entry));
  const versionChanged =
    previous.studyGuideEffectiveDate !== current.studyGuideEffectiveDate;
  return {
    previousVersion: previous.studyGuideEffectiveDate,
    currentVersion: current.studyGuideEffectiveDate,
    versionChanged,
    added,
    removed,
    affectedQuestionIds: questions
      .filter(
        (q) =>
          versionChanged ||
          !current.domains.some(
            (domain) =>
              domain.id === q.objectiveDomain &&
              domain.skills.some(
                (skill) =>
                  skill.id === q.skill && skill.subskills.includes(q.subskill),
              ),
          ) ||
          removed.some((entry) => {
            const [domain, , , skill, , subskill] = JSON.parse(
              entry,
            ) as string[];
            return (
              domain === q.objectiveDomain &&
              skill === q.skill &&
              subskill === q.subskill
            );
          }),
      )
      .map((q) => q.id),
    policy:
      'Review this diff against actual retrieved evidence. Preserve prior objective versions and historical sessions. Existing envelopes remain stale until independently re-reviewed; this report changes no files.',
  };
}
