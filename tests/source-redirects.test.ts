import { describe, expect, it, vi } from 'vitest';
import { checkOnlineSource, safeSourceUrl } from '../scripts/validate-sources';
import type { SourcePolicyContext } from '../src/features/dungeons/sourcePolicy';

const countUrl =
  'https://learn.microsoft.com/en-us/sql/t-sql/functions/count-transact-sql';
const canonicalCount = `${countUrl}?view=sql-server-ver17`;

describe('official SQL documentation view redirects', () => {
  it('accepts the observed canonical view only when following a redirect', () => {
    expect(() => safeSourceUrl(canonicalCount)).toThrow();
    expect(safeSourceUrl(canonicalCount, true).href).toBe(canonicalCount);
  });

  describe('recorded locale-neutral Learn training link checks', () => {
    const target =
      'https://learn.microsoft.com/training/paths/design-develop-database-solutions/';
    const canonical =
      'https://learn.microsoft.com/en-us/training/paths/design-develop-database-solutions/';
    const credential: SourcePolicyContext = {
      credentialId: 'dp-800',
      provider: 'Microsoft',
      strictGuideLinked: true,
      sourceAllowlist: [
        {
          host: 'learn.microsoft.com',
          pathPrefixes: [],
          exactUrls: [canonical],
        },
      ],
    };

    it('checks the observed redirect without admitting the target as canonical evidence', async () => {
      expect(() => safeSourceUrl(target, false, credential)).toThrow();
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response(null, {
            status: 301,
            headers: { location: canonical },
          }),
        )
        .mockResolvedValueOnce(
          new Response(
            '<title>Database training</title><h1>Database training</h1>',
            {
              headers: { 'content-type': 'text/html' },
            },
          ),
        );
      await expect(
        checkOnlineSource(target, fetcher, credential, canonical),
      ).resolves.toEqual({
        finalUrl: canonical,
        status: 200,
      });
      expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
        target,
        canonical,
      ]);
    });

    it('rejects a target that stops redirecting instead of relabelling its response as canonical', async () => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response('<title>Training without redirect</title>', {
            headers: { 'content-type': 'text/html' },
          }),
        );
      await expect(
        checkOnlineSource(target, fetcher, credential, canonical),
      ).rejects.toThrow(/did not redirect/i);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('rejects an unbound initial target before any network request', async () => {
      const fetcher = vi.fn<typeof fetch>();
      await expect(
        checkOnlineSource(
          target.replace('design-develop', 'different'),
          fetcher,
          credential,
          canonical,
        ),
      ).rejects.toThrow();
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('rejects even an otherwise allowed redirect when it differs from the receipt', async () => {
      const different = canonical.replace('design-develop', 'different');
      const allowed = structuredClone(credential);
      allowed.sourceAllowlist[0].exactUrls.push(different);
      const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: different },
        }),
      );
      await expect(
        checkOnlineSource(target, fetcher, allowed, canonical),
      ).rejects.toThrow(/canonical|receipt/i);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('does not grant the transport exception to a legacy or unapproved source policy', async () => {
      const fetcher = vi.fn<typeof fetch>();
      await expect(
        checkOnlineSource(
          target,
          fetcher,
          {
            ...credential,
            strictGuideLinked: false,
          },
          canonical,
        ),
      ).rejects.toThrow();
      await expect(
        checkOnlineSource(
          target,
          fetcher,
          {
            ...credential,
            sourceAllowlist: [],
          },
          canonical,
        ),
      ).rejects.toThrow();
      expect(fetcher).not.toHaveBeenCalled();
    });
  });

  it.each([
    `${countUrl}?view=sql-server-ver17&redirect=https://example.com`,
    `${countUrl}?view=unknown`,
    'https://learn.microsoft.com/en-us/fabric/security/security-overview?view=sql-server-ver17',
    'https://example.com/en-us/sql/t-sql/functions/count-transact-sql?view=sql-server-ver17',
  ])('does not broaden the source allowlist for %s', (url) => {
    expect(() => safeSourceUrl(url, true)).toThrow();
  });

  it('checks the canonical document rather than reporting a valid redirect as a failure', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 301,
          headers: {
            location: `${new URL(countUrl).pathname}?view=sql-server-ver17`,
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response('<title>COUNT (Transact-SQL)</title><h1>COUNT</h1>', {
          headers: { 'content-type': 'text/html' },
        }),
      );
    await expect(checkOnlineSource(countUrl, fetcher)).resolves.toEqual({
      finalUrl: canonicalCount,
      status: 200,
    });
    expect(String(fetcher.mock.calls[1][0])).toBe(canonicalCount);
  });
});
