import { describe, expect, it, vi } from 'vitest';
import questionsJson from '../src/data/questions.json';
import manifestJson from '../src/data/grounding-manifest.json';
import objectivesJson from '../src/data/objectives.json';
import {
  complexities,
  difficulties,
  formats,
  learnUrlSchema,
  nearDuplicates,
  validateContent,
  type Question,
} from '../src/features/grounding/schema';
import { checkOnlineSource, safeSourceUrl } from '../scripts/validate-sources';
import { buildReport } from '../scripts/content-report';
import {
  question,
  manifest as fixtureManifest,
  taxonomy as fixtureTaxonomy,
} from './fixtures';

function productionBank() {
  return validateContent(
    structuredClone(questionsJson),
    structuredClone(manifestJson),
    structuredClone(objectivesJson),
  );
}

function bank() {
  return validateContent(
    [question()],
    structuredClone(fixtureManifest),
    structuredClone(fixtureTaxonomy),
  );
}

function invalidQuestion(change: (q: Question) => void, message?: RegExp) {
  const { questions, manifest, taxonomy } = bank();
  change(questions[0]);
  const run = () => validateContent(questions, manifest, taxonomy);
  if (message) expect(run).toThrow(message);
  else expect(run).toThrow();
}

describe('grounded original content bank', () => {
  it('validates the actual production JSON without discarding unknown question fields', () => {
    const { questions, allQuestions, manifest, taxonomy } = productionBank();
    expect(allQuestions).toEqual(questionsJson);
    expect(questions.length).toBeGreaterThanOrEqual(150);
    expect(manifest.sources.length).toBeGreaterThan(20);
    expect(taxonomy.studyGuideEffectiveDate).toBe('July 21, 2026');
    expect(
      taxonomy.domains.flatMap((d) => d.skills).flatMap((s) => s.subskills),
    ).toHaveLength(54);
  });

  it('samples every domain and skill and balances editorial difficulty', () => {
    const { questions, taxonomy } = productionBank();
    for (const domain of taxonomy.domains) {
      expect(
        questions.filter((q) => q.objectiveDomain === domain.id).length,
      ).toBeGreaterThanOrEqual(12);
      for (const skill of domain.skills) {
        expect(
          questions.filter((q) => q.skill === skill.id).length,
        ).toBeGreaterThanOrEqual(2);
      }
    }
    for (const difficulty of difficulties)
      expect(
        questions.filter((q) => q.difficulty === difficulty).length,
      ).toBeGreaterThanOrEqual(9);
    expect(
      questions.filter((q) => ['advanced', 'expert'].includes(q.difficulty))
        .length / questions.length,
    ).toBeGreaterThanOrEqual(0.4);
    for (const complexity of complexities)
      expect(questions.some((q) => q.complexity === complexity)).toBe(true);
    for (const format of formats)
      expect(questions.some((q) => q.questionType === format)).toBe(true);
    for (const language of ['sql', 'python', 'kusto']) {
      expect(
        questions.some(
          (q) => q.questionType === 'code' && q.codeLanguage === language,
        ),
      ).toBe(true);
    }
  });

  it('grounds every question beyond the exam overview and explains only its distractors', () => {
    const { questions, manifest } = productionBank();
    for (const q of questions) {
      const sources = q.sourceIds.map((id) =>
        manifest.sources.find((source) => source.sourceId === id)!,
      );
      expect(
        sources.some((source) => source.featureStatus !== 'Not applicable'),
      ).toBe(true);
      expect(sources.map((source) => source.url)).toEqual(q.sourceUrls);
      expect(sources.map((source) => source.title)).toEqual(
        q.documentationTitles,
      );
      expect(Object.keys(q.whyOtherAnswersAreWrong).sort()).toEqual(
        q.answerChoices
          .map((choice) => choice.id)
          .filter((id) => !q.correctAnswer.includes(id))
          .sort(),
      );
      expect(Date.parse(q.lastValidatedAt)).toBeGreaterThanOrEqual(
        Date.parse(q.generatedAt),
      );
      expect(Date.parse(q.lastValidatedAt)).toBeLessThanOrEqual(Date.now());
    }
    for (const source of manifest.sources) {
      expect(Date.parse(source.lastReviewedAt)).toBeGreaterThanOrEqual(
        Date.parse(source.retrievedAt),
      );
      expect(source.applicableSkills.length).toBeGreaterThan(0);
      expect(Date.parse(source.retrievedAt)).toBeLessThanOrEqual(Date.now());
    }
  });

  it('reports playable coverage and freshness without claiming semantic verification', async () => {
    const report = await buildReport();
    expect(report).toContain('54 subskills');
    expect(report).toContain('## Uncovered subskills');
    expect(report).toContain('Last grounded through Microsoft Learn MCP');
    expect(report).toContain('Playable verified questions');
    expect(report).toContain('not answer semantics');
  });
});

