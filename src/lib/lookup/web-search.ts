import type { LookupResult } from './types';

const LOCAL_SEARCH_PATH = '/api/pdf-search';
const DEFAULT_REMOTE_SEARCH_URL = 'https://deac.online/api/pdf-search';

type WebSearchResponse = {
  results?: LookupResult[];
  unavailable?: boolean;
  message?: string;
};

function searchEndpoint(): string {
  const configured = import.meta.env.VITE_PDF_SEARCH_URL?.trim();
  if (configured) return configured;
  if (import.meta.env.DEV) return LOCAL_SEARCH_PATH;
  return DEFAULT_REMOTE_SEARCH_URL;
}

export async function searchWebPdfs(
  query: string,
  limit = 15,
): Promise<{ results: LookupResult[]; unavailable?: boolean; message?: string }> {
  const trimmed = query.trim();
  if (!trimmed) return { results: [] };

  const params = new URLSearchParams({
    q: trimmed,
    limit: String(limit),
  });

  let response: Response;
  try {
    response = await fetch(`${searchEndpoint()}?${params}`);
  } catch {
    return {
      results: [],
      unavailable: true,
      message: 'Web search is unavailable right now. Archival sources may still have results.',
    };
  }

  if (response.status === 503) {
    const data = (await response.json().catch(() => ({}))) as WebSearchResponse;
    return {
      results: [],
      unavailable: true,
      message:
        data.message ??
        'Web search is not configured. Archival sources may still have results.',
    };
  }

  if (!response.ok) {
    return {
      results: [],
      unavailable: true,
      message: `Web search failed (HTTP ${response.status})`,
    };
  }

  const data = (await response.json()) as WebSearchResponse;
  return {
    results: data.results ?? [],
    unavailable: data.unavailable,
    message: data.message,
  };
}
