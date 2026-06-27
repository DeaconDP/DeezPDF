import { searchArchiveOrg } from './archive-org';
import { searchGutenberg } from './gutenberg';
import { searchWebPdfs } from './web-search';
import type { LookupResult, LookupSearchOptions, LookupSearchOutcome } from './types';

const MAX_RESULTS = 30;

function normalizePdfUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.href.replace(/\/$/, '');
  } catch {
    return url.trim().toLowerCase();
  }
}

function dedupeResults(results: LookupResult[]): LookupResult[] {
  const seen = new Set<string>();
  const deduped: LookupResult[] = [];

  for (const result of results) {
    const key = normalizePdfUrl(result.pdfUrl);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(result);
  }

  return deduped;
}

export async function searchLookupPdfs(options: LookupSearchOptions): Promise<LookupSearchOutcome> {
  const query = options.query.trim();
  if (!query) {
    return { results: [] };
  }

  const perSourceLimit = options.limit ?? 15;

  const [archiveOutcome, gutenbergOutcome, webOutcome] = await Promise.allSettled([
    searchArchiveOrg(query, perSourceLimit),
    searchGutenberg(query, perSourceLimit),
    searchWebPdfs(query, perSourceLimit),
  ]);

  const merged: LookupResult[] = [];

  if (archiveOutcome.status === 'fulfilled') {
    merged.push(...archiveOutcome.value);
  }

  if (gutenbergOutcome.status === 'fulfilled') {
    merged.push(...gutenbergOutcome.value);
  }

  if (webOutcome.status === 'fulfilled') {
    merged.push(...webOutcome.value.results);
  }

  const deduped = dedupeResults(merged).slice(0, MAX_RESULTS);

  const webUnavailable =
    webOutcome.status === 'fulfilled'
      ? webOutcome.value.unavailable
      : webOutcome.status === 'rejected';

  const webMessage =
    webOutcome.status === 'fulfilled'
      ? webOutcome.value.message
      : 'Web search is unavailable right now. Archival sources may still have results.';

  return {
    results: deduped,
    webSearchUnavailable: webUnavailable,
    webSearchMessage: webUnavailable ? webMessage : undefined,
  };
}

export type { LookupResult, LookupSource } from './types';
