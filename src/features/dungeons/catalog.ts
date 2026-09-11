import catalogData from '../../content/credentials/credentials.json';
import classData from '../../content/credentials/hero-classes.json';
import { credentialSchema, heroClassSchema, type Credential } from './schema';
import { isAllowedIdentityUrl } from './sourcePolicy';

export type { Credential, HeroClass } from './schema';
export const credentials = credentialSchema.array().parse(catalogData);
export const heroClasses = heroClassSchema.array().parse(classData);

export function validateCatalog(data: unknown, classes: unknown): string[] {
  const catalog = credentialSchema.array().safeParse(data);
  const mappings = heroClassSchema.array().safeParse(classes);
  if (!catalog.success || !mappings.success)
    return [
      !catalog.success ? catalog.error.message : '',
      !mappings.success ? mappings.error.message : '',
    ].filter(Boolean);
  const problems: string[] = [];
  const ids = catalog.data.map((credential) => credential.credentialId);
  if (new Set(ids).size !== ids.length)
    problems.push('Credential IDs must be unique.');
  const classIds = mappings.data.map((heroClass) => heroClass.id);
  if (new Set(classIds).size !== classIds.length)
    problems.push('Hero-class IDs must be unique.');
  for (const heroClass of mappings.data) {
    if (
      new Set(heroClass.credentialIds).size !== heroClass.credentialIds.length
    )
      problems.push(`${heroClass.id}: duplicate credential mapping.`);
    for (const id of heroClass.credentialIds)
      if (!ids.includes(id))
        problems.push(`${heroClass.id}: unknown credential ${id}.`);
  }
  for (const credential of catalog.data) {
    const id = credential.credentialId;
    if (credential.personas.some((persona) => !classIds.includes(persona)))
      problems.push(`${id}: unknown hero class.`);
    if (
      credential.provider === 'Microsoft' &&
      credential.sourceAllowlist.some(
        (rule) => rule.host !== 'learn.microsoft.com',
      )
    )
      problems.push(
        `${id}: Microsoft credentials permit only Microsoft Learn sources.`,
      );
    for (const url of Object.values(credential.officialUrls).filter(
      (url): url is string => url !== null,
    ))
      if (!isAllowedIdentityUrl(url, credential))
        problems.push(
          `${id}: official URL outside credential source policy: ${url}`,
        );
    if (credential.isVerified) {
      if (
        !credential.currentName ||
        credential.credentialType === 'unverified' ||
        credential.status === 'unverified' ||
        !(credential.officialUrls.credential || credential.officialUrls.exam) ||
        !credential.lastGroundedAt ||
        !credential.lastValidatedAt ||
        !credential.verificationEvidence.length
      )
        problems.push(
          `${id}: verified identity requires authoritative name, type, status, identity URLs, dates, and evidence.`,
        );
      if (
        credential.status === 'active' &&
        (!credential.objectiveVersion ||
          !credential.officialUrls.studyGuide ||
          !credential.officialUrls.training)
      )
        problems.push(
          `${id}: verified active identity additionally requires the current objective version, study guide and preparation URL.`,
        );
      const requiredEvidenceUrls = [
        credential.officialUrls.credential ?? credential.officialUrls.exam,
        ...(credential.status === 'active'
          ? [
              credential.officialUrls.studyGuide,
              credential.officialUrls.training,
            ]
          : []),
      ].filter((url): url is string => url !== null);
      if (
        requiredEvidenceUrls.some(
          (url) =>
            !credential.verificationEvidence.some(
              (evidence) => evidence.url === url,
            ),
        )
      )
        problems.push(
          `${id}: recorded identity, objective and preparation URLs require actual retrieval evidence.`,
        );
    } else {
      if (
        credential.contentReadiness === 'ready' ||
        credential.contentReadiness === 'limited' ||
        credential.verifiedQuestionCount > 0 ||
        !credential.sealedReason
      )
        problems.push(
          `${id}: an unverified dungeon must remain explicitly sealed, never ready or advertising playable verified encounters.`,
        );
      const identityUrl =
        credential.officialUrls.credential ?? credential.officialUrls.exam;
      if (
        credential.status === 'active' &&
        (!credential.currentName ||
          credential.credentialType === 'unverified' ||
          !credential.lastGroundedAt ||
          !credential.lastValidatedAt ||
          !identityUrl ||
          !credential.verificationEvidence.some(
            (evidence) => evidence.url === identityUrl,
          ))
      )
        problems.push(
          `${id}: a known active provider status requires retrieved identity evidence even while current-map verification remains pending.`,
        );
    }
    if (
      credential.lastGroundedAt &&
      credential.lastValidatedAt &&
      Date.parse(credential.lastValidatedAt) <
        Date.parse(credential.lastGroundedAt)
    )
      problems.push(`${id}: validation cannot predate grounding.`);
    if (
      credential.status !== 'active' &&
      ['ready', 'limited'].includes(credential.contentReadiness)
    )
      problems.push(
        `${id}: only active verified credentials can advertise playable readiness.`,
      );
    for (const evidence of credential.verificationEvidence) {
      if (!isAllowedIdentityUrl(evidence.url, credential))
        problems.push(
          `${id}: identity evidence is outside the credential source policy.`,
        );
      if (Date.parse(evidence.retrievedAt) > Date.now())
        problems.push(`${id}: evidence retrieval cannot be in the future.`);
      if (
        credential.lastValidatedAt &&
        Date.parse(evidence.retrievedAt) >
          Date.parse(credential.lastValidatedAt)
      )
        problems.push(
          `${id}: identity validation cannot predate its evidence retrieval.`,
        );
    }
    for (const date of [credential.lastGroundedAt, credential.lastValidatedAt])
      if (date && Date.parse(date) > Date.now())
        problems.push(`${id}: catalog dates cannot be in the future.`);
  }
  return problems;
}

export function filterCredentials(
  catalog: Credential[],
  filters: { heroClassId?: string; query?: string; productArea?: string } = {},
): Credential[] {
  const heroClass = heroClasses.find(
    (entry) => entry.id === filters.heroClassId,
  );
  const query = filters.query?.trim().toLowerCase() ?? '';
  return catalog.filter((credential) => {
    if (filters.heroClassId && !heroClass) return false;
    if (
      heroClass?.id === 'wanderer' &&
      (!credential.isVerified || credential.status !== 'active')
    )
      return false;
    if (
      heroClass &&
      heroClass.id !== 'wanderer' &&
      !heroClass.credentialIds.includes(credential.credentialId)
    )
      return false;
    if (
      filters.productArea &&
      !credential.productAreas.includes(filters.productArea)
    )
      return false;
    return (
      !query ||
      [
        credential.examCode,
        credential.currentName,
        credential.dungeonName,
        ...credential.productAreas,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  });
}
