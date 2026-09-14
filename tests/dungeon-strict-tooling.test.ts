import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  examDirectory,
  examId,
  readRawPackage,
} from '../scripts/content-files';
import { loadContent } from '../scripts/validate-questions';
import {
  buildGenerationRequest,
  scaffoldGeneration,
} from '../scripts/generate-questions';
import { duplicateFindings } from '../src/features/grounding/quality';
import {
  crossExamDuplicateReport,
  normalizedScenario,
  scenarioDuplicateFindings,
} from '../src/features/dungeons/duplicateReview';
import {
  objectiveFingerprint,
  questionFingerprint,
} from '../src/features/dungeons/review';
import { strictFixture } from './dungeon-three-pass-fixtures';
import { date, question, taxonomy } from './fixtures';

describe('strict tooling without model calls or manufactured reviews', () => {
  it('keeps custom questions without a review ledger metadata-only, even with recorded verified fields', async () => {
    const root = resolve(
      '.grounding',
      `synthetic-metadata-only-${randomUUID()}`,
    );
    const originalArguments = process.argv;
    await mkdir(root, { recursive: true });
    try {
      const raw = await readRawPackage('dp-700');
      if (!Array.isArray(raw.questions))
        throw new Error('Expected existing production question array.');
      const path = resolve(root, 'questions.json');
      await writeFile(path, JSON.stringify(raw.questions.slice(0, 1)));
      process.argv = [
        ...originalArguments.slice(0, 2),
        '--exam',
        'dp-700',
        '--questions',
        path,
      ];
      const content = await loadContent(true);
      expect(content.allQuestions).toHaveLength(1);
      expect(content.allQuestions[0].verificationStatus).toBe('verified');
      expect(content.questions).toEqual([]);
      expect('packageManifest' in content).toBe(false);
    } finally {
      process.argv = originalArguments;
      await rm(root, { recursive: true, force: true });
    }
  });

  it.each([
    ['gh-300', 'github-copilot'],
    ['GH-300', 'github-copilot'],
    ['gh-600', 'github-agentic-ai-developer'],
    ['GH-600', 'github-agentic-ai-developer'],
    ['dp-700', 'dp-700'],
  ])(
    'resolves %s without duplicating packages or stable storage IDs',
    (input, output) => {
      expect(examId(input)).toBe(output);
      expect(examDirectory(input)).toBe(
        resolve('src', 'content', 'exams', output),
      );
    },
  );

  it('writes source approval and three prompts but no candidate, score or review artifact', async () => {
    const root = resolve(
      '.grounding',
      `synthetic-three-pass-test-${randomUUID()}`,
    );
    await mkdir(resolve('.grounding'), { recursive: true });
    try {
      const request = buildGenerationRequest(taxonomy, {
        authorId: 'synthetic-test-author',
        requestId: 'synthetic-test-request',
        requestedCount: 180,
        targetVerified: 150,
        reviewPolicy: 'three-pass-v1',
        credentialId: 'github-copilot',
        provider: 'GitHub',
        createdAt: date,
      });
      expect(request.targetVerified).toBe(150);
      expect(request.difficultyMix).toEqual({
        beginner: 15,
        intermediate: 35,
        advanced: 35,
        expert: 15,
      });
      expect(request.difficultyLabels).toEqual({ beginner: 'Foundational' });
      await scaffoldGeneration(root, request);
      expect((await readdir(root)).sort()).toEqual([
        'generate-gh-three-pass.prompt.md',
        'request.json',
        'source-approval-request.json',
        'verify-gh-adversarial.prompt.md',
        'verify-gh-technical.prompt.md',
      ]);
      expect(
        JSON.parse(
          await readFile(resolve(root, 'source-approval-request.json'), 'utf8'),
        ).status,
      ).toBe('awaiting-curator-evidence');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('operator-safe cosmetic duplicate warnings and independent decisions', () => {
  it.each([
    ['watermark > 100', 'watermark >= 100'],
    ['@{variables("table")}', '{variables("table")}'],
    ['x != y', 'x == y'],
  ])(
    'does not block meaning-bearing stem differences: %s vs %s',
    (left, right) => {
      const a = question('a', {
        question: `Within this synthetic context use ${left}. Which option meets this requirement?`,
      });
      const b = question('b', {
        question: `Within this synthetic context use ${right}. Which option meets this requirement?`,
      });
      expect(
        duplicateFindings([a, b]).some((f) => f.severity === 'blocking'),
      ).toBe(false);
    },
  );
  it('flags named-entity, variable and choice-order variations only as editorial warnings', () => {
    const a = question('a', {
      question:
        'A repository named alpha is used by Contoso. Select its synthetic configuration.',
      codeSnippet: 'select customer from sales where amount > 4',
      codeLanguage: 'sql',
    });
    const b = question('b', {
      question:
        'A repository named beta is used by Fabrikam. Select its synthetic configuration.',
      codeSnippet: 'select person from records where total > 4',
      codeLanguage: 'sql',
      answerChoices: [...a.answerChoices].reverse(),
    });
    expect(normalizedScenario(a.question)).toBe(normalizedScenario(b.question));
    expect(scenarioDuplicateFindings([a, b])).toMatchObject([
      { code: 'cosmetic-scenario', severity: 'warning' },
    ]);
  });
  it('requires current hashes/objectives and records reasoning differences without pretending semantic AI', () => {
    const first = strictFixture(),
      second = strictFixture();
    const a = first.raw.questions[0],
      b = second.raw.questions[0];
    b.id = 'synthetic-other-exam';
    const banks = [
      {
        credentialId: 'github-copilot',
        allQuestions: [a],
        taxonomy: first.raw.taxonomy,
      },
      {
        credentialId: 'github-agentic-ai-developer',
        allQuestions: [b],
        taxonomy: second.raw.taxonomy,
      },
    ];
    const missing = crossExamDuplicateReport(banks);
    expect(missing.warnings[0].message).toContain('manual review required');
    expect(missing.warnings.every((f) => f.severity === 'warning')).toBe(true);
    const decision = {
      schemaVersion: 1,
      decisions: [
        {
          conceptId: a.conceptId,
          questionIds: [a.id, b.id],
          questionFingerprints: {
            [a.id]: questionFingerprint(a),
            [b.id]: questionFingerprint(b),
          },
          objectiveFingerprints: {
            'github-copilot': objectiveFingerprint(first.raw.taxonomy),
            'github-agentic-ai-developer': objectiveFingerprint(
              second.raw.taxonomy,
            ),
          },
          reviewerId: 'synthetic-semantic-reviewer',
          reviewedAt: '2026-09-11T16:08:00.000Z',
          decision: 'keep-distinct',
          reasoningDifference:
            'Synthetic reasoning distinction metadata for structural tests only.',
          notes: 'This synthetic record is never a production semantic review.',
        },
      ],
    };
    expect(
      crossExamDuplicateReport(banks, decision).decisionsUsed.length,
    ).toBeGreaterThan(0);
    b.explanation += ' changed substantive explanation';
    expect(crossExamDuplicateReport(banks, decision).decisionsUsed).toEqual([]);
  });
});
