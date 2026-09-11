import { readFile, writeFile } from 'node:fs/promises';
import { URL as NodeURL } from 'node:url';
import { learnUrlSchema } from '../src/features/grounding/schema';
import { isMain, loadContent } from './validate-questions';

export function safeSourceUrl(value: string, allowCanonicalView = false): URL {
  if (/[%\\\s<>"`]/.test(value))
    throw new Error(
      'Source URLs must not contain encoded paths, whitespace, or unsafe delimiters.',
    );
  const url = new URL(value);
  const structuralUrl = new URL(url);
  if (
    allowCanonicalView &&
    ((url.pathname.startsWith('/en-us/kusto/') &&
      url.search === '?view=microsoft-fabric') ||
      (url.pathname.startsWith('/en-us/sql/t-sql/') &&
        url.search === '?view=sql-server-ver17'))
  ) {
    structuralUrl.search = '';
  }
  learnUrlSchema.parse(structuralUrl.href);
  if (
    /%|\\/.test(url.pathname) ||
    /(?:assessment|knowledge-check|practice-test|exam-sandbox)/i.test(
      url.pathname,
    )
  ) {
    throw new Error(
      'Encoded paths and assessment pages are not permitted source checks.',
    );
  }
  return url;
}

export async function checkOnlineSource(
  value: string,
  fetcher: typeof fetch = fetch,
) {
  let url = safeSourceUrl(value);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    for (let redirects = 0; redirects <= 5; redirects++) {
      const response = await fetcher(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: 'text/html',
          'User-Agent': 'FabricChallenge-SourceValidator/1.0',
        },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get('location');
        if (!location || redirects === 5)
          throw new Error(
            'Missing redirect target or redirect limit exceeded.',
          );
        url = safeSourceUrl(new URL(location, url).href, true);
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`HTTP ${response.status}`);
      }
      if (
        !/text\/html|application\/xhtml\+xml/i.test(
          response.headers.get('content-type') ?? '',
        )
      ) {
        await response.body?.cancel();
        throw new Error('Expected a documentation HTML page.');
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Empty documentation response.');
      const decoder = new TextDecoder();
      let html = '';
      let bytes = 0;
      try {
        while (true) {
          const { done, value: chunk } = await reader.read();
          if (done) break;
          bytes += chunk.byteLength;
          if (bytes > 2_000_000)
            throw new Error('Documentation response exceeds the 2 MB limit.');
          html += decoder.decode(chunk, { stream: true });
        }
        html += decoder.decode();
      } finally {
        await reader.cancel();
      }
      const headings = [
        ...html.matchAll(/<(?:title|h1)\b[^>]*>([\s\S]*?)<\/(?:title|h1)>/gi),
      ]
        .map((match) => match[1].replace(/<[^>]+>/g, ''))
        .join(' ');
      if (
        !headings.trim() ||
        /(?:404|page not found|content not found|access denied|service unavailable|temporarily unavailable)/i.test(
          headings,
        ) ||
        /the resource you are looking for (?:has been removed|might have been removed)/i.test(
          html,
        )
      ) {
        throw new Error(
          'The URL returned an error page or no document heading.',
        );
      }
      return { finalUrl: url.href, status: response.status };
    }
    throw new Error('Redirect limit exceeded.');
  } finally {
    clearTimeout(timer);
  }
}

if (isMain(import.meta.url)) {
  try {
    const { manifest } = await loadContent();
    const urls = [...new Set(manifest.sources.map((source) => source.url))];
    urls.forEach((url) => safeSourceUrl(url));
    console.log(
      `Offline structural source checks passed: ${manifest.sources.length} records, ${urls.length} direct Learn URLs.`,
    );
    if (process.argv.includes('--online')) {
      const failures: string[] = [];
      for (const url of urls) {
        try {
          const result = await checkOnlineSource(url);
          console.log(
            `OK ${url}${result.finalUrl !== url ? ` -> ${result.finalUrl}` : ''}`,
          );
        } catch (error) {
          failures.push(
            `${url}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      if (failures.length)
        throw new Error(`Online validation failed:\n${failures.join('\n')}`);
      const checkedAt = new Date().toISOString();
      const maintenanceUrl = new NodeURL(
        '../docs/content-maintenance.md',
        import.meta.url,
      );
      const maintenance = await readFile(maintenanceUrl, 'utf8');
      const line = `Last successful online URL validation: ${checkedAt} (${urls.length} unique URLs).`;
      if (!/^Last successful online URL validation:.*$/m.test(maintenance))
        throw new Error(
          'Maintenance document is missing its validation date marker.',
        );
      await writeFile(
        maintenanceUrl,
        maintenance.replace(
          /^Last successful online URL validation:.*$/m,
          line,
        ),
      );
      console.log(line);
    } else {
      console.log(
        'No network requests made. Add --online for bounded, allowlisted URL availability checks.',
      );
    }
    console.log(
      'URL availability is not claim review. Re-ground factual changes through Microsoft Learn MCP.',
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
