import { describe, expect, it } from 'vitest';
import { extractTaxonomy, slug } from '../src/features/grounding/taxonomy';
import { date } from './fixtures';

const guide = `# Example guide
## About this exam
### Outdated domain (50-60%)
## Skills measured as of July 21, 2026
### Skills at a glance
- A summary, not a subskill
### Manage an analytics solution (30\u201335%)
#### Configure workspace settings
- Configure Spark settings
- Configure OneLake settings
### Ingest and transform data (40-45%)
#### Load batch data
- Choose a data store
## Study resources
- A resource is not a skill
## Change log
### Former domain (20-25%)
`;
const url =
  'https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700';

describe('dynamic study-guide taxonomy', () => {
  it('extracts headings, percentages and bullets only within current measured skills', () => {
    const result = extractTaxonomy(guide, date, url);
    expect(result.studyGuideEffectiveDate).toBe('July 21, 2026');
    expect(result.retrievedAt).toBe(date);
    expect(result.domains).toHaveLength(2);
    expect(result.domains[0].weightRange).toEqual([30, 35]);
    expect(result.domains[1].weightRange).toEqual([40, 45]);
    expect(result.domains[0].skills[0].subskills).toEqual([
      'Configure Spark settings',
      'Configure OneLake settings',
    ]);
    expect(result.domains[1].skills[0].subskills).toEqual([
      'Choose a data store',
    ]);
    expect(slug('  SQL & PySpark  ')).toBe('sql-pyspark');
  });
  it('fails closed on changed headings or malformed weight ranges', () => {
    expect(() =>
      extractTaxonomy(
        guide.replace('Skills measured as of', 'A different heading'),
        date,
        url,
      ),
    ).toThrow();
    expect(() =>
      extractTaxonomy(guide.replace('40-45%', '90-20%'), date, url),
    ).toThrow();
    expect(() =>
      extractTaxonomy(guide.replaceAll('### ', '# '), date, url),
    ).toThrow();
  });
});
