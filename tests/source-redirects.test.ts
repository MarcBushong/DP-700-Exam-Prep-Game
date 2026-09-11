import { describe, expect, it, vi } from 'vitest';
import { checkOnlineSource, safeSourceUrl } from '../scripts/validate-sources';

const countUrl =
  'https://learn.microsoft.com/en-us/sql/t-sql/functions/count-transact-sql';
const canonicalCount = `${countUrl}?view=sql-server-ver17`;

describe('official SQL documentation view redirects', () => {
  it('accepts the observed canonical view only when following a redirect', () => {
    expect(() => safeSourceUrl(canonicalCount)).toThrow();
    expect(safeSourceUrl(canonicalCount, true).href).toBe(canonicalCount);
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
