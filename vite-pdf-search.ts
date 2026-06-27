import type { Connect, Plugin } from 'vite';

export const PDF_SEARCH_PATH = '/api/pdf-search';

type BraveWebResult = {
  title?: string;
  url?: string;
  description?: string;
};

type BraveSearchResponse = {
  web?: {
    results?: BraveWebResult[];
  };
};

type LookupResultPayload = {
  id: string;
  title: string;
  authors?: string[];
  snippet?: string;
  source: 'web';
  pdfUrl: string;
  detailUrl?: string;
};

function looksLikePdfUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return url.toLowerCase().includes('.pdf');
  }
}

function resultId(url: string): string {
  return `web:${url}`;
}

async function searchBrave(query: string, limit: number, apiKey: string): Promise<LookupResultPayload[]> {
  const params = new URLSearchParams({
    q: `${query} filetype:pdf`,
    count: String(Math.min(limit, 20)),
  });

  const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Brave Search API HTTP ${response.status}`);
  }

  const data = (await response.json()) as BraveSearchResponse;
  const webResults = data.web?.results ?? [];
  const results: LookupResultPayload[] = [];

  for (const item of webResults) {
    const url = item.url?.trim();
    if (!url || !looksLikePdfUrl(url)) continue;

    results.push({
      id: resultId(url),
      title: item.title?.trim() || url,
      snippet: item.description?.trim(),
      source: 'web',
      pdfUrl: url,
      detailUrl: url,
    });
  }

  return results;
}

function createSearchMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const requestUrl = req.url ?? '';
    if (!requestUrl.startsWith(PDF_SEARCH_PATH)) {
      next();
      return;
    }

    void (async () => {
      try {
        const parsed = new URL(requestUrl, 'http://127.0.0.1');
        const query = parsed.searchParams.get('q')?.trim() ?? '';
        const limit = Math.min(20, Math.max(1, Number(parsed.searchParams.get('limit') ?? '15') || 15));

        if (!query) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'Missing q parameter' }));
          return;
        }

        const apiKey = process.env.BRAVE_SEARCH_API_KEY?.trim();
        if (!apiKey) {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(
            JSON.stringify({
              results: [],
              unavailable: true,
              message: 'Web search is not configured (missing BRAVE_SEARCH_API_KEY).',
            }),
          );
          return;
        }

        const results = await searchBrave(query, limit, apiKey);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({ results }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Search failed';
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ results: [], unavailable: true, message }));
      }
    })();
  };
}

export function pdfSearchProxy(): Plugin {
  const middleware = createSearchMiddleware();
  return {
    name: 'pdf-search-proxy',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
