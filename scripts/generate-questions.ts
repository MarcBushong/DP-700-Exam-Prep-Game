import { copyFile, mkdir, writeFile, constants } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import {
  complexities,
  difficulties,
  formats,
  taxonomySchema,
} from '../src/features/grounding/schema';
import {
  generationOutputSchema,
  generationRequestSchema,
  verificationReviewSchema,
  type GenerationRequest,
} from '../src/features/grounding/workflow';
import { argument, isMain, readJsonFile } from './validate-questions';

export function buildGenerationRequest(
  taxonomyData: unknown,
  options: {
    requestId: string;
    authorId: string;
    requestedCount: number;
    createdAt: string;
  },
): GenerationRequest {
  const taxonomy = taxonomySchema.parse(taxonomyData);
  return generationRequestSchema.parse({
    schemaVersion: 1,
    ...options,
    objectiveTargets: taxonomy.domains.flatMap((domain) =>
      domain.skills.flatMap((skill) =>
        skill.subskills.map((subskill) => ({
          objectiveDomain: domain.id,
          skill: skill.id,
          subskill,
        })),
      ),
    ),
    difficulties,
    complexities,
    questionTypes: formats,
    studyGuideEffectiveDate: taxonomy.studyGuideEffectiveDate,
    taxonomyRetrievedAt: taxonomy.retrievedAt,
    primaryEvidence: {
      studyGuide: 'study-guide.json',
      certification: 'certification.json',
      course: 'course.json',
    },
    supportingEvidence: [],
    constraints: [
      'This scaffolding is not generation or evidence. Retrieve all three primary pages and supporting articles through actual Microsoft Learn MCP before authoring.',
      'Narrow objectiveTargets to this batch; preserve current guide scope, effective date, and true retrieval timestamps.',
      'Author original candidates and every distractor; generation output remains manual-review-required.',
      'An independent reviewer must inspect the completed candidates and supporting evidence, including alternatives, constraints, code, and feature status.',
      'Do not invent MCP responses, verification dates, or confidence percentages. Unsupported or ambiguous content stays excluded.',
    ],
  });
}

export async function exportWorkflowSchemas(output: string) {
  await mkdir(output, { recursive: true });
  for (const [name, schema] of [
    ['generation-request.schema.json', generationRequestSchema],
    ['generation-output.schema.json', generationOutputSchema],
    ['verification-review.schema.json', verificationReviewSchema],
  ] as const) {
    const json = z.toJSONSchema(schema, { io: 'input' });
    await writeFile(
      resolve(output, name),
      `${JSON.stringify(
        {
          ...json,
          $comment:
            'Generated from Zod workflow schemas. Cross-field semantic refinements additionally run in TypeScript; JSON Schema alone is not sufficient.',
        },
        null,
        2,
      )}\n`,
    );
  }
}

export async function scaffoldGeneration(
  output: string,
  request: GenerationRequest,
) {
  const directory = resolve(output);
  await mkdir(directory, { recursive: false });
  await writeFile(
    resolve(directory, 'request.json'),
    `${JSON.stringify(request, null, 2)}\n`,
    { flag: 'wx' },
  );
  await writeFile(
    resolve(directory, 'reviews.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        requestId: request.requestId,
        reviews: [],
      },
      null,
      2,
    )}\n`,
    { flag: 'wx' },
  );
  for (const file of [
    'generate-dp700-questions.prompt.md',
    'verify-dp700-questions.prompt.md',
  ])
    await copyFile(
      resolve('.github', 'prompts', file),
      resolve(directory, file),
      constants.COPYFILE_EXCL,
    );
}

if (isMain(import.meta.url)) {
  try {
    if (process.argv.includes('--schemas-only')) {
      await exportWorkflowSchemas(resolve(argument('--output') ?? 'schemas'));
      console.log(
        'Exported machine-readable workflow schemas; TypeScript refinements remain authoritative.',
      );
    } else {
      const now = new Date().toISOString();
      const requestId =
        argument('--id') ?? `dp700-${now.replace(/[:.]/g, '-')}`;
      const request = buildGenerationRequest(
        await readJsonFile(
          argument('--taxonomy') ?? resolve('src', 'data', 'objectives.json'),
        ),
        {
          requestId,
          authorId: argument('--author') ?? 'maintainer',
          requestedCount: Number(argument('--count') ?? 6),
          createdAt: now,
        },
      );
      const output = resolve(
        argument('--output') ?? resolve('.grounding', requestId),
      );
      await mkdir(resolve(output, '..'), { recursive: true });
      await scaffoldGeneration(output, request);
      console.log(
        `Created ${output}. No questions generated and no verification performed. Run the included Copilot prompts after genuine MCP retrieval; see docs/question-bank-maintenance.md.`,
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
