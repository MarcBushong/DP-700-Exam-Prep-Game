import { z } from 'zod';
import {
  manifestSchema,
  taxonomySchema,
  timestampSchema,
  type GroundingManifest,
  type Question,
  type Taxonomy,
} from '../grounding/schema';
import type { ContentFinding } from '../grounding/quality';
import type { Credential } from './schema';
import { isAllowedSourceUrl, isAzureSearchArticle } from './sourcePolicy';

/** This allowlist is necessary, never sufficient: declared ancestry is checked separately. */
export const strictEvidenceUrlSchema = z.string().refine((value) => {
  try {
    if (/[%\\\s<>"`]/.test(value)) return false;
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.search &&
      ((url.hostname === 'learn.microsoft.com' &&
        url.pathname.startsWith('/en-us/')) ||
        (url.hostname === 'docs.github.com' &&
          url.pathname.startsWith('/en/'))) &&
      (!/(?:^|\/)search(?:\/|$)/i.test(url.pathname) ||
        isAzureSearchArticle(url)) &&
      (!/(?:^|\/)videos?(?:\/|$)/i.test(url.pathname) ||
        (url.hostname === 'learn.microsoft.com' &&
          /^\/en-us\/azure\/ai-services\/content-understanding\/video\/[a-z0-9-]+\/?$/.test(
            url.pathname,
          ))) &&
      !/(?:^|\/)(?:answers|assessments?|knowledge-check|practice-tests?|exam-sandbox|shows|blogs?|forums?|community)(?:\/|$)/i.test(
        url.pathname,
      ) &&
      !/(?:knowledge-check|practice-test|exam-dump)/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}, 'Strict evidence must be direct public Microsoft Learn or GitHub Docs, not assessments, searches, blogs, or community content.');

export function englishTrainingTarget(value: string): string | undefined {
  if (!value.startsWith('https://learn.microsoft.com/training/'))
    return undefined;
  const localized = value.replace(
    'https://learn.microsoft.com/training/',
    'https://learn.microsoft.com/en-us/training/',
  );
  if (!strictEvidenceUrlSchema.safeParse(localized).success) return undefined;
  return /^\/en-us\/training\/(?:paths|modules)\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\/?$/.test(
    new URL(localized).pathname,
  )
    ? localized
    : undefined;
}

const text = z.string().trim().min(1);
const summary = text.min(20);
const isCourseOverview = (url: string) =>
  new URL(url).pathname.startsWith('/en-us/training/courses/');
export const sourceParentSchema = z
  .object({
    sourceId: text.optional(),
    credentialUrl: strictEvidenceUrlSchema.optional(),
    relation: z.enum(['direct-link', 'explicit-reference']),
    targetUrl: strictEvidenceUrlSchema.or(
      z
        .string()
        .refine(
          (value) => Boolean(englishTrainingTarget(value)),
          'A locale-neutral receipt must be a direct official Learn training path or module.',
        ),
    ),
    canonicalUrl: strictEvidenceUrlSchema,
    retrievedAt: timestampSchema,
    evidenceSummary: summary,
    relevanceJustification: summary,
  })
  .strict()
  .refine(
    (parent) => Boolean(parent.sourceId) !== Boolean(parent.credentialUrl),
    'Declare exactly one registry parent sourceId or training credentialUrl.',
  );
export const registeredSourceSchema = z
  .object({
    sourceId: text,
    canonicalUrl: strictEvidenceUrlSchema,
    title: text,
    retrievedAt: timestampSchema,
    lastValidatedAt: timestampSchema,
    examCode: text,
    objectiveIds: z.array(text).min(1),
    sourceClass: z.enum(['guide', 'training', 'doc']),
    contentRelevance: summary,
    parents: z.array(sourceParentSchema),
  })
  .strict();
export const sourceRegistrySchema = z
  .object({
    schemaVersion: z.literal(1),
    examCode: text,
    sources: z.array(registeredSourceSchema).min(1),
  })
  .strict();
export type SourceRegistry = z.infer<typeof sourceRegistrySchema>;

/** Evidence role requires a valid bound source and every ancestor, independent of GA/Preview. */
export function validatedSupportingSourceIds(
  credential: Credential,
  taxonomyData: unknown,
  manifestData: unknown,
  registryData: unknown,
): string[] {
  const taxonomy = taxonomySchema.safeParse(taxonomyData);
  const manifest = manifestSchema.safeParse(manifestData);
  if (!taxonomy.success || !manifest.success) return [];
  return inspectSourceProvenance(
    credential,
    taxonomy.data,
    manifest.data,
    [],
    registryData,
  ).supportingSourceIds;
}

/** Checks recorded provenance and exact source bindings, not the truth of curator statements. */
export function validateSourceProvenance(
  credential: Credential,
  taxonomy: Taxonomy,
  manifest: GroundingManifest,
  questions: Question[],
  data: unknown,
): ContentFinding[] {
  return inspectSourceProvenance(
    credential,
    taxonomy,
    manifest,
    questions,
    data,
  ).findings;
}

function inspectSourceProvenance(
  credential: Credential,
  taxonomy: Taxonomy,
  manifest: GroundingManifest,
  questions: Question[],
  data: unknown,
): { findings: ContentFinding[]; supportingSourceIds: string[] } {
  const findings: ContentFinding[] = [];
  const invalidSourceIds = new Set<string>();
  const children = new Map<string, Set<string>>();
  let invalidRegistry = false;
  const descendants = (sourceId: string) => {
    const affected = new Set<string>();
    const pending = [sourceId];
    while (pending.length) {
      const id = pending.pop()!;
      if (affected.has(id)) continue;
      affected.add(id);
      pending.push(...(children.get(id) ?? []));
    }
    return affected;
  };
  const fail = (message: string, sourceId?: string) => {
    if (sourceId) invalidSourceIds.add(sourceId);
    else invalidRegistry = true;
    const affected = sourceId ? descendants(sourceId) : undefined;
    findings.push({
      code: 'source-provenance',
      category: 'citation',
      severity: 'error',
      questionIds: affected
        ? questions
            .filter((q) => q.sourceIds.some((id) => affected.has(id)))
            .map((q) => q.id)
        : [],
      message: `${sourceId ? `${sourceId}: ` : ''}${message}`,
    });
  };
  const parsed = sourceRegistrySchema
    .omit({ sources: true })
    .extend({
      sources: z.array(z.unknown()).min(1),
    })
    .safeParse(data);
  if (!parsed.success) {
    fail(`Required source-registry.json is invalid: ${parsed.error.message}`);
    return { findings, supportingSourceIds: [] };
  }
  const registry = parsed.data;
  const recordId = (record: unknown): string | undefined => {
    if (
      !record ||
      typeof record !== 'object' ||
      !('sourceId' in record) ||
      typeof record.sourceId !== 'string'
    )
      return undefined;
    return record.sourceId.trim() || undefined;
  };
  // Preserve declared dependencies even when an ancestor record fails its schema.
  for (const record of registry.sources) {
    const id = recordId(record);
    if (
      !id ||
      !record ||
      typeof record !== 'object' ||
      !('parents' in record) ||
      !Array.isArray(record.parents)
    )
      continue;
    for (const parent of record.parents) {
      const parentId = recordId(parent);
      if (!parentId) continue;
      const dependents = children.get(parentId) ?? new Set<string>();
      dependents.add(id);
      children.set(parentId, dependents);
    }
  }
  if (registry.examCode !== credential.examCode)
    fail('Registry examCode differs from the catalog.');
  const sources = new Map<string, z.infer<typeof registeredSourceSchema>>();
  const seen = new Set<string>();
  for (const record of registry.sources) {
    const id = recordId(record);
    if (id && seen.has(id)) fail('Duplicate provenance source ID.', id);
    if (id) seen.add(id);
    const source = registeredSourceSchema.safeParse(record);
    if (!source.success)
      fail(`Invalid provenance source record: ${source.error.message}`, id);
    else sources.set(source.data.sourceId, source.data);
  }
  const objectiveIds = new Set(
    taxonomy.domains.flatMap((domain) => [
      domain.id,
      ...domain.skills.map((skill) => skill.id),
    ]),
  );
  const now = Date.now();
  for (const source of sources.values()) {
    const id = source.sourceId;
    if (source.examCode !== registry.examCode) fail('Wrong examCode.', id);
    if (
      new Set(source.objectiveIds).size !== source.objectiveIds.length ||
      source.objectiveIds.some((objective) => !objectiveIds.has(objective))
    )
      fail(
        'Registry objectives must be distinct current domain or skill IDs.',
        id,
      );
    if (
      Date.parse(source.retrievedAt) > Date.parse(source.lastValidatedAt) ||
      Date.parse(source.lastValidatedAt) > now
    )
      fail('Provenance retrieval/review chronology is invalid.', id);
    const url = new URL(source.canonicalUrl);
    if (source.sourceClass === 'guide') {
      if (
        source.canonicalUrl !== taxonomy.studyGuideUrl ||
        url.hostname !== 'learn.microsoft.com' ||
        !url.pathname.includes(
          '/credentials/certifications/resources/study-guides/',
        ) ||
        source.parents.length
      )
        fail(
          'Guide root must be the current official Learn study guide without parents.',
          id,
        );
    } else {
      if (!isAllowedSourceUrl(source.canonicalUrl, credential))
        fail(
          'Registered training/doc source or ancestor is outside the credential technical allowlist, regardless of feature-status applicability.',
          id,
        );
      if (!source.parents.length)
        fail('Training and documentation require approved ancestry.', id);
      if (
        source.sourceClass === 'training' &&
        (url.hostname !== 'learn.microsoft.com' ||
          !/^\/en-us\/training\/(?:paths|modules|courses)\//.test(url.pathname))
      )
        fail(
          'Training must be a Learn self-paced path, module, unit, or the current course ancestry overview.',
          id,
        );
      if (
        isCourseOverview(source.canonicalUrl) &&
        (source.sourceClass !== 'training' ||
          source.canonicalUrl !== credential.officialUrls.training)
      )
        fail(
          'A course overview is ancestry-only training bound to the exact current catalog preparation URL.',
          id,
        );
    }
    for (const parent of source.parents) {
      const localizedTarget = englishTrainingTarget(parent.targetUrl);
      if (
        localizedTarget &&
        (source.sourceClass !== 'training' ||
          parent.relation !== 'direct-link' ||
          localizedTarget !== parent.canonicalUrl)
      )
        fail(
          'A locale-neutral target must be a direct training link whose English URL exactly matches the recorded canonical source.',
          id,
        );
      if (
        parent.canonicalUrl !== source.canonicalUrl ||
        Date.parse(parent.retrievedAt) > Date.parse(source.lastValidatedAt)
      )
        fail(
          'Link/reference receipt must bind the canonical target and precede validation.',
          id,
        );
      if (parent.credentialUrl) {
        if (
          source.sourceClass !== 'training' ||
          parent.credentialUrl !== credential.officialUrls.credential ||
          new URL(parent.credentialUrl).hostname !== 'learn.microsoft.com'
        )
          fail(
            'Only training may descend directly from the exact official Learn credential page.',
            id,
          );
      } else {
        const ancestor = sources.get(parent.sourceId!);
        if (!ancestor || !['guide', 'training'].includes(ancestor.sourceClass))
          fail(
            'Immediate parent must be a registered guide or training source, never doc-to-doc.',
            id,
          );
        if (
          ancestor &&
          ((isCourseOverview(source.canonicalUrl) &&
            ancestor.sourceClass !== 'guide') ||
            (source.sourceClass === 'doc' &&
              isCourseOverview(ancestor.canonicalUrl)))
        )
          fail(
            'Course ancestry must descend directly from the current guide or credential; documentation needs a guide or self-paced training parent, not a course overview.',
            id,
          );
      }
    }
  }
  for (const source of manifest.sources) {
    const registered = sources.get(source.sourceId);
    if (!registered) {
      fail(
        'Source has no approved provenance registry record.',
        source.sourceId,
      );
      continue;
    }
    if (
      registered.canonicalUrl !== source.url ||
      registered.title !== source.title ||
      registered.retrievedAt !== source.retrievedAt ||
      registered.lastValidatedAt !== source.lastReviewedAt ||
      [...source.applicableObjectiveDomains, ...source.applicableSkills].some(
        (objective) => !registered.objectiveIds.includes(objective),
      )
    )
      fail(
        'Registry URL, title, dates and objective scope must bind the exact source manifest record.',
        source.sourceId,
      );
  }
  if (
    ![...sources.values()].some(
      (source) =>
        source.sourceClass === 'guide' &&
        source.canonicalUrl === taxonomy.studyGuideUrl &&
        !invalidSourceIds.has(source.sourceId),
    )
  )
    fail('Registry must contain a valid current official guide root.');
  const reachesRoot = (id: string, path: Set<string>): boolean => {
    const source = sources.get(id);
    if (invalidRegistry || !source || invalidSourceIds.has(id) || path.has(id))
      return false;
    if (source.sourceClass === 'guide') return true;
    const next = new Set(path).add(id);
    return (
      source.parents.length > 0 &&
      source.parents.every((parent) =>
        parent.credentialUrl
          ? source.sourceClass === 'training' &&
            parent.credentialUrl === credential.officialUrls.credential &&
            new URL(parent.credentialUrl).hostname === 'learn.microsoft.com'
          : reachesRoot(parent.sourceId!, next),
      )
    );
  };
  // Compute eligibility before adding derived errors so registry order cannot change it.
  const rootedIds = new Set(
    [...sources.keys()].filter((id) => reachesRoot(id, new Set())),
  );
  for (const id of sources.keys())
    if (!rootedIds.has(id))
      fail(
        'Provenance chain is missing, cyclic, contains an invalid ancestor, or does not terminate at an approved root.',
        id,
      );
  const manifestIds = new Set(
    manifest.sources.map((source) => source.sourceId),
  );
  const supportingSourceIds = [...sources.values()]
    .filter(
      (source) =>
        rootedIds.has(source.sourceId) &&
        manifestIds.has(source.sourceId) &&
        ['training', 'doc'].includes(source.sourceClass) &&
        !source.canonicalUrl.includes('/credentials/') &&
        !source.canonicalUrl.includes('/training/courses/') &&
        isAllowedSourceUrl(source.canonicalUrl, credential),
    )
    .map((source) => source.sourceId);
  return { findings, supportingSourceIds };
}
