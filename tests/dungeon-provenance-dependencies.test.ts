import { describe, expect, it } from 'vitest';
import {
  validatedSupportingSourceIds,
  validateSourceProvenance,
} from '../src/features/dungeons/provenance';
import { validateDungeonPackage } from '../src/features/dungeons/validation';
import { questionFingerprint } from '../src/features/dungeons/review';
import type { Source } from '../src/features/grounding/schema';
import { strictFixture } from './dungeon-three-pass-fixtures';

// Synthetic construction only: these bindings never modify production questions or reviews.
function retarget(
  raw: ReturnType<typeof strictFixture>['raw'],
  index: number,
  source: Source,
) {
  const q = raw.questions[index];
  q.sourceIds = [source.sourceId];
  q.sourceUrls = [source.url];
  q.documentationTitles = [source.title];
  q.verifiedAgainstSourceIds =
    q.verificationStatus === 'verified' ? q.sourceIds : [];
  const hash = questionFingerprint(q);
  const stages = raw.validationMetadata.encounters[q.id];
  for (const review of [raw.reviews.reviews[index], stages.technical?.review]) {
    if (!review) continue;
    review.questionFingerprint = hash;
    review.sourceReviews = [
      {
        ...review.sourceReviews[0],
        sourceId: source.sourceId,
        url: source.url,
        retrievedAt: source.retrievedAt,
        lastReviewedAt: source.lastReviewedAt,
      },
    ];
    for (const choice of review.choiceReviews) choice.sourceIds = q.sourceIds;
  }
  const envelope = raw.encounterMetadata.encounters[q.id];
  envelope.questionFingerprint = hash;
  envelope.sourceIds = q.sourceIds;
  for (const claim of [
    ...envelope.answerEvidence,
    ...envelope.distractorEvidence,
  ])
    claim.sourceIds = q.sourceIds;
  stages.generation.questionFingerprint = hash;
  for (const claim of stages.generation.claims) claim.sourceIds = q.sourceIds;
  if (stages.adversarial) {
    stages.adversarial.questionFingerprint = hash;
    for (const challenge of stages.adversarial.optionChallenges)
      challenge.sourceIds = q.sourceIds;
  }
}

function dependentFixture(verifiedDepends = true) {
  const fixture = strictFixture(26, 'doc');
  const { raw } = fixture;
  const source: Source = {
    ...raw.manifest.sources[0],
    sourceId: 'synthetic-ancestor',
    title: 'Synthetic training ancestor',
    url: 'https://learn.microsoft.com/en-us/training/modules/synthetic-ancestor/1-introduction',
    featureStatus: 'Not applicable',
  };
  raw.manifest.sources.push(source);
  const doc = raw.sourceRegistry.sources[1];
  const ancestor = {
    ...structuredClone(doc),
    sourceId: source.sourceId,
    title: source.title,
    canonicalUrl: source.url,
    sourceClass: 'training' as const,
    parents: [
      {
        ...doc.parents[0],
        sourceId: 'guide',
        targetUrl: source.url,
        canonicalUrl: source.url,
      },
    ],
  };
  raw.sourceRegistry.sources.push(ancestor);
  if (verifiedDepends) doc.parents[0].sourceId = source.sourceId;
  const candidate = raw.questions[25];
  candidate.verificationStatus = 'candidate';
  candidate.requiresManualReview = true;
  delete candidate.verifiedAt;
  candidate.verificationNotes =
    'Synthetic pending source-ancestry review; no independent technical or adversarial approval is asserted.';
  raw.reviews.reviews[25].verdict = 'candidate';
  raw.reviews.reviews[25].verificationNotes = candidate.verificationNotes;
  raw.encounterMetadata.encounters[candidate.id].rubric = null;
  const stages = raw.validationMetadata.encounters[candidate.id];
  delete stages.technical;
  delete stages.adversarial;
  retarget(raw, 25, source);
  return { ...fixture, ancestor, source };
}

const defects = [
  'training-product-url',
  'wrong-exam',
  'malformed-record',
  'missing-record',
  'wrong-parent-class',
  'cycle',
  'wrong-objective',
  'binding-mismatch',
] as const;

