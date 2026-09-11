import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { credentials } from '../src/features/dungeons/catalog';
import { argument } from './content-files';

const report = {
  schemaVersion: 1,
  createdAt: new Date().toISOString(),
  mode: 'discovery-request-only',
  disclaimer:
    'This command does not retrieve documentation, verify names or statuses, or enable dungeons. Use actual authoritative retrieval before editing the catalog.',
  requestedCredentials: credentials.map((credential) => ({
    credentialId: credential.credentialId,
    requestedIdentifier: credential.examCode ?? credential.credentialId,
    recordedName: credential.currentName,
    recordedStatus: credential.status,
    isVerified: credential.isVerified,
    officialUrls: credential.officialUrls,
    lastGroundedAt: credential.lastGroundedAt,
    lastValidatedAt: credential.lastValidatedAt,
    evidence: credential.verificationEvidence,
    nextAction:
      credential.provider === 'Microsoft'
        ? 'Retrieve current credential, exam, study guide and preparation pages using Microsoft Learn MCP.'
        : 'Retrieve official GitHub certification identity, competency outline and preparation documentation; explicitly approve exact resource URLs.',
  })),
};
try {
  const output = argument('--output');
  if (output) {
    await mkdir(dirname(resolve(output)), { recursive: true });
    await writeFile(resolve(output), `${JSON.stringify(report, null, 2)}\n`, {
      flag: 'wx',
    });
    console.log(
      `Discovery request written to ${output}; no verification performed.`,
    );
  } else console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
