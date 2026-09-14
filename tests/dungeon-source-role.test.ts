import { describe, expect, it } from 'vitest';
import { inspectContent } from '../src/features/grounding/schema';
import { validateDungeonPackage } from '../src/features/dungeons/validation';
import {
  validatedSupportingSourceIds,
  validateSourceProvenance,
} from '../src/features/dungeons/provenance';
import { strictFixture } from './dungeon-three-pass-fixtures';
import { dungeonFixture } from './dungeon-fixtures';
import { inspectAuthoringContent } from '../scripts/validate-questions';

describe('strict evidence roles are distinct from source feature availability', () => {
  it('still rejects an unbound option source ID after Not applicable source-role approval', () => {
    const { credential, raw } = strictFixture(1, 'doc');
    raw.manifest.sources[0].featureStatus = 'Not applicable';
    raw.reviews.reviews[0].choiceReviews[0].sourceIds = ['not-cited'];
    const dungeon = validateDungeonPackage(credential, raw);
    expect(
      dungeon.findings.some((finding) =>
        /validated training\/doc provenance/.test(finding.message),
      ),
    ).toBe(false);
    expect(
      dungeon.findings.some((finding) => finding.code === 'review-attestation'),
    ).toBe(true);
    expect(dungeon.reviewedQuestions).toEqual([]);
  });

  it('lets partial authoring validate Not applicable source roles without claiming later-pass approval', () => {
    const { credential, raw } = strictFixture(1, 'training');
    raw.manifest.sources[0].featureStatus = 'Not applicable';
    raw.questions[0].verificationStatus = 'candidate';
    raw.questions[0].requiresManualReview = true;
    const inspected = inspectAuthoringContent(
      raw,
      {
        ...credential,
        requiredReviewPolicy: raw.packageManifest.reviewPolicy,
      },
      raw.sourceRegistry,
    );
    expect(inspected.findings).toEqual([]);
    expect(inspected.allQuestions).toHaveLength(1);
    expect(inspected.allQuestions[0].verificationStatus).toBe('candidate');
    expect(inspected.questions).toEqual([]);
    expect(() =>
      inspectAuthoringContent(
        raw,
        {
          ...credential,
          requiredReviewPolicy: raw.packageManifest.reviewPolicy,
        },
        null,
      ),
    ).toThrow();
  });

  it.each(['doc', 'training'] as const)(
    'accepts an approved Not applicable %s source only with all independent stages intact',
    (sourceClass) => {
      const { credential, raw } = strictFixture(25, sourceClass);
      raw.manifest.sources[0].featureStatus = 'Not applicable';
      const before = JSON.stringify(raw);
      expect(
        validatedSupportingSourceIds(
          credential,
          raw.taxonomy,
          raw.manifest,
          raw.sourceRegistry,
        ),
      ).toEqual(['fixture']);
      const dungeon = validateDungeonPackage(
        {
          ...credential,
          requiredReviewPolicy: raw.packageManifest.reviewPolicy,
        },
        raw,
      );
      expect(
        dungeon.findings.filter((finding) => finding.severity !== 'warning'),
      ).toEqual([]);
      expect(dungeon.reviewedQuestions).toHaveLength(25);
      expect(dungeon.questions).toHaveLength(25);
      expect(dungeon.manifest.sources[0].featureStatus).toBe('Not applicable');
      expect(JSON.stringify(raw)).toBe(before);
    },
  );

  it('does not grant an evidence role just from the strict-policy flag', () => {
    const { credential, raw } = strictFixture(1, 'doc');
    raw.manifest.sources[0].featureStatus = 'Not applicable';
    const content = inspectContent(raw.questions, raw.manifest, raw.taxonomy, {
      ...credential,
      strictGuideLinked: true,
    });
    expect(content.questions).toEqual([]);
    expect(
      content.findings.some((finding) =>
        /validated training\/doc provenance/.test(finding.message),
      ),
    ).toBe(true);
  });

  it.each(['ancestry', 'source-id', 'binding', 'schema', 'allowlist'] as const)(
    'does not grant an implementation role to invalid/unapproved %s evidence',
    (condition) => {
      const { credential, raw } = strictFixture(1, 'doc');
      raw.manifest.sources[0].featureStatus = 'Not applicable';
      let registry: unknown = raw.sourceRegistry;
      switch (condition) {
        case 'ancestry':
          raw.sourceRegistry.sources[1].parents = [];
          break;
        case 'source-id':
          raw.sourceRegistry.sources[1].sourceId = 'unbound-id';
          break;
        case 'binding':
          raw.sourceRegistry.sources[1].title = 'Not the cited source';
          break;
        case 'schema':
          registry = { schemaVersion: 1, sources: [] };
          break;
        case 'allowlist':
          credential.sourceAllowlist = credential.sourceAllowlist.filter(
            (rule) => rule.host !== 'docs.github.com',
          );
          break;
      }
      expect(
        validatedSupportingSourceIds(
          credential,
          raw.taxonomy,
          raw.manifest,
          registry,
        ),
      ).toEqual([]);
      const dungeon = validateDungeonPackage(credential, {
        ...raw,
        sourceRegistry: registry,
      });
      expect(dungeon.reviewedQuestions).toEqual([]);
      expect(
        dungeon.findings.some((finding) =>
          /validated training\/doc provenance/.test(finding.message),
        ),
      ).toBe(true);
    },
  );

  it.each(['Not applicable', 'GA'] as const)(
    'excludes a valid guide-only registry even when the guide feature status is %s',
    (featureStatus) => {
      const { credential, raw } = strictFixture();
      const original = raw.manifest.sources[0];
      const guide = raw.sourceRegistry.sources[0];
      guide.objectiveIds = [
        ...original.applicableObjectiveDomains,
        ...original.applicableSkills,
      ];
      raw.manifest.sources = [
        {
          ...original,
          sourceId: guide.sourceId,
          url: guide.canonicalUrl,
          title: guide.title,
          featureStatus,
        },
      ];
      const q = raw.questions[0];
      q.sourceIds = [guide.sourceId];
      q.sourceUrls = [guide.canonicalUrl];
      q.documentationTitles = [guide.title];
      q.verifiedAgainstSourceIds = [guide.sourceId];
      expect(
        validateSourceProvenance(
          credential,
          raw.taxonomy,
          raw.manifest,
          raw.questions,
          raw.sourceRegistry,
        ),
      ).toEqual([]);
      const ids = validatedSupportingSourceIds(
        credential,
        raw.taxonomy,
        raw.manifest,
        raw.sourceRegistry,
      );
      expect(ids).toEqual([]);
      const content = inspectContent(
        raw.questions,
        raw.manifest,
        raw.taxonomy,
        {
          ...credential,
          strictGuideLinked: true,
          validatedSupportingSourceIds: ids,
        },
      );
      expect(content.questions).toEqual([]);
      expect(
        content.findings.some((finding) =>
          /validated training\/doc provenance/.test(finding.message),
        ),
      ).toBe(true);
    },
  );

  it('excludes credential overviews even if a registry labels the link doc', () => {
    const { credential, raw } = strictFixture(1, 'doc');
    const url = credential.officialUrls.credential!;
    raw.manifest.sources[0].url = url;
    raw.manifest.sources[0].featureStatus = 'Not applicable';
    const registered = raw.sourceRegistry.sources[1];
    registered.canonicalUrl = url;
    registered.parents[0].targetUrl = url;
    registered.parents[0].canonicalUrl = url;
    expect(
      validateSourceProvenance(
        credential,
        raw.taxonomy,
        raw.manifest,
        [],
        raw.sourceRegistry,
      ),
    ).toEqual([]);
    expect(
      validatedSupportingSourceIds(
        credential,
        raw.taxonomy,
        raw.manifest,
        raw.sourceRegistry,
      ),
    ).toEqual([]);
  });

  it.each(['technical', 'adversarial'] as const)(
    'does not promote Not applicable supporting evidence without %s review',
    (pass) => {
      const { credential, raw } = strictFixture(1, 'training');
      raw.manifest.sources[0].featureStatus = 'Not applicable';
      delete raw.validationMetadata.encounters[raw.questions[0].id][pass];
      const dungeon = validateDungeonPackage(credential, raw);
      expect(
        dungeon.findings.some((finding) =>
          /validated training\/doc provenance/.test(finding.message),
        ),
      ).toBe(false);
      expect(
        dungeon.findings.some((finding) =>
          finding.code.startsWith('three-pass-'),
        ),
      ).toBe(true);
      expect(dungeon.reviewedQuestions).toEqual([]);
    },
  );

  it('preserves the legacy Not applicable context-only rule', () => {
    const { credential, raw } = dungeonFixture();
    raw.manifest.sources[0].featureStatus = 'Not applicable';
    const dungeon = validateDungeonPackage(credential, raw);
    expect(dungeon.reviewedQuestions).toEqual([]);
    expect(
      dungeon.findings.some((finding) =>
        /at least one citation must support implementation, not context only/.test(
          finding.message,
        ),
      ),
    ).toBe(true);
    const inspected = inspectContent(
      raw.questions,
      raw.manifest,
      raw.taxonomy,
      {
        ...credential,
        validatedSupportingSourceIds: ['fixture'],
      },
    );
    expect(inspected.questions).toEqual([]);
  });
});
