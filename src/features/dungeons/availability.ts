import type { Credential } from './schema';

export function hasPlayableIdentity(credential: Credential): boolean {
  return (
    credential.isVerified &&
    (credential.status === 'active' ||
      (credential.status === 'beta' && credential.allowBetaPlay === true))
  );
}
