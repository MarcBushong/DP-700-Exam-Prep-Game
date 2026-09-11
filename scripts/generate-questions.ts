import { copyFile, mkdir, writeFile, constants } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import {
  generationOutputSchema,
  generationRequestSchema,
  verificationReviewSchema,
  type GenerationRequest,
} from '../src/features/grounding/workflow';
import { argument, isMain, readJsonFile } from './validate-questions';
import { examDirectory, examId } from './content-files';
import { credentials } from '../src/features/dungeons/catalog';
import {
  buildGenerationRequest,
  parseDifficultyMix,
} from '../src/features/dungeons/generation';
import {
  credentialSchema,
  encounterMetadataFileSchema,
  packageManifestSchema,
  dungeonReadinessSchema,
  readinessThresholdsSchema,
} from '../src/features/dungeons/schema';
export { buildGenerationRequest } from '../src/features/dungeons/generation';

export async function exportWorkflowSchemas(output: string) {
  await mkdir(output, { recursive: true });
  for (const [name, schema] of [
    ['generation-request.schema.json', generationRequestSchema],
    ['generation-output.schema.json', generationOutputSchema],
    ['verification-review.schema.json', verificationReviewSchema],
    ['credential.schema.json', credentialSchema],
    ['encounter-metadata.schema.json', encounterMetadataFileSchema],
    ['dungeon-package.schema.json', packageManifestSchema],
    ['dungeon-readiness.schema.json', dungeonReadinessSchema],
    ['readiness-thresholds.schema.json', readinessThresholdsSchema],
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
  for (const file of request.credentialId === 'dp-700'
    ? ['generate-dp700-questions.prompt.md', 'verify-dp700-questions.prompt.md']
    : [
        'generate-dungeon-questions.prompt.md',
        'verify-dungeon-questions.prompt.md',
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
      const id = examId();
      const credential = credentials.find(
        (entry) => entry.credentialId === id,
      )!;
      const requestId =
        argument('--id') ?? `${id}-${now.replace(/[:.]/g, '-')}`;
      const request = buildGenerationRequest(
        await readJsonFile(
          argument('--taxonomy') ??
            resolve(examDirectory(id), 'objectives.json'),
        ),
        {
          requestId,
          authorId: argument('--author') ?? 'maintainer',
          requestedCount: Number(argument('--count') ?? 6),
          createdAt: now,
          credentialId: id,
          provider: credential.provider,
          ...parseDifficultyMix(argument('--difficulty')),
          objectiveDomains: (argument('--floors') ?? argument('--domains'))
            ?.split(',')
            .map((id) => id.trim()),
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
