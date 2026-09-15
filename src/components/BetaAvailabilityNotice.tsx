import type { Credential, DungeonReadiness } from '../features/dungeons/schema';

export function BetaAvailabilityNotice({
  credential,
  readiness,
}: {
  credential: Pick<Credential, 'credentialId' | 'examCode' | 'status'>;
  readiness?: DungeonReadiness;
}) {
  if (credential.status !== 'beta') return null;
  return (
    <aside
      className="notice warning"
      aria-label={`${credential.examCode ?? credential.credentialId} beta availability`}
    >
      <strong>
        BETA · {readiness?.study ? 'Study access open' : 'Gameplay unavailable'}
      </strong>
      <p>
        Objectives may change. Unofficial study aid, not an official exam or a
        claim of general availability.{' '}
        {readiness?.study
          ? readiness.gauntlet
            ? 'Torchlight Run and Boss Gauntlet are open for beta study.'
            : 'Torchlight Run is open for beta study; Boss Gauntlet remains sealed.'
          : 'Torchlight Run and Boss Gauntlet remain sealed.'}
      </p>
    </aside>
  );
}
