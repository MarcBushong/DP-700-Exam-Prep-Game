import { z } from 'zod';

const unsafePath =
  /(?:^|\/)(?:assessments?|knowledge-check|practice-test|exam-sandbox)(?:\/|$)/i;
const searchPath = /(?:^|\/)search(?:\/|$)/i;

function isAzureSearchArticle(url: URL): boolean {
  return (
    url.hostname === 'learn.microsoft.com' &&
    /^\/en-us\/azure\/search\/[a-z0-9-]+\/?$/.test(url.pathname)
  );
}

function directHttpsUrl(value: string): URL | undefined {
  try {
    if (/[%\\\s<>"`]/.test(value)) return undefined;
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      unsafePath.test(url.pathname) ||
      (searchPath.test(url.pathname) && !isAzureSearchArticle(url))
    )
      return undefined;
    return url;
  } catch {
    return undefined;
  }
}

export const learnUrlSchema = z.string().refine((value) => {
  const url = directHttpsUrl(value);
  return Boolean(
    url &&
    url.hostname === 'learn.microsoft.com' &&
    !url.pathname.includes('/search') &&
    /^\/en-us\/(fabric|azure|kusto|sql|training|credentials|power-bi)\//.test(
      url.pathname,
    ) &&
    !/(?:assessment|knowledge-check|practice-test|exam-sandbox)/i.test(
      url.pathname,
    ),
  );
}, 'Use a direct HTTPS English Microsoft Learn documentation URL, not a search URL.');

const officialLearnProductPrefixes = [
  'fabric',
  'azure',
  'kusto',
  'sql',
  'training',
  'credentials',
  'power-bi',
  'entra',
  'defender-xdr',
  'defender-endpoint',
  'defender-cloud-apps',
  'security',
  'microsoft-365',
];

function isOfficialLearnProductUrl(value: string): boolean {
  const url = directHttpsUrl(value);
  return Boolean(
    url &&
    url.hostname === 'learn.microsoft.com' &&
    officialLearnProductPrefixes.some((prefix) =>
      url.pathname.startsWith(`/en-us/${prefix}/`),
    ) &&
    (!url.pathname.includes('/search') || isAzureSearchArticle(url)) &&
    !/(?:assessment|knowledge-check|practice-test|exam-sandbox)/i.test(
      url.pathname,
    ),
  );
}

/** This is structural validation only. Every package must also apply its own allowlist. */
export const officialSourceUrlSchema = z.string().refine((value) => {
  if (isOfficialLearnProductUrl(value)) return true;
  const url = directHttpsUrl(value);
  if (!url) return false;
  return (
    (url.hostname === 'docs.github.com' && url.pathname.startsWith('/en/')) ||
    (url.hostname === 'learn.github.com' &&
      /^\/(?:certification|api\/certifications)\/(?:COPILOT|GHAS|AGENTIC)$/.test(
        url.pathname,
      )) ||
    url.hostname === 'skills.github.com' ||
    url.hostname === 'resources.github.com' ||
    (url.hostname === 'github.com' && url.pathname.startsWith('/resources/'))
  );
}, 'Use a direct official Microsoft Learn or approved GitHub documentation URL.');

export const credentialEvidenceUrlSchema = officialSourceUrlSchema.describe(
  'Direct official credential identity or competency evidence, including only the approved GitHub certification API keys. This does not authorize technical encounter citations.',
);

export const sourceRuleSchema = z
  .object({
    host: z.enum([
      'learn.microsoft.com',
      'docs.github.com',
      'skills.github.com',
      'resources.github.com',
      'github.com',
    ]),
    pathPrefixes: z.array(z.string().startsWith('/')).default([]),
    exactUrls: z.array(officialSourceUrlSchema).default([]),
  })
  .superRefine((rule, context) => {
    if (
      rule.pathPrefixes.length &&
      !['learn.microsoft.com', 'docs.github.com'].includes(rule.host)
    )
      context.addIssue({
        code: 'custom',
        message:
          'GitHub resources and skills require exact independently approved URLs, not a blanket host or path.',
      });
    if (
      rule.pathPrefixes.some(
        (prefix) => prefix === '/' || !prefix.endsWith('/'),
      )
    )
      context.addIssue({
        code: 'custom',
        message:
          'Source prefixes must be bounded documentation directories ending in /.',
      });
    if (rule.exactUrls.some((url) => new URL(url).hostname !== rule.host))
      context.addIssue({
        code: 'custom',
        message: 'An exact URL must match its source-rule host.',
      });
  });

export type SourceRule = z.infer<typeof sourceRuleSchema>;
export interface SourcePolicyContext {
  credentialId?: string;
  provider: 'Microsoft' | 'GitHub';
  sourceAllowlist: SourceRule[];
}

export function isAllowedIdentityUrl(
  value: string,
  credential: SourcePolicyContext,
): boolean {
  if (!credentialEvidenceUrlSchema.safeParse(value).success) return false;
  if (
    credential.provider === 'Microsoft' &&
    !(credential.credentialId === 'dp-700'
      ? learnUrlSchema.safeParse(value).success
      : isOfficialLearnProductUrl(value))
  )
    return false;
  return true;
}

export function isAllowedSourceUrl(
  value: string,
  credential: SourcePolicyContext,
): boolean {
  if (!isAllowedIdentityUrl(value, credential)) return false;
  const url = new URL(value);
  if (url.hostname === 'learn.github.com') return false;
  return credential.sourceAllowlist.some(
    (rule) =>
      rule.host === url.hostname &&
      (rule.exactUrls.includes(value) ||
        (['learn.microsoft.com', 'docs.github.com'].includes(rule.host) &&
          rule.pathPrefixes.some(
            (prefix) =>
              prefix !== '/' &&
              prefix.endsWith('/') &&
              url.pathname.startsWith(prefix),
          ))),
  );
}

export function assertAllowedSourceUrl(
  value: string,
  credential: SourcePolicyContext,
): URL {
  if (!isAllowedSourceUrl(value, credential))
    throw new Error(`Source URL is not approved for this credential: ${value}`);
  return new URL(value);
}
