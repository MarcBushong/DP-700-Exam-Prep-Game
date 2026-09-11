import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  inspectContent,
  isPlayableQuestion,
  questionSchema,
  validateContent,
  type Question,
} from '../src/features/grounding/schema';
import {
  duplicateFindings,
  normalizedChoice,
  normalizedCode,
  qualityFindings,
} from '../src/features/grounding/quality';
import {
  buildContentReport,
  reportMarkdown,
} from '../src/features/grounding/report';
import {
  generationOutputSchema,
  generationRequestSchema,
  reviewChecks,
  verificationReviewSchema,
  type VerificationReview,
} from '../src/features/grounding/workflow';
import {
  buildGenerationRequest,
  scaffoldGeneration,
} from '../scripts/generate-questions';
import {
  questionFingerprint,
  validateReviewAttestations,
} from '../scripts/review-helpers';
import {
  checkReviewFile,
  verificationReviewFile,
} from '../scripts/verify-questions';
import { date, manifest, question, taxonomy } from './fixtures';

const nextDate = '2026-09-11T16:10:00.000Z';
const inspect = (questions: unknown, sources: unknown = manifest) =>
  inspectContent(questions, sources, taxonomy);
const checked = (questions: unknown, sources: unknown = manifest) =>
  validateContent(questions, sources, taxonomy);
function candidates() {
  return [
    question('verified'),
    question('pending', {
      question:
        'How does the synthetic batched ingestion example organize fresh landing records?',
      verificationStatus: 'manual-review-required',
      requiresManualReview: true,
      difficulty: 'advanced',
    }),
    question('rejected', {
      question:
        'Under the artificial monitoring assumptions, identify the invalid synthetic alert configuration.',
      verificationStatus: 'rejected',
      requiresManualReview: true,
      difficulty: 'expert',
    }),
    question('stale', {
      question:
        'Find the synthetic orchestration dependency that prevents duplicate scheduling in this fixture.',
      verificationStatus: 'stale',
      requiresManualReview: true,
      difficulty: 'beginner',
    }),
  ];
}

function reviews(q = question()): VerificationReview {
  return {
    schemaVersion: 1,
    requestId: 'fixture-review',
    reviews: [
      {
        questionId: q.id,
        authorId: 'fixture-author',
        reviewerId: 'independent-fixture-reviewer',
        questionFingerprint: questionFingerprint(q),
        reviewedAt: date,
        verdict: 'verified',
        sourceReviews: [
          {
            sourceId: 'fixture',
            url: manifest.sources[0].url,
            evidencePath: '.grounding\\fixture.json',
            retrievedAt: date,
            lastReviewedAt: date,
            supportingSummary:
              'Synthetic evidence summary for unit tests, not a real content attestation.',
          },
        ],
        choiceReviews: q.answerChoices.map((choice) => ({
          choiceId: choice.id,
          assessment: q.correctAnswer.includes(choice.id)
            ? 'supported'
            : 'contradicted',
          rationale: `Synthetic option ${choice.id} rationale: ${q.correctAnswer.includes(choice.id) ? 'fits the stated test requirement' : 'does not fit the stated test requirement'}.`,
          sourceIds: ['fixture'],
        })),
        checks: Object.fromEntries(
          reviewChecks.map((check) => [check, true]),
        ) as Record<(typeof reviewChecks)[number], boolean>,
        verificationNotes: q.verificationNotes,
        confidenceReason: q.confidenceReason,
      },
    ],
  };
}

