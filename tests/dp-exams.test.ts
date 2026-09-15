import { describe, expect, it } from 'vitest';
import { readRawPackage } from '../scripts/content-files';
import prospective from '../docs/dp-420-prospective-objectives.json';
import groundingStatus from '../docs/dp-420-grounding-status.json';
import authoringArchive from '../src/content/exams/dp-800/authoring-archive/index.json';
import {
  credentials,
  filterCredentials,
} from '../src/features/dungeons/catalog';
import {
  getDungeonPackage,
  listDungeons,
} from '../src/features/dungeons/packages';
import { isAllowedSourceUrl } from '../src/features/dungeons/sourcePolicy';
import { validationMetadataSchema } from '../src/features/dungeons/threePass';
import { validateDungeonPackage } from '../src/features/dungeons/validation';
import {
  isPlayableQuestion,
  questionSchema,
  taxonomySchema,
} from '../src/features/grounding/schema';
import {
  eligibleQuestions,
  isCorrect,
  selectQuestions,
  shuffle,
} from '../src/features/quiz/engine';
import { defaultConfig } from '../src/features/quiz/types';
import { planDungeonSession } from '../src/features/quiz/dungeonRuntime';
import {
  freshData,
  rememberQuestion,
  selectSavedCredential,
} from '../src/services/storage';
import { question as syntheticQuestion } from './fixtures';
import { dungeon as syntheticDungeon } from './runtime-fixtures';

const strictPolicy = {
  version: 'three-pass-v1',
  minimumRubricScore: 44,
  targetVerified: 150,
  sourcePolicy: 'guide-linked-official',
};

function dp800() {
  const dungeon = getDungeonPackage('dp-800');
  if (!dungeon)
    throw new Error('The current DP-800 package must be installed.');
  return dungeon;
}

