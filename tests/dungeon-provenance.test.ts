import { describe, expect, it } from 'vitest';
import {
  strictEvidenceUrlSchema,
  validatedSupportingSourceIds,
  validateSourceProvenance,
  type SourceRegistry,
} from '../src/features/dungeons/provenance';
import { strictFixture } from './dungeon-three-pass-fixtures';
import { dungeonFixture } from './dungeon-fixtures';
import { validateDungeonPackage } from '../src/features/dungeons/validation';

const inspect = (fixture: ReturnType<typeof strictFixture>) =>
  validateSourceProvenance(
    fixture.credential,
    fixture.raw.taxonomy,
    fixture.raw.manifest,
    fixture.raw.questions,
    fixture.raw.sourceRegistry,
  );

describe('guide-linked official source provenance', () => {
  it('binds actual metadata fields and a bounded direct guide link', () => {
    expect(inspect(strictFixture())).toEqual([]);
  });
  it.each([
    'https://learn.microsoft.com/en-us/azure/search/hybrid-search-overview',
    'https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/video/overview',
  ])(
    'admits product documentation %s only with approved ancestry and credential permission',
    (url) => {
      const fixture = strictFixture();
      expect(strictEvidenceUrlSchema.safeParse(url).success).toBe(true);
      const source = fixture.raw.manifest.sources[0];
      source.url = url;
      const record = fixture.raw.sourceRegistry.sources[1];
      record.canonicalUrl = url;
      record.parents[0].targetUrl = url;
      record.parents[0].canonicalUrl = url;
      expect(inspect(fixture)).toEqual([]);
      fixture.credential.sourceAllowlist = [];
      expect(inspect(fixture).some((f) => /allowlist/.test(f.message))).toBe(
        true,
      );
      fixture.credential.sourceAllowlist = [
        { host: 'learn.microsoft.com', pathPrefixes: [], exactUrls: [url] },
      ];
      record.parents = [];
      expect(inspect(fixture).some((f) => /ancestry/.test(f.message))).toBe(
        true,
      );
    },
  );
  it('records mixed Learn MCP and GitHub retrieval without waiving strict provenance', () => {
    const fixture = strictFixture(25);
    fixture.raw.manifest.retrievalMethod =
      'Microsoft Learn MCP and official GitHub documentation';
    expect(
      validateDungeonPackage(fixture.credential, fixture.raw).questions,
    ).toHaveLength(25);
    fixture.raw.sourceRegistry.sources[1].parents = [];
    expect(
      validateDungeonPackage(fixture.credential, fixture.raw).questions,
    ).toHaveLength(0);
  });
  it('does not enable mixed-provider evidence for a legacy Microsoft package', () => {
    const fixture = dungeonFixture();
    fixture.raw.manifest.retrievalMethod =
      'Microsoft Learn MCP and official GitHub documentation';
    expect(
      validateDungeonPackage(fixture.credential, fixture.raw).findings.some(
        (finding) =>
          finding.message ===
          'Retrieval method does not match the credential provider.',
      ),
    ).toBe(true);
  });
  it.each([
    'http://docs.github.com/en/copilot/overview',
    'https://docs.github.com.evil.test/en/copilot/overview',
    'https://resources.github.com/copilot-trust-center/',
    'https://github.blog/ai-and-ml/',
    'https://learn.microsoft.com/en-us/training/modules/example/knowledge-check',
    'https://learn.microsoft.com/en-us/answers/questions/1/',
    'https://learn.microsoft.com/en-us/shows/example/',
    'https://learn.microsoft.com/en-us/search/',
    'https://learn.microsoft.com/en-us/azure/search/',
    'https://learn.microsoft.com/en-us/azure/search/hybrid-search-overview?terms=search',
    'https://learn.microsoft.com/en-us/azure/search/assessment',
    'https://learn.microsoft.com/en-us/azure/search/knowledge-check',
    'https://learn.microsoft.com/en-us/azure/search/nested/results',
    'https://learn.microsoft.com/en-us/private/search/results',
    'https://docs.github.com/en/search/results',
    'https://learn.microsoft.com/en-us/videos/overview',
    'https://learn.microsoft.com/en-us/training/modules/example/video',
    'https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/video/',
    'https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/video/overview?video=1',
    'https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/video/private/overview',
    'https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/video/assessment',
    'https://user:password@docs.github.com/en/copilot/overview',
    'https://docs.github.com/en/copilot/overview?redirect=https://evil.test',
  ])('rejects unsafe or disallowed evidence %s', (url) => {
    expect(strictEvidenceUrlSchema.safeParse(url).success).toBe(false);
  });
  it.each([
    'missing-parent',
    'doc-parent',
    'foreign-exam',
    'wrong-title',
    'wrong-url',
    'wrong-review-date',
    'future-date',
    'unknown-objective',
    'wrong-redirect',
    'future-receipt',
    'missing-source',
    'duplicate-source',
  ])('rejects %s', (condition) => {
    const fixture = strictFixture();
    const records = fixture.raw.sourceRegistry.sources;
    const source = records[1];
    switch (condition) {
      case 'missing-parent':
        source.parents = [];
        break;
      case 'doc-parent':
        source.parents[0].sourceId = source.sourceId;
        break;
      case 'foreign-exam':
        source.examCode = 'GH-600';
        break;
      case 'wrong-title':
        source.title = 'Different document title';
        break;
      case 'wrong-url':
        source.canonicalUrl += '-other';
        break;
      case 'wrong-review-date':
        source.lastValidatedAt = '2026-09-11T17:00:00.000Z';
        break;
      case 'future-date':
        source.lastValidatedAt = '2999-01-01T00:00:00.000Z';
        break;
      case 'unknown-objective':
        source.objectiveIds.push('invented');
        break;
      case 'wrong-redirect':
        source.parents[0].canonicalUrl += '-other';
        break;
      case 'future-receipt':
        source.parents[0].retrievedAt = '2999-01-01T00:00:00.000Z';
        break;
      case 'missing-source':
        records.pop();
        break;
      case 'duplicate-source':
        records.push(structuredClone(source));
        break;
    }
    expect(inspect(fixture).length).toBeGreaterThan(0);
  });
  it('allows training module units through a linked training chain and explicit references', () => {
    const fixture = strictFixture();
    const records = fixture.raw.sourceRegistry.sources;
    const doc = records[1];
    for (const [id, parent] of [
      ['path', 'guide'],
      ['module', 'path'],
      ['unit', 'module'],
    ]) {
      const url = `https://learn.microsoft.com/en-us/training/${id === 'path' ? 'paths/example/' : id === 'module' ? 'modules/example/' : 'modules/example/1-introduction'}`;
      records.push({
        ...structuredClone(records[0]),
        sourceId: id,
        sourceClass: 'training',
        canonicalUrl: url,
        parents: [
          {
            ...doc.parents[0],
            sourceId: parent,
            targetUrl: url,
            canonicalUrl: url,
          },
        ],
      });
    }
    doc.parents[0].sourceId = 'unit';
    doc.parents[0].relation = 'explicit-reference';
    expect(inspect(fixture)).toEqual([]);
    records[2].parents[0].sourceId = 'unit';
    expect(inspect(fixture).some((f) => /cyclic/.test(f.message))).toBe(true);
  });
  it('allows only training to have an exact Learn credential parent', () => {
    const fixture = strictFixture();
    const records = fixture.raw.sourceRegistry.sources;
    const url = 'https://learn.microsoft.com/en-us/training/modules/example/';
    records.push({
      ...structuredClone(records[0]),
      sourceId: 'module',
      sourceClass: 'training',
      canonicalUrl: url,
      parents: [
        {
          ...records[1].parents[0],
          sourceId: undefined,
          credentialUrl: fixture.credential.officialUrls.credential!,
          canonicalUrl: url,
          targetUrl: url,
        },
      ],
    });
    expect(inspect(fixture)).toEqual([]);
    records[1].parents[0] = {
      ...records[2].parents[0],
      canonicalUrl: records[1].canonicalUrl,
    };
    expect(inspect(fixture).length).toBeGreaterThan(0);
  });
  it('preserves an exact credential-course-path bridge without granting course technical evidence', () => {
    const fixture = strictFixture();
    const records = fixture.raw.sourceRegistry.sources;
    const doc = records[1];
    const courseUrl =
      'https://learn.microsoft.com/en-us/training/courses/ai-200t00';
    const pathUrl = 'https://learn.microsoft.com/en-us/training/paths/example/';
    fixture.credential.officialUrls.training = courseUrl;
    const course: SourceRegistry['sources'][number] = {
      ...structuredClone(doc),
      sourceId: 'course',
      sourceClass: 'training' as const,
      canonicalUrl: courseUrl,
      parents: [
        {
          ...doc.parents[0],
          sourceId: undefined,
          credentialUrl: fixture.credential.officialUrls.credential!,
          targetUrl: courseUrl,
          canonicalUrl: courseUrl,
        },
      ],
    };
    const path = {
      ...structuredClone(doc),
      sourceId: 'path',
      sourceClass: 'training' as const,
      canonicalUrl: pathUrl,
      parents: [
        {
          ...doc.parents[0],
          sourceId: 'course',
          relation: 'explicit-reference' as const,
          targetUrl: pathUrl,
          canonicalUrl: pathUrl,
        },
      ],
    };
    records.push(course, path);
    doc.parents[0].sourceId = 'path';
    fixture.raw.manifest.sources.push({
      ...structuredClone(fixture.raw.manifest.sources[0]),
      sourceId: course.sourceId,
      url: courseUrl,
      featureStatus: 'Not applicable',
    });
    expect(inspect(fixture)).toEqual([]);
    expect(
      validatedSupportingSourceIds(
        fixture.credential,
        fixture.raw.taxonomy,
        fixture.raw.manifest,
        fixture.raw.sourceRegistry,
      ),
    ).toEqual([doc.sourceId]);

    const allowlist = fixture.credential.sourceAllowlist;
    fixture.credential.sourceAllowlist = [
      {
        host: 'learn.microsoft.com',
        pathPrefixes: [],
        exactUrls: [doc.canonicalUrl, courseUrl],
      },
    ];
    expect(
      inspect(fixture).some(
        (f) =>
          /ancestor.*allowlist/.test(f.message) &&
          f.questionIds.includes(fixture.raw.questions[0].id),
      ),
    ).toBe(true);
    expect(
      validatedSupportingSourceIds(
        fixture.credential,
        fixture.raw.taxonomy,
        fixture.raw.manifest,
        fixture.raw.sourceRegistry,
      ),
    ).toEqual([]);
    fixture.credential.sourceAllowlist = allowlist;
    fixture.credential.officialUrls.training = `${courseUrl}-unrelated`;
    expect(inspect(fixture).some((f) => /exact current/.test(f.message))).toBe(
      true,
    );
    fixture.credential.officialUrls.training = courseUrl;
    doc.parents[0].sourceId = 'course';
    expect(
      inspect(fixture).some((f) => /not a course overview/.test(f.message)),
    ).toBe(true);
    doc.parents[0].sourceId = 'path';
    course.parents[0] = {
      ...course.parents[0],
      credentialUrl: undefined,
      sourceId: 'path',
    };
    expect(inspect(fixture).some((f) => /directly/.test(f.message))).toBe(true);
  });
});
