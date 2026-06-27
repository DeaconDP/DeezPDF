import type { LookupResult } from './types';

type GutendexAuthor = { name?: string };

type GutendexBook = {
  id?: number;
  title?: string;
  authors?: GutendexAuthor[];
  formats?: Record<string, string>;
  subjects?: string[];
};

type GutendexResponse = {
  results?: GutendexBook[];
};

function resultId(bookId: number, pdfUrl: string): string {
  return `gutenberg:${bookId}:${pdfUrl}`;
}

export async function searchGutenberg(query: string, limit = 15): Promise<LookupResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const params = new URLSearchParams({
    search: trimmed,
  });

  const response = await fetch(`https://gutendex.com/books/?${params}`);
  if (!response.ok) {
    throw new Error(`Gutenberg search failed (HTTP ${response.status})`);
  }

  const data = (await response.json()) as GutendexResponse;
  const books = (data.results ?? []).slice(0, limit);
  const results: LookupResult[] = [];

  for (const book of books) {
    const pdfUrl = book.formats?.['application/pdf'];
    if (!pdfUrl || !book.id) continue;

    const authors = book.authors?.map((a) => a.name).filter(Boolean) as string[] | undefined;
    const subjects = book.subjects?.slice(0, 2).join(', ');

    results.push({
      id: resultId(book.id, pdfUrl),
      title: book.title ?? `Gutenberg #${book.id}`,
      authors: authors?.length ? authors : undefined,
      snippet: subjects || undefined,
      source: 'gutenberg',
      pdfUrl,
      detailUrl: `https://www.gutenberg.org/ebooks/${book.id}`,
    });
  }

  return results;
}
