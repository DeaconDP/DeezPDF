import type { LookupResult } from './types';

type ArchiveSearchResponse = {
  response?: {
    docs?: Array<{
      identifier?: string;
      title?: string | string[];
      creator?: string | string[];
      description?: string | string[];
    }>;
  };
};

type ArchiveMetadataResponse = {
  metadata?: { identifier?: string; title?: string };
  files?: Array<{ name?: string; format?: string; size?: string }>;
};

function asString(value: string | string[] | undefined): string {
  if (!value) return '';
  return Array.isArray(value) ? value.join(', ') : value;
}

function resultId(identifier: string, pdfFile: string): string {
  return `archive:${identifier}:${pdfFile}`;
}

async function resolvePdfUrl(identifier: string): Promise<{ pdfUrl: string; filename: string } | null> {
  const response = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`);
  if (!response.ok) return null;

  const data = (await response.json()) as ArchiveMetadataResponse;
  const pdfFiles = (data.files ?? [])
    .filter((file) => file.name?.toLowerCase().endsWith('.pdf'))
    .sort((a, b) => Number(b.size ?? 0) - Number(a.size ?? 0));

  const best = pdfFiles[0];
  if (!best?.name) return null;

  return {
    pdfUrl: `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(best.name)}`,
    filename: best.name,
  };
}

export async function searchArchiveOrg(query: string, limit = 15): Promise<LookupResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const searchQuery = `(title:(${trimmed}) OR creator:(${trimmed})) AND mediatype:texts`;
  const params = new URLSearchParams({
    q: searchQuery,
    fl: 'identifier,title,creator,description',
    rows: String(limit),
    output: 'json',
  });

  const response = await fetch(`https://archive.org/advancedsearch.php?${params}`);
  if (!response.ok) {
    throw new Error(`Internet Archive search failed (HTTP ${response.status})`);
  }

  const data = (await response.json()) as ArchiveSearchResponse;
  const docs = data.response?.docs ?? [];
  const results: LookupResult[] = [];

  for (const doc of docs) {
    const identifier = doc.identifier?.trim();
    if (!identifier) continue;

    const resolved = await resolvePdfUrl(identifier);
    if (!resolved) continue;

    const title = asString(doc.title) || identifier;
    const creator = asString(doc.creator);
    const description = asString(doc.description);

    results.push({
      id: resultId(identifier, resolved.filename),
      title,
      authors: creator ? [creator] : undefined,
      snippet: description ? description.slice(0, 200) : undefined,
      source: 'archive',
      pdfUrl: resolved.pdfUrl,
      detailUrl: `https://archive.org/details/${encodeURIComponent(identifier)}`,
    });
  }

  return results;
}
