import { readFile, writeFile } from 'node:fs/promises';
import { URL as NodeURL } from 'node:url';
import { learnUrlSchema } from '../src/features/grounding/schema';
import { isMain, loadContent } from './validate-questions';
import {
  assertAllowedSourceUrl,
  isAllowedIdentityUrl,
  type SourcePolicyContext,
} from '../src/features/dungeons/sourcePolicy';
import { credentials } from '../src/features/dungeons/catalog';
import { examId } from './content-files';

export function safeSourceUrl(
  value: string,
  allowCanonicalView = false,
  credential?: SourcePolicyContext,
): URL {
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
  if (credential) assertAllowedSourceUrl(structuralUrl.href, credential);
  else learnUrlSchema.parse(structuralUrl.href);
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
  credential?: SourcePolicyContext,
) {
  let url = safeSourceUrl(value, false, credential);
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
        url = safeSourceUrl(new URL(location, url).href, true, credential);
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`HTTP ${response.status}`);
      }
      const officialPdf =
        credential?.provider === 'GitHub' &&
        url.pathname.endsWith('.pdf') &&
        /application\/pdf/i.test(response.headers.get('content-type') ?? '');
      if (officialPdf) {
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Empty documentation response.');
        let bytes = 0;
        let prefix = '';
        try {
          while (true) {
            const { done, value: chunk } = await reader.read();
            if (done) break;
            if (prefix.length < 5)
              prefix += new TextDecoder().decode(
                chunk.subarray(0, 5 - prefix.length),
              );
            bytes += chunk.byteLength;
            if (bytes > 2_000_000)
              throw new Error('Documentation response exceeds the 2 MB limit.');
          }
        } finally {
          await reader.cancel();
        }
        if (prefix !== '%PDF-')
          throw new Error('Expected an official competency PDF document.');
        return { finalUrl: url.href, status: response.status };
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
    const credential = credentials.find(
      (entry) => entry.credentialId === examId(),
    )!;
    const urls = [...new Set(manifest.sources.map((source) => source.url))];
    const identityContextUrls = urls.filter(
      (url) =>
        new URL(url).hostname === 'learn.github.com' &&
        manifest.sources
          .filter((source) => source.url === url)
          .every((source) => source.featureStatus === 'Not applicable'),
    );
    urls.forEach((url) => {
      if (identityContextUrls.includes(url)) {
        if (!isAllowedIdentityUrl(url, credential))
          throw new Error(`Unapproved identity/competency context URL: ${url}`);
      } else safeSourceUrl(url, false, credential);
    });
    console.log(
      `Offline structural source checks passed: ${manifest.sources.length} records, ${urls.length} credential-approved official URLs.`,
    );
    if (process.argv.includes('--online')) {
      const failures: string[] = [];
      for (const url of identityContextUrls)
        console.log(
          `SKIP identity/competency context ${url}: availability must be checked through credential discovery, not the implementation-document checker.`,
        );
      const implementationUrls = urls.filter(
        (url) => !identityContextUrls.includes(url),
      );
      for (const url of implementationUrls) {
        try {
          const result = await checkOnlineSource(url, fetch, credential);
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
      const line = `Last successful online URL validation: ${checkedAt} (${implementationUrls.length} unique URLs; ${identityContextUrls.length} identity context URLs not checked).`;
      if (credential.credentialId === 'dp-700') {
        const maintenance = await readFile(maintenanceUrl, 'utf8');
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
      }
      console.log(line);
    } else {
      console.log(
        'No network requests made. Add --online for bounded, allowlisted URL availability checks.',
      );
    }
    console.log(
      'URL availability is not claim review. Re-ground through the credential-specific authoritative retrieval workflow.',
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