describe('question and citation contract', () => {
  it('rejects an empty or malformed bank', () => {
    expect(() => validateContent([], manifestJson, objectivesJson)).toThrow();
    expect(() =>
      validateContent([{ id: 'incomplete' }], manifestJson, objectivesJson),
    ).toThrow();
    invalidQuestion((q) => {
      q.question = 'Too short';
    });
    invalidQuestion((q) => {
      q.deepExplanation = '';
    });
  });

  it('rejects unknown taxonomy values', () => {
    invalidQuestion((q) => {
      q.skill = 'invented-skill';
    }, /unknown domain, skill, or subskill/i);
    invalidQuestion((q) => {
      q.subskill = 'Invented objective';
    }, /unknown domain, skill, or subskill/i);
  });

  it('rejects missing citations and unknown source IDs', () => {
    invalidQuestion((q) => {
      q.sourceIds = [];
      q.sourceUrls = [];
      q.documentationTitles = [];
    });
    invalidQuestion((q) => {
      q.sourceIds[0] = 'not-a-source';
      q.verifiedAgainstSourceIds = [...q.sourceIds];
    }, /unknown citation/i);
  });

  it('rejects mismatched citation metadata and source array lengths', () => {
    invalidQuestion((q) => {
      q.documentationTitles[0] = 'Not the cited title';
    }, /citation metadata/i);
    invalidQuestion((q) => {
      q.sourceUrls[0] =
        'https://learn.microsoft.com/en-us/fabric/fundamentals/overview';
    }, /citation metadata/i);
    invalidQuestion((q) => {
      q.documentationTitles = [];
    }, /align one-to-one/i);
  });

  it('rejects a source that is not aligned with the question objective', () => {
    const { questions, manifest, taxonomy } = bank();
    const source = manifest.sources.find(
      (s) => s.sourceId === questions[0].sourceIds[0],
    )!;
    source.applicableSkills = [];
    expect(() => validateContent(questions, manifest, taxonomy)).toThrow(
      /not aligned/i,
    );
  });

  it('rejects citing only the top-level study guide', () => {
    const { questions, manifest, taxonomy } = bank();
    const source = manifest.sources[0];
    source.url = taxonomy.studyGuideUrl;
    questions[0].sourceIds = [source.sourceId];
    questions[0].sourceUrls = [source.url];
    questions[0].documentationTitles = [source.title];
    expect(() => validateContent(questions, manifest, taxonomy)).toThrow(
      /not only exam overview/i,
    );
  });

  it('rejects invalid answer IDs, duplicate choices, and malformed multi-select', () => {
    invalidQuestion((q) => {
      q.correctAnswer = ['missing'];
    }, /existing choices/i);
    invalidQuestion((q) => {
      q.answerChoices[1].id = q.answerChoices[0].id;
    }, /unique/i);
    invalidQuestion((q) => {
      q.answerChoices[1].text = q.answerChoices[0].text;
    }, /distinct/i);
    invalidQuestion((q) => {
      q.questionType = 'multi-select';
    }, /at least two/i);
  });

  it('rejects missing distractor explanations and explanations for correct choices', () => {
    invalidQuestion((q) => {
      delete q.whyOtherAnswersAreWrong.b;
    }, /every distractor/i);
    invalidQuestion((q) => {
      q.whyOtherAnswersAreWrong.a = 'This is actually the correct answer.';
    }, /only distractors/i);
  });

  it('rejects invalid code and true-false shapes', () => {
    invalidQuestion((q) => {
      q.questionType = 'code';
    }, /Code questions require/i);
    invalidQuestion((q) => {
      q.codeLanguage = 'python';
    }, /Code questions require/i);
    invalidQuestion((q) => {
      q.questionType = 'true-false';
    }, /True\/false questions/i);
  });

  it('rejects duplicate IDs and normalized duplicate question text', () => {
    const { questions, manifest, taxonomy } = bank();
    questions.push(structuredClone(questions[0]));
    questions[1].id = questions[0].id;
    expect(() => validateContent(questions, manifest, taxonomy)).toThrow(
      /Duplicate question ID/i,
    );
    questions[1].id = 'distinct-id';
    questions[1].question = `${questions[0].question.toUpperCase()} !!!`;
    expect(() => validateContent(questions, manifest, taxonomy)).toThrow(
      /Duplicate/i,
    );
  });

  it('rejects near-duplicates with superficial additional words', () => {
    const { questions, manifest, taxonomy } = bank();
    const near = structuredClone(questions[0]);
    near.id = 'superficial-rewording';
    near.question += ' Consider this requirement carefully.';
    expect(nearDuplicates([questions[0], near])).toEqual([
      [questions[0].id, near.id],
    ]);
    expect(() =>
      validateContent([...questions, near], manifest, taxonomy),
    ).toThrow(/Near-duplicate/i);
  });

  it('rejects an unlabelled Preview feature and accepts a correctly labelled example', () => {
    const { questions, manifest, taxonomy } = bank();
    manifest.sources.find(
      (s) => s.sourceId === questions[0].sourceIds[0],
    )!.featureStatus = 'Preview';
    expect(() => validateContent(questions, manifest, taxonomy)).toThrow(
      /preview feature must be labelled/i,
    );
    for (const q of questions.filter((q) =>
      q.sourceIds.includes(questions[0].sourceIds[0]),
    ))
      q.featureStatus = 'Preview';
    expect(() => validateContent(questions, manifest, taxonomy)).not.toThrow();
  });
});