describe('verification metadata and freshness', () => {
  it('retains every candidate status while selecting only complete verified records', () => {
    const content = checked(candidates());
    expect(content.allQuestions.map((q) => q.verificationStatus)).toEqual([
      'verified',
      'manual-review-required',
      'rejected',
      'stale',
    ]);
    expect(content.questions.map((q) => q.id)).toEqual(['verified']);
    expect(content.allQuestions.map(isPlayableQuestion)).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  it('parses legacy saved question snapshots without inventing verification or deleting answer data', () => {
    const legacy = Object.fromEntries(
      Object.entries(question()).filter(
        ([key]) =>
          ![
            'conceptId',
            'verificationStatus',
            'verifiedAt',
            'verifiedAgainstSourceIds',
            'verificationNotes',
            'requiresManualReview',
            'sourceLastReviewedAt',
            'confidenceReason',
          ].includes(key),
      ),
    );
    const parsed = questionSchema.parse(legacy);
    expect(parsed).toMatchObject({
      verificationStatus: 'manual-review-required',
      requiresManualReview: true,
      correctAnswer: ['a'],
      explanation: question().explanation,
    });
    expect(parsed.verifiedAt).toBeUndefined();
    expect(isPlayableQuestion(parsed)).toBe(false);
    expect(checked([legacy]).questions).toEqual([]);
  });

  it.each([
    'conceptId',
    'verifiedAt',
    'sourceLastReviewedAt',
    'verificationNotes',
    'confidenceReason',
    'verifiedAgainstSourceIds',
  ])('rejects incomplete verified metadata: %s', (key) => {
    const raw = { ...question() } as Record<string, unknown>;
    delete raw[key];
    expect(questionSchema.safeParse(raw).success).toBe(false);
    expect(isPlayableQuestion(raw as Question)).toBe(false);
  });

  it('rejects a manual flag or unsupported source review set on a verified question', () => {
    expect(() =>
      checked([question('q', { requiresManualReview: true })]),
    ).toThrow(/review metadata/i);
    expect(() =>
      checked([question('q', { verifiedAgainstSourceIds: ['other'] })]),
    ).toThrow(/source IDs/i);
    expect(() =>
      checked([
        question('q', { verifiedAgainstSourceIds: ['fixture', 'fixture'] }),
      ]),
    ).toThrow(/source IDs/i);
  });

  it('requires verification to follow generation, validation, and source review', () => {
    expect(() =>
      checked([question('q', { lastValidatedAt: nextDate })]),
    ).toThrow(/Verification cannot predate/i);
    expect(() =>
      checked([question('q', { sourceLastReviewedAt: nextDate })]),
    ).toThrow(/Verification cannot predate/i);
    expect(() => checked([question('q', { generatedAt: nextDate })])).toThrow(
      /Validation cannot predate/i,
    );
  });

  it('rejects future question and source timestamps', () => {
    const future = '2099-01-01T00:00:00.000Z';
    expect(() => checked([question('q', { verifiedAt: future })])).toThrow(
      /future/i,
    );
    expect(isPlayableQuestion(question('q', { verifiedAt: future }))).toBe(
      false,
    );
    const sources = structuredClone(manifest);
    sources.sources[0].lastReviewedAt = future;
    expect(() => checked([question()], sources)).toThrow(/future/i);
  });

  it('marks a newer reviewed source stale without modifying the source input', () => {
    const sources = structuredClone(manifest);
    sources.sources[0].lastReviewedAt = nextDate;
    const q = question();
    const content = checked([q], sources);
    expect(content.questions).toEqual([]);
    expect(content.allQuestions[0]).toMatchObject({
      verificationStatus: 'stale',
      requiresManualReview: true,
    });
    expect(content.findings).toContainEqual(
      expect.objectContaining({ code: 'source-updated' }),
    );
    expect(q.verificationStatus).toBe('verified');
  });

  it('requires the exact latest cited review timestamp and all reviewed sources', () => {
    const sources = structuredClone(manifest);
    sources.sources.push({
      ...sources.sources[0],
      sourceId: 'second',
      title: 'Second fixture source',
      lastReviewedAt: nextDate,
    });
    const q = question('multi-source', {
      sourceIds: ['fixture', 'second'],
      sourceUrls: [sources.sources[0].url, sources.sources[1].url],
      documentationTitles: sources.sources.map((source) => source.title),
      verifiedAgainstSourceIds: ['second', 'fixture'],
      sourceLastReviewedAt: nextDate,
      verifiedAt: nextDate,
    });
    expect(checked([q], sources).questions).toHaveLength(1);
    expect(
      checked([{ ...q, sourceLastReviewedAt: date }], sources).allQuestions[0]
        .verificationStatus,
    ).toBe('stale');
    expect(() =>
      checked([{ ...q, verifiedAgainstSourceIds: ['fixture'] }], sources),
    ).toThrow();
    expect(() =>
      checked([
        question('invented-review', {
          verifiedAt: nextDate,
          sourceLastReviewedAt: nextDate,
        }),
      ]),
    ).toThrow(/latest cited/i);
  });

  it('keeps schema and citation errors visible in diagnostics rather than playable coverage', () => {
    const q = question('uncited', {
      sourceIds: [],
      sourceUrls: [],
      documentationTitles: [],
    });
    const content = inspect([question('valid'), q]);
    expect(content.totalRecords).toBe(2);
    expect(content.allQuestions).toHaveLength(1);
    expect(content.questions.map((item) => item.id)).toEqual(['valid']);
    expect(
      content.findings.some(
        (f) => f.category === 'citation' && f.questionIds.includes('uncited'),
      ),
    ).toBe(true);
    expect(() => checked([q])).toThrow();
  });

  it('rejects citation or taxonomy defects on pending candidates too', () => {
    expect(() =>
      checked([
        question('pending', {
          verificationStatus: 'manual-review-required',
          requiresManualReview: true,
          sourceIds: ['unknown'],
        }),
      ]),
    ).toThrow(/unknown citation/i);
    expect(() =>
      checked([
        question('pending', {
          verificationStatus: 'manual-review-required',
          requiresManualReview: true,
          skill: 'imaginary',
        }),
      ]),
    ).toThrow(/unknown domain/i);
  });

  it('preserves meaning-bearing operators in choices and rejects an incorrect stated selection count', () => {
    const q = question('operators', {
      answerChoices: [
        { id: 'a', text: 'amount > 10' },
        { id: 'b', text: 'amount < 10' },
        { id: 'c', text: 'amount = 10' },
      ],
    });
    expect(questionSchema.safeParse(q).success).toBe(true);
    const multiple = question('two', {
      questionType: 'multi-select',
      question:
        'For this synthetic example, select three appropriate options to satisfy the stated constraints.',
      correctAnswer: ['a', 'b'],
      whyOtherAnswersAreWrong: {
        c: 'Synthetic distractor does not fit the constraint.',
      },
    });
    expect(questionSchema.safeParse(multiple).success).toBe(false);
    multiple.question = multiple.question.replace('three', 'two');
    expect(questionSchema.safeParse(multiple).success).toBe(true);
  });
});

describe('deterministic duplicates and conservative quality warnings', () => {
  it('keeps pipeline interpolation syntax and watermark boundary operators distinct', () => {
    expect(normalizedChoice('@{pipeline().parameters.batchSize}')).not.toBe(
      normalizedChoice('@pipeline().parameters.batchSize'),
    );
    expect(
      normalizedChoice(
        'ModifiedAt >= @OldWatermark AND ModifiedAt <= @NewWatermark',
      ),
    ).not.toBe(
      normalizedChoice(
        'ModifiedAt > @OldWatermark AND ModifiedAt <= @NewWatermark',
      ),
    );
  });

  it('ignores Unicode, whitespace, punctuation, capitalization, and option order for exact duplicates', () => {
    const first = question();
    const copy = question('copy', {
      question: `  ${first.question.toUpperCase()} !!!`,
      answerChoices: [...first.answerChoices].reverse(),
    });
    expect(duplicateFindings([first, copy])).toContainEqual(
      expect.objectContaining({
        code: 'exact-duplicate',
        severity: 'blocking',
      }),
    );
    expect(() => checked([first, copy])).toThrow(/Duplicate/i);
  });

  it('retains duplicate pending candidates for reports but cannot admit a verified duplicate', () => {
    const first = question('one', {
      verificationStatus: 'manual-review-required',
      requiresManualReview: true,
    });
    const second = { ...first, id: 'two' };
    expect(checked([first, second]).allQuestions).toHaveLength(2);
    expect(checked([first, second]).questions).toEqual([]);
    expect(() =>
      checked([question('verified', { question: first.question }), first]),
    ).toThrow(/Duplicate/i);
  });

  it('detects near-identical wording and superficial code-variable renaming', () => {
    const first = question('code-one', {
      questionType: 'code',
      codeLanguage: 'sql',
      codeSnippet: 'SELECT SUM(amount) FROM Sales WHERE amount > 10;',
    });
    const copy = question('code-two', {
      question: first.question,
      questionType: 'code',
      codeLanguage: 'sql',
      codeSnippet: 'SELECT SUM(amount) FROM Orders WHERE amount > 10;',
    });
    expect(duplicateFindings([first, copy])[0]).toMatchObject({
      code: 'code-duplicate',
      severity: 'blocking',
    });
    const whitespace = {
      ...first,
      id: 'spaces',
      codeSnippet: 'SELECT   SUM( amount )\nFROM Sales WHERE amount>10;',
    };
    expect(duplicateFindings([first, whitespace])[0].severity).toBe('blocking');
  });

  it('preserves meaning-bearing code literals and operators instead of calling different expressions identical', () => {
    expect(normalizedCode("df.filter(col('a') > 10)")).not.toBe(
      normalizedCode("df.filter(col('a') < 10)"),
    );
    expect(normalizedCode("SELECT 'a b'")).not.toBe(
      normalizedCode("SELECT 'ab'"),
    );
    const first = question('greater', {
      codeLanguage: 'sql',
      codeSnippet: 'SELECT * FROM Orders WHERE amount > 10',
    });
    const second = question('less', {
      question: first.question,
      codeLanguage: 'sql',
      codeSnippet: 'SELECT * FROM Orders WHERE amount < 10',
    });
    expect(
      duplicateFindings([first, second]).every((f) => f.severity === 'warning'),
    ).toBe(true);
    const literal = {
      ...first,
      codeSnippet: "SELECT * FROM Orders WHERE status = 'pending'",
    };
    const changedLiteral = {
      ...second,
      codeSnippet: "SELECT * FROM Orders WHERE status = 'complete'",
    };
    expect(
      duplicateFindings([literal, changedLiteral]).every(
        (f) => f.severity === 'warning',
      ),
    ).toBe(true);
  });

  it('groups fact-level concepts and moderate lexical similarity as manual-review warnings', () => {
    const first = question('access', { conceptId: 'same-security-decision' });
    const second = candidates()[1];
    second.conceptId = first.conceptId;
    expect(duplicateFindings([first, second])[0]).toMatchObject({
      code: 'same-concept',
      severity: 'warning',
    });
    expect(() => checked([first, second])).not.toThrow();
  });

  it('flags obvious structural cues without asserting semantic correctness', () => {
    const q = question('cues', {
      question: 'Which is NOT always the correct solution when it requires a?',
      answerChoices: [
        {
          id: 'a',
          text: 'A documented answer with much more description and qualifications than either of the short distractors below.',
        },
        { id: 'b', text: 'None of the above' },
        { id: 'c', text: 'Never' },
      ],
    });
    const findings = qualityFindings([q]);
    expect(findings.map((f) => f.code)).toEqual(
      expect.arrayContaining([
        'negative-wording',
        'absolute-wording',
        'pronoun-review',
        'answer-length-cue',
        'distractor-cue',
        'grammar-cue',
      ]),
    );
    expect(findings.every((f) => f.severity === 'warning')).toBe(true);
  });

  it('reports repeated openings and authored answer-position bias across a bank', () => {
    const findings = qualityFindings(
      Array.from({ length: 8 }, (_, i) => question(`q${i}`)),
    );
    expect(findings.map((f) => f.code)).toContain('answer-position-bias');
    const repeated = qualityFindings(
      Array.from({ length: 4 }, (_, i) =>
        question(`q${i}`, {
          question: `A synthetic fixture requires fresh records. Which option matches requirement ${i}?`,
        }),
      ),
    );
    expect(repeated.map((f) => f.code)).toContain('repeated-opening');
  });
});

describe('playable-only coverage and honest review reporting', () => {
  it('reports all four statuses, target gaps, counts at each taxonomy level, and real evidence timestamps', () => {
    const report = buildContentReport(checked(candidates()), nextDate);
    expect(report.totalQuestions).toBe(4);
    expect(report.statusCounts).toEqual({
      verified: 1,
      'manual-review-required': 1,
      rejected: 1,
      stale: 1,
    });
    expect(report.counts.playable.difficulty).toEqual({
      beginner: 0,
      intermediate: 1,
      advanced: 0,
      expert: 0,
    });
    expect(report.counts.allCandidates.difficulty.advanced).toBe(1);
    expect(report.counts.playable.source.fixture).toBe(1);
    expect(report.counts.playable.domain).toEqual({
      manage: 1,
      ingest: 0,
      monitor: 0,
    });
    expect(report.counts.playable.skill.security).toBe(1);
    expect(report.counts.playable.subskill.Access).toBe(1);
    expect(report.counts.playable.complexity['concept-recall']).toBe(1);
    expect(report.counts.playable.type['single-select']).toBe(1);
    expect(report.coverageGaps.map((gap) => gap.subskill)).toEqual([
      'Loading',
      'Tuning',
    ]);
    expect(report.answerPositionDistribution).toEqual({ 1: 1 });
    expect(report.targets.questionShortfall).toBe(149);
    expect(report.freshness.questionVerification.latest).toBe(date);
    expect(report.freshness.lastGroundedAt).toBe(date);
    expect(report.generatedAt).toBe(nextDate);
    expect(reportMarkdown(report)).toContain(
      'not a retrieval or verification timestamp',
    );
    expect(reportMarkdown(report)).toContain('## Uncovered subskills');
  });

  it('counts multiple citations per source without treating arrays as comma-joined categories', () => {
    const sources = structuredClone(manifest);
    sources.sources.push({
      ...sources.sources[0],
      sourceId: 'other',
      title: 'Other source',
    });
    const q = question('both', {
      sourceIds: ['fixture', 'other'],
      sourceUrls: [sources.sources[0].url, sources.sources[1].url],
      documentationTitles: ['Fixture source', 'Other source'],
      verifiedAgainstSourceIds: ['fixture', 'other'],
    });
    const report = buildContentReport(checked([q], sources));
    expect(report.counts.playable.source).toEqual({ fixture: 1, other: 1 });
    expect(report.multipleCitations.playable).toEqual(['both']);
  });

  it('counts malformed citation failures and excludes updated-source snapshots from available coverage', () => {
    const invalid = question('bad', {
      sourceUrls: ['https://example.com/unsafe'],
    });
    const badReport = buildContentReport(inspect([invalid]));
    expect(badReport.malformedRecords).toBe(1);
    expect(badReport.playableVerifiedQuestions).toBe(0);
    expect(badReport.findingCounts.citation).toBeGreaterThan(0);
    const sources = structuredClone(manifest);
    sources.sources[0].lastReviewedAt = nextDate;
    const report = buildContentReport(checked([question()], sources));
    expect(report.statusCounts.stale).toBe(1);
    expect(report.statusCounts.verified).toBe(0);
    expect(report.counts.playable.source.fixture).toBe(0);
    expect(report.coverageGaps).toHaveLength(3);
  });

  it('reports invalid manifest URLs as citation errors without rendering unsafe links or claiming coverage', () => {
    const sources = structuredClone(manifest);
    sources.sources[0].url = 'https://example.com/not-authoritative';
    const report = buildContentReport(inspect([question()], sources));
    expect(report.sourceRecordCounts).toEqual({
      total: 1,
      valid: 0,
      malformed: 1,
    });
    expect(report.findingCounts.citation).toBeGreaterThan(0);
    expect(report.sources).toEqual([]);
    expect(report.playableVerifiedQuestions).toBe(0);
    expect(reportMarkdown(report)).not.toContain('](https://example.com');
    expect(() => checked([question()], sources)).toThrow(/Microsoft Learn/i);
  });
});

describe('two-pass workflow scaffolding and attestation validation', () => {
  it('requires the committed ledger by default and permits explicit candidate metadata-only mode', () => {
    expect(verificationReviewFile({})).toBe(
      resolve('src', 'data', 'verification-reviews.json'),
    );
    expect(
      verificationReviewFile({ questions: '.grounding\\candidates.json' }),
    ).toBeUndefined();
    expect(
      verificationReviewFile({ reviews: '.grounding\\reviews.json' }),
    ).toBe('.grounding\\reviews.json');
    expect(
      verificationReviewFile({
        questions: '.grounding\\candidates.json',
        reviews: '.grounding\\batch-reviews.json',
      }),
    ).toBe('.grounding\\batch-reviews.json');
  });

  it('fails closed on a missing ledger without generating attestations', async () => {
    const path = resolve('.grounding', `missing-ledger-${randomUUID()}.json`);
    const findings = await checkReviewFile([question()], manifest, path);
    expect(findings).toEqual([
      expect.objectContaining({
        code: 'review-file',
        severity: 'error',
        message: expect.stringContaining(
          'Required review ledger could not be read',
        ),
      }),
    ]);
    await expect(readFile(path, 'utf8')).rejects.toThrow();
  });

  it('requires the build to check attestations immediately after structural validation', async () => {
    const packageJson = JSON.parse(
      await readFile(resolve('package.json'), 'utf8'),
    ) as { scripts: { build: string } };
    expect(packageJson.scripts.build).toMatch(
      /^npm run validate && npm run questions:verify && /,
    );
  });

  it.each(['manual-review-required', 'rejected', 'stale'] as const)(
    'requires matching independent ledger records and notes for %s candidates too',
    (status) => {
      const q = question(status, {
        verificationStatus: status,
        requiresManualReview: true,
        verifiedAt: undefined,
      });
      const data = reviews(q);
      data.reviews[0].verdict = status;
      data.reviews[0].checks.answerDefensible = false;
      expect(validateReviewAttestations([q], manifest, data)).toEqual([]);
      expect(
        validateReviewAttestations([q], manifest, { ...data, reviews: [] })[0]
          .message,
      ).toMatch(/required for every status/i);
      data.reviews[0].verificationNotes +=
        ' Different independent review result.';
      expect(
        validateReviewAttestations([q], manifest, data)[0].message,
      ).toMatch(/metadata does not match/i);
    },
  );

  it('scaffolds unreviewed requests from the supplied taxonomy without creating evidence or candidates', async () => {
    const request = buildGenerationRequest(taxonomy, {
      requestId: 'fixture-request',
      authorId: 'author',
      requestedCount: 3,
      createdAt: nextDate,
    });
    expect(request.objectiveTargets).toHaveLength(3);
    expect(request.taxonomyRetrievedAt).toBe(date);
    expect(request.supportingEvidence).toEqual([]);
    expect(request.createdAt).toBe(nextDate);
    await mkdir(resolve('.grounding'), { recursive: true });
    const directory = resolve('.grounding', `tooling-test-${randomUUID()}`);
    try {
      await scaffoldGeneration(directory, request);
      expect(
        JSON.parse(await readFile(resolve(directory, 'request.json'), 'utf8')),
      ).toEqual(request);
      expect(
        JSON.parse(await readFile(resolve(directory, 'reviews.json'), 'utf8'))
          .reviews,
      ).toEqual([]);
      await expect(
        readFile(resolve(directory, 'candidates.json'), 'utf8'),
      ).rejects.toThrow();
      await expect(scaffoldGeneration(directory, request)).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('exports machine-readable schemas from existing Zod and rejects generation self-verification', async () => {
    for (const [name, schema] of [
      ['generation-request', generationRequestSchema],
      ['generation-output', generationOutputSchema],
      ['verification-review', verificationReviewSchema],
    ] as const) {
      expect(z.toJSONSchema(schema, { io: 'input' }).type).toBe('object');
      const recorded = JSON.parse(
        await readFile(resolve('schemas', `${name}.schema.json`), 'utf8'),
      ) as Record<string, unknown>;
      delete recorded.$comment;
      expect(recorded).toEqual(z.toJSONSchema(schema, { io: 'input' }));
    }
    const output = {
      schemaVersion: 1,
      requestId: 'batch',
      authorId: 'author',
      generatedAt: date,
      candidates: [question()],
    };
    expect(generationOutputSchema.safeParse(output).success).toBe(false);
    output.candidates = [
      question('candidate', {
        verificationStatus: 'manual-review-required',
        requiresManualReview: true,
      }),
    ];
    expect(generationOutputSchema.safeParse(output).success).toBe(true);
  });

  it('accepts consistent independent attestations without mutating candidates', () => {
    const q = question();
    const before = JSON.stringify(q);
    expect(validateReviewAttestations([q], manifest, reviews(q))).toEqual([]);
    expect(JSON.stringify(q)).toBe(before);
  });

  it('rejects an old verified ledger after source changes make the effective candidate stale', () => {
    const sources = structuredClone(manifest);
    sources.sources[0].lastReviewedAt = nextDate;
    const q = question();
    const content = inspect([q], sources);
    expect(content.allQuestions[0].verificationStatus).toBe('stale');
    const findings = validateReviewAttestations(
      content.allQuestions,
      sources,
      reviews(q),
    );
    expect(
      findings.some((finding) =>
        /verdict does not match/i.test(finding.message),
      ),
    ).toBe(true);
    expect(
      findings.some((finding) => /current manifest/i.test(finding.message)),
    ).toBe(true);
  });

  it('binds reviews to substantive content but permits applying actual verification metadata afterwards', () => {
    const q = question();
    const data = reviews(q);
    expect(
      questionFingerprint({
        ...q,
        verificationNotes: 'Different recorded notes',
      }),
    ).toBe(questionFingerprint(q));
    expect(
      validateReviewAttestations(
        [{ ...q, explanation: 'Changed answer rationale.' }],
        manifest,
        data,
      ).some((f) => /changed after/i.test(f.message)),
    ).toBe(true);
    expect(questionFingerprint({ ...q, correctAnswer: ['b'] })).not.toBe(
      questionFingerprint(q),
    );
    expect(questionFingerprint({ ...q, conceptId: 'another-fact' })).not.toBe(
      questionFingerprint(q),
    );
  });

  it('rejects self-review, missing per-option checks, ambiguous answer keys, and failed checklist items', () => {
    const self = reviews();
    self.reviews[0].reviewerId = self.reviews[0].authorId;
    expect(
      validateReviewAttestations([question()], manifest, self)[0].message,
    ).toMatch(/independent reviewer/i);
    const missing = reviews();
    missing.reviews[0].choiceReviews.pop();
    expect(
      validateReviewAttestations([question()], manifest, missing)[0].message,
    ).toMatch(/every answer choice/i);
    const ambiguous = reviews();
    ambiguous.reviews[0].choiceReviews[0].assessment = 'ambiguous';
    expect(
      validateReviewAttestations([question()], manifest, ambiguous)[0].message,
    ).toMatch(/answer key/i);
    const failed = reviews();
    failed.reviews[0].checks.prerequisitesComplete = false;
    expect(
      validateReviewAttestations([question()], manifest, failed)[0].message,
    ).toMatch(/every independent review check/i);
  });

  it('rejects missing/duplicate attestations, changed sources, future dates, and mismatched notes', () => {
    const absent = reviews();
    absent.reviews = [];
    expect(
      validateReviewAttestations([question()], manifest, absent)[0].message,
    ).toMatch(/lacks an independent/i);
    const duplicate = reviews();
    duplicate.reviews.push(structuredClone(duplicate.reviews[0]));
    expect(
      validateReviewAttestations([question()], manifest, duplicate)[0].message,
    ).toMatch(/duplicate/i);
    const changed = reviews();
    changed.reviews[0].sourceReviews[0].lastReviewedAt = nextDate;
    expect(
      validateReviewAttestations([question()], manifest, changed)[0].message,
    ).toMatch(/current manifest/i);
    const future = reviews();
    future.reviews[0].reviewedAt = '2099-01-01T00:00:00.000Z';
    expect(
      validateReviewAttestations([question()], manifest, future)[0].message,
    ).toMatch(/future/i);
    const notes = reviews();
    notes.reviews[0].verificationNotes += ' Additional purported review.';
    expect(
      validateReviewAttestations([question()], manifest, notes)[0].message,
    ).toMatch(/metadata does not match/i);
  });
});
