import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { credentials } from '../src/features/dungeons/catalog';
import { diffObjectives } from '../src/features/dungeons/lifecycle';
import {
  questionSchema,
  taxonomySchema,
} from '../src/features/grounding/schema';
import {
  argument,
  examId,
  readJsonFile,
  readRawPackage,
} from './content-files';

try {
  const id = examId();
  const credential = credentials.find((entry) => entry.credentialId === id)!;
  const candidate = argument('--candidate');
  const now = new Date().toISOString();
  const report = candidate
    ? await (async () => {
        const raw = await readRawPackage(id);
        return {
          mode: 'objective-diff-only',
          createdAt: now,
          credentialId: id,
          ...diffObjectives(
            taxonomySchema.parse(raw.taxonomy),
            taxonomySchema.parse(await readJsonFile(candidate)),
            questionSchema.array().parse(raw.questions),
          ),
        };
      })()
    : {
        mode: 'grounding-request-only',
        createdAt: now,
        credentialId: id,
        currentObjectiveVersion: credential.objectiveVersion,
        officialUrls: credential.officialUrls,
        steps: [
          credential.provider === 'Microsoft' ||
          ['github-copilot', 'github-agentic-ai-developer'].includes(id)
            ? 'Retrieve current credential, study guide and preparation pages through actual Microsoft Learn MCP.'
            : 'Retrieve authoritative GitHub credential and competency outline documentation.',
          'Preserve actual retrieval timestamps and the published effective version; do not infer unpublished objectives or weighting.',
          'Save a candidate taxonomy and run this command with --candidate to review the diff.',
          'Record prior objectiveVersion in package objectiveHistory before accepting a changed map. Keep old encounter envelopes and historical sessions.',
          'Independently re-review all affected encounters; older objectiveVersion envelopes are excluded from gameplay automatically.',
        ],
        disclaimer:
          'No evidence retrieved, objective files overwritten, or encounters verified by this command.',
      };
  const output = argument('--output');
  if (output) {
    await mkdir(dirname(resolve(output)), { recursive: true });
    await writeFile(resolve(output), `${JSON.stringify(report, null, 2)}\n`, {
      flag: 'wx',
    });
    console.log(`Wrote ${output}; review before making any lifecycle changes.`);
  } else console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