describe('safe source validation', () => {
  const url =
    'https://learn.microsoft.com/en-us/fabric/data-warehouse/security';
  const htmlResponse = () =>
    new Response(
      '<html><head><title>Fabric documentation | Microsoft Learn</title></head><body><h1>Fabric documentation</h1></body></html>',
      { headers: { 'content-type': 'text/html' } },
    );

  it.each([
    'https://learn.microsoft.com/en-us/power-bi/connect-data/refresh-data',
    'https://learn.microsoft.com/en-us/power-bi/connect-data/incremental-refresh-overview',
    'https://learn.microsoft.com/en-us/power-bi/connect-data/refresh-data#data-refresh',
  ])('accepts direct official Power BI documentation %s', (candidate) => {
    expect(learnUrlSchema.safeParse(candidate).success).toBe(true);
    expect(safeSourceUrl(candidate).href).toBe(candidate);
  });

  it.each([
    'http://learn.microsoft.com/en-us/power-bi/connect-data/refresh-data',
    'https://learn.microsoft.com.evil.example/en-us/power-bi/connect-data/refresh-data',
    'https://example.com/en-us/power-bi/connect-data/refresh-data',
    'https://learn.microsoft.com:444/en-us/power-bi/connect-data/refresh-data',
    'https://learn.microsoft.com/en-us/power-bi/connect-data/refresh-data?view=example',
    'https://learn.microsoft.com/en-us/power-bi/knowledge-check',
    'https://learn.microsoft.com/en-us/power-bi/%72efresh-data',
    'https://learn.microsoft.com/en-us/power-bi-examples/connect-data/refresh-data',
  ])('retains the source guards for Power BI URLs %s', (candidate) => {
    expect(learnUrlSchema.safeParse(candidate).success).toBe(false);
    expect(() => safeSourceUrl(candidate)).toThrow();
  });

  it.each([
    'http://learn.microsoft.com/en-us/fabric/example',
    'https://example.com/en-us/fabric/example',
    'https://learn.microsoft.com.evil.example/en-us/fabric/example',
    'https://user:password@learn.microsoft.com/en-us/fabric/example',
    'https://learn.microsoft.com:444/en-us/fabric/example',
    'https://learn.microsoft.com/en-us/search?terms=fabric',
    'https://learn.microsoft.com/en-us/fabric/example?redirect=https://example.com',
    'https://learn.microsoft.com/api/mcp',
    ' https://learn.microsoft.com/en-us/fabric/example',
    'https://learn.microsoft.com/en-us/fabric/<example>',
    'https://learn.microsoft.com/en-us/fabric/example path',
    'file:///C:/documents/example.html',
  ])('rejects unsafe or nondocument source URL %s', (candidate) => {
    expect(learnUrlSchema.safeParse(candidate).success).toBe(false);
    expect(() => safeSourceUrl(candidate)).toThrow();
  });

  it.each([
    'https://learn.microsoft.com/en-us/training/modules/example/6-knowledge-check',
    'https://learn.microsoft.com/en-us/credentials/certifications/practice-assessments',
    'https://learn.microsoft.com/en-us/fabric/%73earch',
  ])('does not check assessment or encoded paths %s', (candidate) => {
    expect(() => safeSourceUrl(candidate)).toThrow();
  });

  it('accepts a direct page and does not use automatic redirect following', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(htmlResponse());
    await expect(checkOnlineSource(url, fetcher)).resolves.toEqual({
      finalUrl: url,
      status: 200,
    });
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
  });

  it('revalidates redirects before making another request', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'https://example.com/private' },
      }),
    );
    await expect(checkOnlineSource(url, fetcher)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('follows a safe relative documentation redirect', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 301,
          headers: {
            location: '/en-us/fabric/data-warehouse/dynamic-data-masking',
          },
        }),
      )
      .mockResolvedValueOnce(htmlResponse());
    await expect(checkOnlineSource(url, fetcher)).resolves.toMatchObject({
      finalUrl:
        'https://learn.microsoft.com/en-us/fabric/data-warehouse/dynamic-data-masking',
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('allows only the observed Kusto canonical Fabric-view redirect', async () => {
    const kusto =
      'https://learn.microsoft.com/en-us/kusto/query/arg-max-aggregation-function';
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 301,
          headers: { location: `${kusto}?view=microsoft-fabric` },
        }),
      )
      .mockResolvedValueOnce(htmlResponse());
    await expect(checkOnlineSource(kusto, fetcher)).resolves.toMatchObject({
      finalUrl: `${kusto}?view=microsoft-fabric`,
    });
    expect(() => safeSourceUrl(`${kusto}?view=microsoft-fabric`)).toThrow();
    expect(() =>
      safeSourceUrl(`${kusto}?view=microsoft-fabric&redirect=elsewhere`, true),
    ).toThrow();
    expect(() => safeSourceUrl(`${url}?view=microsoft-fabric`, true)).toThrow();
  });

  it('bounds redirect loops', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () =>
          new Response(null, { status: 302, headers: { location: url } }),
      );
    await expect(checkOnlineSource(url, fetcher)).rejects.toThrow(
      /redirect limit/i,
    );
    expect(fetcher).toHaveBeenCalledTimes(6);
  });

  it.each([
    () => new Response('missing', { status: 404 }),
    () =>
      new Response('{"message":"not a page"}', {
        headers: { 'content-type': 'application/json' },
      }),
    () =>
      new Response('<title>404 - Page not found</title>', {
        headers: { 'content-type': 'text/html' },
      }),
    () =>
      new Response('<title>Service unavailable</title>', {
        headers: { 'content-type': 'text/html' },
      }),
    () =>
      new Response('<p>No document title or heading.</p>', {
        headers: { 'content-type': 'text/html' },
      }),
  ])('rejects failed responses and HTML error pages', async (response) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response());
    await expect(checkOnlineSource(url, fetcher)).rejects.toThrow();
  });

  it('bounds documentation response size', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(`<title>Page</title>${'x'.repeat(2_000_001)}`, {
        headers: { 'content-type': 'text/html' },
      }),
    );
    await expect(checkOnlineSource(url, fetcher)).rejects.toThrow(/2 MB/i);
  });

  it('aborts a stalled source request after the bounded timeout', async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn<typeof fetch>().mockImplementation(
        (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener(
              'abort',
              () => reject(new Error('Request aborted')),
              { once: true },
            );
          }),
      );
      const result = expect(checkOnlineSource(url, fetcher)).rejects.toThrow(
        /aborted/i,
      );
      await vi.advanceTimersByTimeAsync(12_000);
      await result;
    } finally {
      vi.useRealTimers();
    }
  });
});
