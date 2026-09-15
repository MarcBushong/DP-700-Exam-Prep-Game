import { describe, expect, it } from 'vitest';
import {
  sameCanonicalDocument,
  matchesRecordedSourceTarget,
  safeSourceUrl,
} from '../scripts/validate-sources';
import type { SourcePolicyContext } from '../src/features/dungeons/sourcePolicy';

const article =
  'https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference';

describe('canonical source document identity', () => {
  it('compares document identity without rewriting recorded section receipts', () => {
    const target = `${article}#configure-an-identity-based-connection`;
    expect(sameCanonicalDocument(article, target)).toBe(true);
    expect(sameCanonicalDocument(target, article)).toBe(true);
    expect(sameCanonicalDocument(target, `${article}#another-section`)).toBe(
      true,
    );
    expect(target).toContain('#configure-an-identity-based-connection');
  });

  it.each([
    `${article}-python`,
    `${article}?redirect=elsewhere`,
    'http://learn.microsoft.com/en-us/azure/azure-functions/functions-reference',
    'https://example.test/en-us/azure/azure-functions/functions-reference',
    'https://learn.microsoft.com:8443/en-us/azure/azure-functions/functions-reference',
  ])('still rejects different document identity %s', (actual) => {
    expect(sameCanonicalDocument(article, actual)).toBe(false);
  });

  it('allows only the recorded AI-103 layout v4.0 redirect, never stored queries or other versions', () => {
    const layout =
      'https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/layout';
    const policy: SourcePolicyContext = {
      credentialId: 'ai-103',
      provider: 'Microsoft',
      strictGuideLinked: true,
      sourceAllowlist: [
        {
          host: 'learn.microsoft.com',
          pathPrefixes: [],
          exactUrls: [layout, `${layout}#layout-model`],
        },
      ],
    };
    const canonical = `${layout}?view=doc-intel-4.0.0`;
    expect(safeSourceUrl(canonical, true, policy).href).toBe(canonical);
    expect(() => safeSourceUrl(canonical, false, policy)).toThrow();
    expect(sameCanonicalDocument(layout, canonical, policy)).toBe(true);
    expect(
      matchesRecordedSourceTarget(canonical, `${layout}#layout-model`, policy),
    ).toBe(true);
    expect(sameCanonicalDocument(layout, canonical)).toBe(false);
    for (const unexpected of [
      `${layout}?view=doc-intel-3.1.0`,
      `${layout}?view=doc-intel-4.0.0&redirect=elsewhere`,
      `${layout}-other?view=doc-intel-4.0.0`,
    ]) {
      expect(() => safeSourceUrl(unexpected, true, policy)).toThrow();
      expect(sameCanonicalDocument(layout, unexpected, policy)).toBe(false);
    }
    expect(() =>
      safeSourceUrl(canonical, true, { ...policy, credentialId: 'dp-700' }),
    ).toThrow();
    expect(() =>
      safeSourceUrl(canonical, true, { ...policy, sourceAllowlist: [] }),
    ).toThrow();
  });
});
