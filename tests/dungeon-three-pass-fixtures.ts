import { dungeonFixture } from './dungeon-fixtures';
import { date } from './fixtures';
import {
  objectiveFingerprint,
  questionFingerprint,
} from '../src/features/dungeons/review';
import {
  rubricV2Criteria,
  type EncounterMetadataFile,
} from '../src/features/dungeons/schema';
import type { ValidationMetadata } from '../src/features/dungeons/threePass';
import type { SourceRegistry } from '../src/features/dungeons/provenance';
import type { Question } from '../src/features/grounding/schema';
import type { VerificationReview } from '../src/features/grounding/workflow';

// Synthetic structural tests only; no real source retrieval or review is asserted.
export function strictFixture(count = 1, sourceClass?: 'doc' | 'training') {
  const fixture = dungeonFixture();
  if (sourceClass) {
    const url =
      sourceClass === 'training'
        ? 'https://learn.microsoft.com/en-us/training/modules/synthetic-source-role/2-principles'
        : 'https://docs.github.com/en/copilot/concepts/prompting/synthetic-source-role';
    fixture.raw.manifest.sources[0].url = url;
    fixture.raw.questions[0].sourceUrls = [url];
    fixture.raw.reviews.reviews[0].sourceReviews[0].url = url;
    fixture.credential.sourceAllowlist.push({
      host: 'docs.github.com',
      pathPrefixes: ['/en/'],
      exactUrls: [],
    });
  }
  const credential = {
    ...fixture.credential,
    provider: 'GitHub' as const,
    examCode: 'GH-300',
  };
  const taxonomy = structuredClone(fixture.raw.taxonomy);
  taxonomy.studyGuideUrl =
    'https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/gh-300';
  credential.officialUrls.studyGuide = taxonomy.studyGuideUrl;
  credential.officialUrls.credential =
    'https://learn.microsoft.com/en-us/credentials/certifications/github-copilot/';
  const objectiveHash = objectiveFingerprint(taxonomy);
  const technicalTime = '2026-09-11T16:06:00.000Z';
  const adversarialTime = '2026-09-11T16:07:00.000Z';
  const questions: Question[] = [];
  const reviews: VerificationReview = {
    schemaVersion: 1,
    requestId: 'synthetic-strict-review',
    reviews: [],
  };
  const encounterMetadata: EncounterMetadataFile = {
    schemaVersion: 1,
    encounters: {},
  };
  const validationMetadata: ValidationMetadata = {
    schemaVersion: 1,
    encounters: {},
  };
  for (let index = 0; index < count; index++) {
    const domain = taxonomy.domains[index % taxonomy.domains.length];
    const q: Question = {
      ...structuredClone(fixture.raw.questions[0]),
      id: `synthetic-strict-${index}`,
      question: `Synthetic-only branch ${index} uses ${Array.from({ length: 12 }, (_, token) => `marker${index}segment${token}`).join(' ')}. Select the artificial supporting option.`,
      conceptId: `synthetic-claim-${index}`,
      objectiveDomain: domain.id,
      skill: domain.skills[0].id,
      subskill: domain.skills[0].subskills[0],
      verifiedAt: adversarialTime,
      difficulty: 'expert',
      complexity: 'scenario-based',
    };
    const hash = questionFingerprint(q);
    questions.push(q);
    const review = {
      ...structuredClone(fixture.raw.reviews.reviews[0]),
      questionId: q.id,
      questionFingerprint: hash,
      reviewerId: 'synthetic-adversary',
      reviewedAt: adversarialTime,
    };
    reviews.reviews.push(review);
    encounterMetadata.encounters[q.id] = {
      ...structuredClone(fixture.raw.encounterMetadata.encounters.q1),
      questionFingerprint: hash,
      rubric: {
        version: 2,
        objectiveVersion: taxonomy.studyGuideEffectiveDate,
        objectiveFingerprint: objectiveHash,
        reviewerId: review.reviewerId,
        reviewedAt: adversarialTime,
        scores: Object.fromEntries(
          rubricV2Criteria.map((criterion) => [criterion, 4]),
        ) as Record<(typeof rubricV2Criteria)[number], number>,
        notes:
          'Synthetic scores only for validation unit tests, never production attestations.',
      },
    };
    validationMetadata.encounters[q.id] = {
      generation: {
        authorId: review.authorId,
        generatedAt: q.generatedAt,
        questionFingerprint: hash,
        objectiveVersion: taxonomy.studyGuideEffectiveDate,
        objectiveFingerprint: objectiveHash,
        claims: review.choiceReviews.map((choice) => ({
          choiceId: choice.choiceId,
          sourceIds: choice.sourceIds,
          summary: choice.rationale,
        })),
      },
      technical: {
        objectiveVersion: taxonomy.studyGuideEffectiveDate,
        objectiveFingerprint: objectiveHash,
        review: {
          ...structuredClone(review),
          reviewerId: 'synthetic-technical',
          reviewedAt: technicalTime,
        },
      },
      adversarial: {
        reviewerId: review.reviewerId,
        reviewedAt: adversarialTime,
        verdict: 'verified',
        questionFingerprint: hash,
        objectiveVersion: taxonomy.studyGuideEffectiveDate,
        objectiveFingerprint: objectiveHash,
        optionChallenges: q.answerChoices.map((choice) => ({
          choiceId: choice.id,
          claimRepresented: 'Synthetic option claim for structural tests only.',
          whyIncorrectInContext:
            'Synthetic contextual analysis, never a real answer claim.',
          couldBeCorrectWhen:
            'Synthetic alternate context, never a real answer claim.',
          sourceIds: q.sourceIds,
          evidenceSummary:
            'Synthetic evidence for deterministic test coverage only.',
        })),
        challenges: {
          scope: 'Synthetic scope challenge for unit tests only.',
          plan: 'Synthetic plan challenge for unit tests only.',
          role: 'Synthetic role challenge for unit tests only.',
          preconditions:
            'Synthetic prerequisite challenge for unit tests only.',
          featureStatus: 'Synthetic status challenge for unit tests only.',
          sourceChanges: 'Synthetic freshness challenge for unit tests only.',
          stemSufficiency:
            'Synthetic sufficiency challenge for unit tests only.',
          explanationBounds:
            'Synthetic explanation challenge for unit tests only.',
          reasoningDepth: 'Synthetic difficulty challenge for unit tests only.',
          answerClues: 'Synthetic construction challenge for unit tests only.',
        },
        qualityNotes:
          'Synthetic adversarial review notes, not a real attestation.',
      },
    };
  }
  const source = fixture.raw.manifest.sources[0];
  const sourceRegistry: SourceRegistry = {
    schemaVersion: 1,
    examCode: credential.examCode,
    sources: [
      {
        sourceId: 'guide',
        canonicalUrl: taxonomy.studyGuideUrl,
        title: 'Synthetic guide root',
        retrievedAt: date,
        lastValidatedAt: date,
        examCode: credential.examCode,
        objectiveIds: ['manage'],
        sourceClass: 'guide',
        contentRelevance: 'Synthetic provenance root for tests only.',
        parents: [],
      },
      {
        sourceId: source.sourceId,
        canonicalUrl: source.url,
        title: source.title,
        retrievedAt: source.retrievedAt,
        lastValidatedAt: source.lastReviewedAt,
        examCode: credential.examCode,
        objectiveIds: [
          ...source.applicableObjectiveDomains,
          ...source.applicableSkills,
        ],
        sourceClass: sourceClass ?? 'doc',
        contentRelevance: 'Synthetic source relevance for tests only.',
        parents: [
          {
            sourceId: 'guide',
            relation: 'direct-link',
            targetUrl: source.url,
            canonicalUrl: source.url,
            retrievedAt: date,
            evidenceSummary: 'Synthetic link receipt for unit tests only.',
            relevanceJustification:
              'Synthetic content relevance for unit tests only.',
          },
        ],
      },
    ],
  };
  return {
    credential,
    raw: {
      ...fixture.raw,
      questions,
      taxonomy,
      reviews,
      encounterMetadata,
      validationMetadata,
      sourceRegistry,
      packageManifest: {
        ...fixture.raw.packageManifest,
        reviewPolicy: {
          version: 'three-pass-v1' as const,
          minimumRubricScore: 44,
          targetVerified: 150,
          sourcePolicy: 'guide-linked-official' as const,
        },
      },
    },
  };
}