function breakAncestor(
  fixture: ReturnType<typeof dependentFixture>,
  defect: (typeof defects)[number],
) {
  const { raw, ancestor, source } = fixture;
  switch (defect) {
    case 'training-product-url':
      source.url =
        'https://learn.microsoft.com/en-us/fabric/security/synthetic-not-training';
      ancestor.canonicalUrl = source.url;
      ancestor.parents[0].targetUrl = source.url;
      ancestor.parents[0].canonicalUrl = source.url;
      retarget(raw, 25, source);
      break;
    case 'wrong-exam':
      ancestor.examCode = 'GH-600';
      break;
    case 'malformed-record':
      ancestor.contentRelevance = '';
      break;
    case 'missing-record':
      raw.sourceRegistry.sources = raw.sourceRegistry.sources.filter(
        (entry) => entry.sourceId !== ancestor.sourceId,
      );
      break;
    case 'wrong-parent-class':
      raw.sourceRegistry.sources[2] = { ...ancestor, sourceClass: 'doc' };
      break;
    case 'cycle': {
      const url =
        'https://learn.microsoft.com/en-us/training/modules/synthetic-cycle/1-introduction';
      const second = {
        ...structuredClone(ancestor),
        sourceId: 'synthetic-cycle',
        canonicalUrl: url,
        parents: [
          {
            ...ancestor.parents[0],
            sourceId: ancestor.sourceId,
            targetUrl: url,
            canonicalUrl: url,
          },
        ],
      };
      ancestor.parents[0].sourceId = second.sourceId;
      raw.sourceRegistry.sources.push(second);
      break;
    }
    case 'wrong-objective':
      ancestor.objectiveIds.push('unpublished-objective');
      break;
    case 'binding-mismatch':
      ancestor.title = 'Different from the manifest snapshot';
      break;
  }
}

describe('transitive provenance gates precede quarantine downgrades', () => {
  it('attributes an invalid training ancestor to its candidate and all 25 verified descendants', () => {
    const fixture = dependentFixture();
    breakAncestor(fixture, 'training-product-url');
    const { credential, raw } = fixture;
    const findings = validateSourceProvenance(
      credential,
      raw.taxonomy,
      raw.manifest,
      raw.questions,
      raw.sourceRegistry,
    );
    const ancestorFailure = findings.find((finding) =>
      finding.message.includes('Training must be a Learn self-paced'),
    );
    expect(ancestorFailure?.questionIds.sort()).toEqual(
      raw.questions.map((q) => q.id).sort(),
    );
    const dungeon = validateDungeonPackage(credential, raw);
    expect(dungeon.questions).toEqual([]);
    expect(dungeon.reviewedQuestions).toEqual([]);
    expect(
      dungeon.findings.find((finding) =>
        finding.message.includes('Training must be a Learn self-paced'),
      )?.severity,
    ).toBe('error');
  });

  it.each(defects)(
    'rejects descendant eligibility through %s ancestors',
    (defect) => {
      const fixture = dependentFixture();
      breakAncestor(fixture, defect);
      const { credential, raw } = fixture;
      const before = JSON.stringify(raw);
      expect(
        validatedSupportingSourceIds(
          credential,
          raw.taxonomy,
          raw.manifest,
          raw.sourceRegistry,
        ),
      ).not.toContain('fixture');
      const dungeon = validateDungeonPackage(credential, raw);
      expect(dungeon.questions).toEqual([]);
      expect(dungeon.reviewedQuestions).toEqual([]);
      expect(
        dungeon.findings.some(
          (finding) =>
            finding.code === 'source-provenance' &&
            finding.severity === 'error' &&
            finding.questionIds.includes(raw.questions[0].id),
        ),
      ).toBe(true);
      expect(JSON.stringify(raw)).toBe(before);
    },
  );

  it.each(['training-product-url', 'malformed-record'] as const)(
    'retains an unrelated verified branch when only a quarantined candidate depends on %s',
    (defect) => {
      const fixture = dependentFixture(false);
      breakAncestor(fixture, defect);
      const { credential, raw } = fixture;
      expect(
        validatedSupportingSourceIds(
          credential,
          raw.taxonomy,
          raw.manifest,
          raw.sourceRegistry,
        ),
      ).toEqual(['fixture']);
      const dungeon = validateDungeonPackage(credential, raw);
      expect(
        dungeon.findings.filter((finding) => finding.severity !== 'warning'),
      ).toEqual([]);
      expect(dungeon.questions).toHaveLength(25);
      expect(dungeon.reviewedQuestions).toHaveLength(25);
      expect(
        dungeon.findings
          .filter((finding) => finding.code === 'source-provenance')
          .every(
            (finding) =>
              finding.questionIds.length === 1 &&
              finding.questionIds[0] === raw.questions[25].id,
          ),
      ).toBe(true);
    },
  );

  it('does not let registry ordering alter dependent failure attribution or eligibility', () => {
    const fixture = dependentFixture();
    breakAncestor(fixture, 'cycle');
    const { credential, raw } = fixture;
    const first = validateSourceProvenance(
      credential,
      raw.taxonomy,
      raw.manifest,
      raw.questions,
      raw.sourceRegistry,
    );
    raw.sourceRegistry.sources.reverse();
    const second = validateSourceProvenance(
      credential,
      raw.taxonomy,
      raw.manifest,
      raw.questions,
      raw.sourceRegistry,
    );
    const signature = (findings: typeof first) =>
      findings
        .map(
          (finding) =>
            `${finding.message}|${[...finding.questionIds].sort().join(',')}`,
        )
        .sort();
    expect(signature(first)).toEqual(signature(second));
    expect(
      validatedSupportingSourceIds(
        credential,
        raw.taxonomy,
        raw.manifest,
        raw.sourceRegistry,
      ),
    ).toEqual([]);
  });
});
