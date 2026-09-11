import { describe, expect, it } from 'vitest';
import {
  learnUrlSchema,
  officialSourceUrlSchema,
  credentialEvidenceUrlSchema,
  isAllowedSourceUrl,
  isAllowedIdentityUrl,
  sourceRuleSchema,
  type SourcePolicyContext,
} from '../src/features/dungeons/sourcePolicy';
import { safeSourceUrl, checkOnlineSource } from '../scripts/validate-sources';
import { inspectContent } from '../src/features/grounding/schema';
import { dungeonFixture } from './dungeon-fixtures';

const github: SourcePolicyContext = {
  provider: 'GitHub',
  sourceAllowlist: [
    { host: 'docs.github.com', pathPrefixes: ['/en/copilot/'], exactUrls: [] },
    {
      host: 'resources.github.com',
      pathPrefixes: [],
      exactUrls: [
        'https://resources.github.com/learn/certifications/fixture-outline.pdf',
      ],
    },
  ],
};
describe('credential-specific official source policies', () => {
  it('accepts the captured SSPR article only within the explicit non-DP-700 credential policy', () => {
    const url =
      'https://learn.microsoft.com/en-us/entra/identity/authentication/tutorial-enable-sspr';
    const policy: SourcePolicyContext = {
      credentialId: 'az-104',
      provider: 'Microsoft',
      sourceAllowlist: [
        {
          host: 'learn.microsoft.com',
          pathPrefixes: ['/en-us/entra/identity/authentication/'],
          exactUrls: [],
        },
      ],
    };
    expect(officialSourceUrlSchema.safeParse(url).success).toBe(true);
    expect(isAllowedSourceUrl(url, policy)).toBe(true);
    expect(learnUrlSchema.safeParse(url).success).toBe(false);
    expect(isAllowedSourceUrl(url, { ...policy, credentialId: 'dp-700' })).toBe(
      false,
    );
    expect(
      isAllowedSourceUrl(
        'https://learn.microsoft.com/en-us/entra/identity/users/users-default-permissions',
        policy,
      ),
    ).toBe(false);
  });
  it('distinguishes retrieved Azure AI Search articles from site search endpoints', () => {
    const policy: SourcePolicyContext = {
      credentialId: 'ai-103',
      provider: 'Microsoft',
      sourceAllowlist: [
        {
          host: 'learn.microsoft.com',
          pathPrefixes: ['/en-us/azure/search/'],
          exactUrls: [],
        },
      ],
    };
    for (const article of [
      'semantic-search-overview',
      'hybrid-search-overview',
      'hybrid-search-how-to-query',
    ]) {
      const url = `https://learn.microsoft.com/en-us/azure/search/${article}`;
      expect(officialSourceUrlSchema.safeParse(url).success).toBe(true);
      expect(credentialEvidenceUrlSchema.safeParse(url).success).toBe(true);
      expect(isAllowedSourceUrl(url, policy)).toBe(true);
      expect(learnUrlSchema.safeParse(url).success).toBe(false);
      expect(
        isAllowedSourceUrl(url, { ...policy, credentialId: 'dp-700' }),
      ).toBe(false);
      expect(isAllowedSourceUrl(url, { ...policy, sourceAllowlist: [] })).toBe(
        false,
      );
    }
    for (const url of [
      'https://learn.microsoft.com/en-us/search/',
      'https://learn.microsoft.com/en-us/search/?terms=azure',
      'https://learn.microsoft.com/en-us/search?terms=',
      'https://learn.microsoft.com/search/query',
      'https://learn.microsoft.com/en-us/azure/search/',
      'https://learn.microsoft.com/en-us/azure/search/semantic-search-overview?terms=azure',
      'https://learn.microsoft.com/en-us/azure/search/assessment',
      'https://learn.microsoft.com/en-us/azure/private/search/results',
    ])
      expect(officialSourceUrlSchema.safeParse(url).success).toBe(false);
  });
  it('permits only the three captured GitHub identity keys and separates identity evidence from encounter sources', () => {
    for (const key of ['COPILOT', 'GHAS', 'AGENTIC'])
      for (const path of ['certification', 'api/certifications']) {
        const url = `https://learn.github.com/${path}/${key}`;
        const policy: SourcePolicyContext = {
          provider: 'GitHub',
          sourceAllowlist: [],
        };
        expect(officialSourceUrlSchema.safeParse(url).success).toBe(true);
        expect(isAllowedIdentityUrl(url, policy)).toBe(true);
        expect(credentialEvidenceUrlSchema.safeParse(url).success).toBe(true);
        expect(isAllowedSourceUrl(url, policy)).toBe(false);
        expect(
          sourceRuleSchema.safeParse({
            host: 'learn.github.com',
            pathPrefixes: [],
            exactUrls: [url],
          }).success,
        ).toBe(false);
        expect(isAllowedIdentityUrl(url, github)).toBe(true);
        expect(isAllowedIdentityUrl(url, dungeonFixture().credential)).toBe(
          false,
        );
      }
    for (const url of [
      'https://learn.github.com/api/certifications/UNKNOWN',
      'https://learn.github.com/api/users/COPILOT',
      'https://learn.github.com/certification/COPILOT/private',
      'https://learn.github.com/search',
    ])
      expect(officialSourceUrlSchema.safeParse(url).success).toBe(false);
    expect(
      sourceRuleSchema.safeParse({
        host: 'learn.github.com',
        pathPrefixes: ['/api/certifications/'],
        exactUrls: [],
      }).success,
    ).toBe(false);
  });
  it('supports retrieved Microsoft product families without broadening legacy DP-700 or bypassing credential rules', () => {
    for (const prefix of [
      'entra',
      'defender-xdr',
      'defender-endpoint',
      'defender-cloud-apps',
      'security',
      'microsoft-365',
    ]) {
      const url = `https://learn.microsoft.com/en-us/${prefix}/fixture-document`;
      const policy: SourcePolicyContext = {
        credentialId: 'sc-200',
        provider: 'Microsoft',
        sourceAllowlist: [
          {
            host: 'learn.microsoft.com',
            pathPrefixes: [`/en-us/${prefix}/`],
            exactUrls: [],
          },
        ],
      };
      expect(learnUrlSchema.safeParse(url).success).toBe(false);
      expect(officialSourceUrlSchema.safeParse(url).success).toBe(true);
      expect(isAllowedSourceUrl(url, policy)).toBe(true);
      expect(
        isAllowedSourceUrl(url, { ...policy, credentialId: 'dp-700' }),
      ).toBe(false);
      expect(isAllowedSourceUrl(url, { ...policy, sourceAllowlist: [] })).toBe(
        false,
      );
    }
    for (const url of [
      'https://learn.microsoft.com/en-us/private/internal-document',
      'https://learn.microsoft.com/en-us/entra/assessment/test',
      'https://learn.microsoft.com/en-us/security/search',
    ])
      expect(officialSourceUrlSchema.safeParse(url).success).toBe(false);
  });
  it('permits an exact GitHub competency API as taxonomy/context metadata but never as an implementation citation', () => {
    const { raw } = dungeonFixture();
    const outline = 'https://learn.github.com/api/certifications/COPILOT';
    const policy: SourcePolicyContext = {
      provider: 'GitHub',
      sourceAllowlist: [
        {
          host: 'docs.github.com',
          pathPrefixes: ['/en/copilot/'],
          exactUrls: [],
        },
      ],
    };
    const taxonomy = {
      ...raw.taxonomy,
      studyGuideUrl: outline,
      studyGuideEffectiveDate: 'UNDATED synthetic retrieval snapshot',
    };
    const manifest = {
      ...raw.manifest,
      retrievalMethod: 'Official GitHub documentation' as const,
      sources: [
        {
          ...raw.manifest.sources[0],
          url: 'https://docs.github.com/en/copilot/fixture-implementation',
        },
        {
          ...raw.manifest.sources[0],
          sourceId: 'outline',
          url: outline,
          featureStatus: 'Not applicable' as const,
        },
      ],
    };
    raw.questions[0].sourceUrls = [manifest.sources[0].url];
    expect(
      inspectContent(raw.questions, manifest, taxonomy, policy).findings,
    ).toEqual([]);
    manifest.sources[0].url = outline;
    raw.questions[0].sourceUrls = [outline];
    const invalid = inspectContent(raw.questions, manifest, taxonomy, policy);
    expect(invalid.questions).toEqual([]);
    expect(
      invalid.findings.some((finding) =>
        /source policy/i.test(finding.message),
      ),
    ).toBe(true);
  });
  it('preserves the strict Learn contract while supporting bounded GitHub documentation policies', () => {
    const doc =
      'https://docs.github.com/en/copilot/overview-of-github-copilot/about-github-copilot';
    const microsoft = dungeonFixture().credential;
    expect(officialSourceUrlSchema.safeParse(doc).success).toBe(true);
    expect(learnUrlSchema.safeParse(doc).success).toBe(false);
    expect(isAllowedSourceUrl(doc, github)).toBe(true);
    expect(isAllowedSourceUrl(doc, microsoft)).toBe(false);
    expect(
      isAllowedSourceUrl(
        'https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions',
        github,
      ),
    ).toBe(false);
    expect(
      isAllowedSourceUrl(
        'https://learn.microsoft.com/en-us/fabric/security/security-overview',
        github,
      ),
    ).toBe(false);
  });
  it('never grants a blanket resources host or accepts lookalikes, unsafe URLs, search, or arbitrary repositories', () => {
    expect(
      sourceRuleSchema.safeParse({
        host: 'resources.github.com',
        pathPrefixes: ['/learn/'],
        exactUrls: [],
      }).success,
    ).toBe(false);
    for (const url of [
      'https://docs.github.com.attacker.test/en/copilot/article',
      'http://docs.github.com/en/copilot/article',
      'https://user:password@docs.github.com/en/copilot/article',
      'https://docs.github.com:444/en/copilot/article',
      'https://docs.github.com/en/copilot/article?redirect=elsewhere',
      'https://docs.github.com/en/search',
      'https://docs.github.com/en/copilot/%2e%2e/article',
      'https://github.com/random-owner/random-repository',
      'https://resources.github.com/learn/certifications/another-outline.pdf',
      'javascript:alert(1)',
    ])
      expect(isAllowedSourceUrl(url, github)).toBe(false);
    expect(
      isAllowedSourceUrl(
        'https://resources.github.com/learn/certifications/fixture-outline.pdf',
        github,
      ),
    ).toBe(true);
  });
  it('rejects a structurally official URL from another credential in content inspection', () => {
    const { credential, raw } = dungeonFixture();
    raw.manifest.sources[0].url =
      'https://docs.github.com/en/copilot/about-github-copilot';
    raw.questions[0].sourceUrls = [raw.manifest.sources[0].url];
    const report = inspectContent(
      raw.questions,
      raw.manifest,
      raw.taxonomy,
      credential,
    );
    expect(report.questions).toEqual([]);
    expect(
      report.findings.some((finding) => /source policy/i.test(finding.message)),
    ).toBe(true);
  });
  it('checks redirected GitHub URLs against the same credential, not a broad global domain rule', async () => {
    const fetcher = (async () =>
      new Response(null, {
        status: 302,
        headers: { location: 'https://resources.github.com/unapproved' },
      })) as typeof fetch;
    await expect(
      checkOnlineSource(
        'https://docs.github.com/en/copilot/article',
        fetcher,
        github,
      ),
    ).rejects.toThrow(/not approved/i);
    expect(() =>
      safeSourceUrl('https://docs.github.com/en/copilot/article'),
    ).toThrow();
    expect(() =>
      safeSourceUrl(
        'https://docs.github.com/en/copilot/article',
        false,
        github,
      ),
    ).not.toThrow();
  });
});
