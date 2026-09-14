import { describe, expect, it, vi } from 'vitest';
import { checkOnlineSource } from '../scripts/validate-sources';
import type { SourcePolicyContext } from '../src/features/dungeons/sourcePolicy';

const url =
  'https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax';
const credential: SourcePolicyContext = {
  credentialId: 'github-agentic-ai-developer',
  provider: 'GitHub',
  sourceAllowlist: [
    { host: 'docs.github.com', pathPrefixes: [], exactUrls: [url] },
  ],
};
const markdown = (body: string) =>
  new Response(body, {
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  });

describe('bounded official GitHub Markdown availability', () => {
  it('requests the smaller official representation at the same approved URL', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        markdown(
          '# Workflow syntax for GitHub Actions\n\nOfficial reference body.',
        ),
      );
    await expect(checkOnlineSource(url, fetcher, credential)).resolves.toEqual({
      finalUrl: url,
      status: 200,
    });
    expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({
      Accept: 'text/markdown, text/html;q=0.9',
    });
  });

  it.each([
    '# Page not found\n',
    'No document heading.',
    '# Service unavailable\n',
  ])('rejects Markdown errors or missing titles: %s', async (body) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(markdown(body));
    await expect(checkOnlineSource(url, fetcher, credential)).rejects.toThrow(
      /error page|no document heading/,
    );
  });

  it('retains the existing response-size bound for Markdown', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(markdown(`# Reference\n${'x'.repeat(2_000_001)}`));
    await expect(checkOnlineSource(url, fetcher, credential)).rejects.toThrow(
      /2 MB/,
    );
  });

  it('does not accept Markdown from an unrelated source host', async () => {
    const learnUrl =
      'https://learn.microsoft.com/en-us/fabric/fundamentals/overview';
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(markdown('# A title'));
    await expect(checkOnlineSource(learnUrl, fetcher)).rejects.toThrow(
      /Expected a documentation HTML page/,
    );
  });

  it('does not broaden the credential allowlist', async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      checkOnlineSource(
        'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement',
        fetcher,
        credential,
      ),
    ).rejects.toThrow(/not approved/);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
