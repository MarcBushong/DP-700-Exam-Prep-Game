import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { extractTaxonomy } from '../src/features/grounding/taxonomy';

const [
  input = '.grounding/study-guide.json',
  output = '.grounding/objectives.candidate.json',
] = process.argv.slice(2);
const record = z
  .object({
    retrievedAt: z.iso.datetime(),
    input: z.url(),
    tool: z.literal('microsoft_docs_fetch'),
    result: z.object({
      content: z
        .array(z.object({ type: z.literal('text'), text: z.string() }))
        .min(1),
    }),
  })
  .parse(JSON.parse(await readFile(input, 'utf8')));
const taxonomy = extractTaxonomy(
  record.result.content.map((c) => c.text).join('\n'),
  record.retrievedAt,
  record.input,
);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(taxonomy, null, 2)}\n`, {
  flag: 'wx',
});
console.log(
  `Extracted ${taxonomy.domains.length} domains and ${taxonomy.domains.flatMap((d) => d.skills).length} skills (${taxonomy.studyGuideEffectiveDate}) to ${output}. Review before replacing the versioned manifest.`,
);