describe('DP credential integration and prospective-map separation', () => {
  it('loads the actual DP-800 map and independently pinned strict policy', () => {
    const dungeon = dp800();
    expect(dungeon.credential.examCode).toBe('DP-800');
    expect(dungeon.credential.currentName).toBe(
      'Microsoft Certified: SQL AI Developer Associate',
    );
    expect(dungeon.objectiveVersion).toBe('March 12, 2026');
    expect(dungeon.taxonomy.studyGuideEffectiveDate).toBe(
      dungeon.objectiveVersion,
    );
    expect(
      dungeon.taxonomy.domains.map((domain) => domain.weightRange),
    ).toEqual([
      [35, 40],
      [35, 40],
      [25, 30],
    ]);
    const skills = dungeon.taxonomy.domains.flatMap((domain) => domain.skills);
    expect(skills).toHaveLength(11);
    expect(skills.flatMap((skill) => skill.subskills)).toHaveLength(73);
    expect(dungeon.credential.requiredReviewPolicy).toEqual(strictPolicy);
    expect(dungeon.packageManifest.reviewPolicy).toEqual(strictPolicy);
    expect(
      dungeon.findings.filter((finding) => finding.severity !== 'warning'),
    ).toEqual([]);
  });

  it('exercises a separately labelled synthetic DP-420 Boss flow without opening its real dungeon', () => {
    const bank = Array.from({ length: 75 }, (_, index) =>
      syntheticQuestion(`synthetic-dp420-${index}`, {
        question: `Synthetic condition ${index} requires the artificial alpha and beta options. Select two.`,
        questionType: 'multi-select',
        answerChoices: [
          { id: 'a', text: 'Synthetic alpha' },
          { id: 'b', text: 'Synthetic beta' },
          { id: 'c', text: 'Synthetic gamma' },
        ],
        correctAnswer: ['a', 'b'],
        whyOtherAnswersAreWrong: {
          c: 'Synthetic gamma is excluded by this artificial fixture condition.',
        },
        conceptId: `synthetic-dp420-concept-${index}`,
      }),
    );
    const fixture = syntheticDungeon('dp-420', bank);
    const result = planDungeonSession([fixture], {
      ...defaultConfig,
      credentialId: 'dp-420',
      runMode: 'gauntlet',
      questionCount: 5,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.warnings.join(' '));
    expect(result.plan.config.answerMode).toBe('exam');
    expect(result.plan.questions).toHaveLength(5);
    for (const selected of result.plan.questions) {
      expect(isCorrect(selected, ['a', 'b'])).toBe(true);
      expect(isCorrect(selected, ['a'])).toBe(false);
      expect(isCorrect(selected, ['a', 'b', 'c'])).toBe(false);
    }
    expect(
      listDungeons().find((entry) => entry.credentialId === 'dp-420')
        ?.readiness,
    ).toMatchObject({ study: false, gauntlet: false });
  });

  it('keeps DP-420 visible, current-version null, and both production modes locked', () => {
    const card = listDungeons().find(
      (entry) => entry.credentialId === 'dp-420',
    )!;
    expect(card.currentName).toBe(
      'Microsoft Certified: Azure Cosmos DB Developer Specialty',
    );
    expect(card.objectiveVersion).toBeNull();
    expect(card.isVerified).toBe(false);
    expect(card.verifiedQuestionCount).toBe(0);
    expect(card.readiness).toMatchObject({ study: false, gauntlet: false });
    expect(card.sealedReason).toContain('October 6, 2026 future outline');
    expect(card.officialUrls.training).toBe(
      'https://learn.microsoft.com/en-us/training/courses/dp-420t00',
    );
    expect(card.requiredReviewPolicy).toEqual(strictPolicy);
    expect(getDungeonPackage('dp-420')).toBeUndefined();
    expect(groundingStatus.currentObjectiveVersion).toBeNull();
    expect(groundingStatus.futureOutline.eligibleAsCurrent).toBe(false);
    expect(taxonomySchema.parse(prospective).studyGuideEffectiveDate).toBe(
      'October 6, 2026',
    );
    expect(
      planDungeonSession([undefined], {
        ...defaultConfig,
        credentialId: 'dp-420',
        runMode: 'gauntlet',
      }).ok,
    ).toBe(false);
  });

  it.each(['dp-800', 'dp-420'])(
    'does not grant %s arbitrary official-host or other-credential sources',
    (credentialId) => {
      const credential = credentials.find(
        (entry) => entry.credentialId === credentialId,
      )!;
      expect(
        credential.sourceAllowlist.every((rule) => !rule.pathPrefixes.length),
      ).toBe(true);
      for (const url of [
        'https://learn.microsoft.com/en-us/answers/questions/123',
        'https://learn.microsoft.com/en-us/training/modules/example/knowledge-check',
        'https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700',
        'https://learn.microsoft.com/en-us/azure/unreviewed-dp-article',
        'https://learn.microsoft.com.evil.test/en-us/sql/overview',
        'https://docs.github.com/en/copilot/overview',
        'https://example.com/practice-exam',
      ])
        expect(isAllowedSourceUrl(url, credential)).toBe(false);
    },
  );

  it('uses generic discovery roles without changing another credential identity', () => {
    for (const heroClassId of [
      'database-developer',
      'data-engineer',
      'software-developer',
      'ai-engineer',
      'application-ai-engineer',
      'solutions-architect',
    ])
      expect(
        filterCredentials(credentials, { heroClassId }).map(
          (entry) => entry.credentialId,
        ),
      ).toContain('dp-800');
    expect(getDungeonPackage('dp-700')?.questions).toHaveLength(162);
    expect(getDungeonPackage('github-copilot')?.questions).toHaveLength(149);
    expect(
      getDungeonPackage('github-agentic-ai-developer')?.questions,
    ).toHaveLength(136);
  });
});

describe('DP-800 reviewed production content and shared runtime', () => {
  it('keeps frozen unfinished authoring outside the gameplay package', () => {
    const dungeon = dp800();
    expect(authoringArchive.uniqueAuthoredQuestionIds).toBe(102);
    expect(dungeon.allQuestions).toHaveLength(
      authoringArchive.installedRecords,
    );
    expect(dungeon.questions).toHaveLength(authoringArchive.verified);
    expect(
      dungeon.allQuestions.filter(
        (question) => question.verificationStatus === 'manual-review-required',
      ),
    ).toHaveLength(authoringArchive.manualReviewRequired);
    const installedIds = new Set(
      dungeon.allQuestions.map((question) => question.id),
    );
    const deferredIds = new Set(
      authoringArchive.records
        .filter((record) => !installedIds.has(record.questionId))
        .map((record) => record.questionId),
    );
    expect(deferredIds.size).toBe(authoringArchive.outsideGameplayPackage);
    expect(
      dungeon.questions.some((question) => deferredIds.has(question.id)),
    ).toBe(false);
    expect(dungeon.readiness.gauntlet).toBe(false);
  });

  it('opens Study only with genuine three-pass content and complete major-floor coverage', () => {
    const dungeon = dp800();
    expect(dungeon.readiness.study).toBe(true);
    expect(dungeon.questions.length).toBeGreaterThanOrEqual(25);
    expect(
      new Set(dungeon.questions.map((question) => question.objectiveDomain))
        .size,
    ).toBe(3);
    const stages = validationMetadataSchema.parse(dungeon.validationMetadata);
    for (const question of dungeon.questions) {
      expect(isPlayableQuestion(question)).toBe(true);
      expect(stages.encounters[question.id].technical?.review.verdict).toBe(
        'verified',
      );
      expect(stages.encounters[question.id].adversarial?.verdict).toBe(
        'verified',
      );
      expect(question.requiresManualReview).toBe(false);
      expect(
        question.sourceUrls.every((url) =>
          isAllowedSourceUrl(url, dungeon.credential),
        ),
      ).toBe(true);
    }
  });

  it('keeps objective balancing, unseen preference, filters, and exact answer IDs', () => {
    const dungeon = dp800();
    let state = 19;
    const random = () =>
      (state = (1664525 * state + 1013904223) >>> 0) / 2 ** 32;
    const config = {
      ...defaultConfig,
      credentialId: 'dp-800',
      questionCount: 20,
      order: 'balanced' as const,
    };
    const selection = selectQuestions(
      dungeon.questions,
      dungeon.taxonomy,
      config,
      [],
      random,
    );
    expect(selection.questions).toHaveLength(20);
    expect(
      new Set(selection.questions.map((question) => question.conceptId)).size,
    ).toBe(20);
    for (const domain of dungeon.taxonomy.domains) {
      const count = selection.questions.filter(
        (question) => question.objectiveDomain === domain.id,
      ).length;
      expect(count).toBeGreaterThanOrEqual(
        Math.ceil((20 * domain.weightRange![0]) / 100),
      );
      expect(count).toBeLessThanOrEqual(
        Math.floor((20 * domain.weightRange![1]) / 100),
      );
    }
    const seen = selection.questions[0].id;
    const next = selectQuestions(
      dungeon.questions,
      dungeon.taxonomy,
      config,
      [],
      random,
      [seen],
    );
    expect(next.questions.some((question) => question.id === seen)).toBe(false);
    const filtered = eligibleQuestions(dungeon.questions, {
      ...config,
      difficulty: 'advanced',
      complexity: 'scenario-based',
    });
    expect(filtered.length).toBeGreaterThan(0);
    expect(
      filtered.every(
        (question) =>
          question.difficulty === 'advanced' &&
          question.complexity === 'scenario-based',
      ),
    ).toBe(true);
    for (const question of selection.questions) {
      const shuffled = {
        ...question,
        answerChoices: shuffle(question.answerChoices, random),
      };
      expect(isCorrect(shuffled, question.correctAnswer)).toBe(true);
      const wrong = question.answerChoices.find(
        (choice) => !question.correctAnswer.includes(choice.id),
      )!;
      expect(isCorrect(shuffled, [wrong.id])).toBe(false);
    }
  });

  it('retains per-credential preferences and unseen history without a storage migration', () => {
    const question = dp800().questions[0];
    expect(question).toBeDefined();
    const original = freshData();
    const selected = selectSavedCredential(original, 'dp-800');
    const remembered = rememberQuestion(selected, question.id, 'dp-800');
    const switched = selectSavedCredential(remembered, 'dp-420');
    expect(switched.recentQuestionIdsByCredential['dp-800']).toEqual([
      question.id,
    ]);
    expect(switched.recentQuestionIdsByCredential['dp-420']).toBeUndefined();
    expect(switched.recentQuestionIds).toEqual(original.recentQuestionIds);
    expect(switched.config.credentialId).toBe('dp-420');
    expect(switched.configByCredential['dp-800'].credentialId).toBe('dp-800');
    expect(switched.history).toEqual(original.history);
    expect(switched.version).toBe(1);
  });

  it.each([
    'candidate',
    'manual-review-required',
    'rejected',
    'stale',
  ] as const)(
    'excludes a DP-800 %s record even when the old approval remains present',
    async (verificationStatus) => {
      const dungeon = dp800();
      const raw = await readRawPackage('dp-800');
      const questions = questionSchema.array().parse(raw.questions);
      const target = questions.find((question) =>
        dungeon.questions.some((playable) => playable.id === question.id),
      );
      if (!target)
        throw new Error('A genuinely reviewed DP-800 question is required.');
      target.verificationStatus = verificationStatus;
      target.requiresManualReview = true;
      raw.questions = questions;
      const checked = validateDungeonPackage(dungeon.credential, raw);
      expect(
        checked.questions.some((question) => question.id === target.id),
      ).toBe(false);
      expect(
        checked.allQuestions.some((question) => question.id === target.id),
      ).toBe(true);
    },
  );
});
