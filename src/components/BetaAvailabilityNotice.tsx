import type { Credential } from '../features/dungeons/schema';

export function BetaAvailabilityNotice({
  credential,
}: {
  credential: Pick<Credential, 'credentialId' | 'examCode' | 'status'>;
}) {
  if (credential.status !== 'beta') return null;
  return (
    <aside
      className="notice warning"
      aria-label={`${credential.examCode ?? credential.credentialId} beta availability`}
    >
      <strong>BETA · Gameplay unavailable</strong>
      <p>
        Objectives may change. Unofficial study aid, not an official exam or a
        claim of general availability. Torchlight Run and Boss Gauntlet remain
        sealed.
      </p>
    </aside>
  );
}
