import { taxonomySchema, type Taxonomy } from './schema';

export function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function extractTaxonomy(
  markdown: string,
  retrievedAt: string,
  studyGuideUrl: string,
): Taxonomy {
  const effective = markdown
    .match(/^## Skills measured as of (.+)$/m)?.[1]
    .trim();
  if (!effective)
    throw new Error(
      'Study guide effective-date heading changed. Review before updating content.',
    );
  const section = markdown
    .split(/^## Skills measured as of .+$/m)[1]
    ?.split(/^## /m)[0];
  if (!section) throw new Error('No measured-skills section found.');
  const domains: Taxonomy['domains'] = [];
  for (const raw of section.split('\n')) {
    const line = raw.trim();
    const domain = line.match(/^### (.+) \((\d+)[\u2013-](\d+)%\)$/);
    if (domain) {
      domains.push({
        id: slug(domain[1]),
        title: domain[1],
        weightRange: [Number(domain[2]), Number(domain[3])],
        skills: [],
      });
      continue;
    }
    const activeDomain = domains.at(-1);
    if (!activeDomain) continue;
    const skill = line.match(/^#### (.+)$/);
    if (skill) {
      activeDomain.skills.push({
        id: slug(skill[1]),
        title: skill[1],
        subskills: [],
      });
      continue;
    }
    const subskill = line.match(/^- (.+)$/)?.[1];
    if (subskill) activeDomain.skills.at(-1)?.subskills.push(subskill);
  }
  return taxonomySchema.parse({
    schemaVersion: 1,
    retrievedAt,
    studyGuideEffectiveDate: effective,
    studyGuideUrl,
    domains,
  });
}
