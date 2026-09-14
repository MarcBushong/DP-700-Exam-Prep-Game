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
import { argument, examId } from './content-files';
import {
  englishTrainingTarget,
  strictEvidenceUrlSchema,
  sourceRegistrySchema,
} from '../src/features/dungeons/provenance';

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
  if (credential?.strictGuideLinked)
    strictEvidenceUrlSchema.parse(structuralUrl.href);
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

function safeTrainingLinkTarget(
  value: string,
  canonicalUrl: string,
  credential?: SourcePolicyContext,
): URL {
  if (
    !credential?.strictGuideLinked ||
    englishTrainingTarget(value) !== canonicalUrl
  )
    throw new Error(
      'A training-link check requires an exactly bound strict canonical receipt.',
    );
  safeSourceUrl(canonicalUrl, false, credential);
  return new URL(value);
}

export async function checkOnlineSource(
  value: string,
  fetcher: typeof fetch = fetch,
  credential?: SourcePolicyContext,
  trainingCanonicalUrl?: string,
) {
  let url = trainingCanonicalUrl
    ? safeTrainingLinkTarget(value, trainingCanonicalUrl, credential)
    : safeSourceUrl(value, false, credential);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    for (let redirects = 0; redirects <= 5; redirects++) {
      const response = await fetcher(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept:
            url.hostname === 'docs.github.com'
              ? 'text/markdown, text/html;q=0.9'
              : 'text/html',
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
        const target = new URL(location, url).href;
        if (trainingCanonicalUrl && target !== trainingCanonicalUrl)
          throw new Error(
            'Training link redirect differs from its recorded canonical receipt.',
          );
        url = safeSourceUrl(target, true, credential);
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`HTTP ${response.status}`);
      }
      if (trainingCanonicalUrl && url.href !== trainingCanonicalUrl) {
        await response.body?.cancel();
        throw new Error(
          'Training link did not redirect to its recorded canonical source.',
        );
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
      const officialMarkdown =
        credential?.provider === 'GitHub' &&
        url.hostname === 'docs.github.com' &&
        /^text\/markdown(?:;|$)/i.test(
          response.headers.get('content-type') ?? '',
        );
      if (
        !officialMarkdown &&
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
      const headings = officialMarkdown
        ? [...html.matchAll(/^#\s+(.+)$/gm)].map((match) => match[1]).join(' ')
        : [
            ...html.matchAll(
              /<(?:title|h1)\b[^>]*>([\s\S]*?)<\/(?:title|h1)>/gi,
            ),
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
    const content = await loadContent();
    const { manifest } = content;
    const selected = credentials.find(
      (entry) => entry.credentialId === examId(),
    )!;
    const credential = {
      ...selected,
      strictGuideLinked:
        Boolean(selected.requiredReviewPolicy) ||
        ('packageManifest' in content &&
          Boolean(content.packageManifest.reviewPolicy)) ||
        Boolean(argument('--source-registry')),
    };
    const registry =
      credential.strictGuideLinked && 'sourceRegistry' in content
        ? sourceRegistrySchema.parse(content.sourceRegistry)
        : undefined;
    const trainingTargets = new Map(
      registry?.sources.flatMap((source) =>
        source.sourceClass === 'training'
          ? source.parents
              .filter(
                (parent) =>
                  parent.relation === 'direct-link' &&
                  englishTrainingTarget(parent.targetUrl) ===
                    parent.canonicalUrl,
              )
              .map((parent) => [parent.targetUrl, parent.canonicalUrl] as const)
          : [],
      ),
    );
    const urls = [
      ...new Set([
        ...manifest.sources.map((source) => source.url),
        ...(registry?.sources.flatMap((source) => [
          source.canonicalUrl,
          ...source.parents.map((parent) => parent.targetUrl),
        ]) ?? []),
      ]),
    ];
    const identityContextUrls = urls.filter(
      (url) =>
        new URL(url).hostname === 'learn.github.com' &&
        manifest.sources
          .filter((source) => source.url === url)
          .every((source) => source.featureStatus === 'Not applicable'),
    );
    urls.forEach((url) => {
      const trainingCanonical = trainingTargets.get(url);
      if (trainingCanonical)
        safeTrainingLinkTarget(url, trainingCanonical, credential);
      else if (identityContextUrls.includes(url)) {
        if (!isAllowedIdentityUrl(url, credential))
          throw new Error(`Unapproved identity/competency context URL: ${url}`);
      } else safeSourceUrl(url, false, credential);
    });
    console.log(
      `Offline structural source checks passed: ${manifest.sources.length} records, ${urls.length} credential-approved official URLs.`,
    );
    if (trainingTargets.size)
      console.log(
        `${trainingTargets.size} checked URLs are recorded training-link targets, not additional canonical evidence sources.`,
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
          const result = await checkOnlineSource(
            url,
            fetch,
            credential,
            trainingTargets.get(url),
          );
          if (registry) {
            const expectedTargets = registry.sources.flatMap((source) => [
              ...(source.canonicalUrl === url ? [source.canonicalUrl] : []),
              ...source.parents
                .filter((parent) => parent.targetUrl === url)
                .map((parent) => parent.canonicalUrl),
            ]);
            if (expectedTargets.some((target) => target !== result.finalUrl))
              throw new Error(
                `Resolved target ${result.finalUrl} differs from the recorded canonical redirect receipt; curator review required.`,
              );
          }
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
