export type LookupSource = 'archive' | 'gutenberg' | 'web';

export type LookupResult = {
  id: string;
  title: string;
  authors?: string[];
  snippet?: string;
  source: LookupSource;
  pdfUrl: string;
  detailUrl?: string;
};

export type LookupSearchOptions = {
  query: string;
  limit?: number;
};

export type LookupSearchOutcome = {
  results: LookupResult[];
  webSearchUnavailable?: boolean;
  webSearchMessage?: string;
};
