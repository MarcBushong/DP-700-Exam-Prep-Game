import {
  credentials,
  heroClasses,
  validateCatalog,
} from '../src/features/dungeons/catalog';
import { hasPlayableIdentity } from '../src/features/dungeons/availability';

const findings = validateCatalog(credentials, heroClasses);
console.log(
  JSON.stringify(
    {
      credentials: credentials.length,
      heroClasses: heroClasses.length,
      verifiedActive: credentials
        .filter((entry) => entry.isVerified && entry.status === 'active')
        .map((entry) => entry.credentialId),
      enabledBeta: credentials
        .filter(
          (entry) => entry.status === 'beta' && hasPlayableIdentity(entry),
        )
        .map((entry) => entry.credentialId),
      sealed: credentials
        .filter((entry) => !hasPlayableIdentity(entry))
        .map((entry) => entry.credentialId),
      findings,
      disclaimer:
        'Catalog validation checks evidence metadata and consistency, not current vendor status without fresh authoritative retrieval.',
    },
    null,
    2,
  ),
);
if (findings.length) process.exitCode = 1;
