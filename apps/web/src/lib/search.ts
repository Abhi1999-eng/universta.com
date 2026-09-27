const baseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000';

export type SearchItem = {
  id: string;
  label: string;
  href: string;
  meta: string | null;
  iso2Code?: string | null;
};

export type SearchGroup = {
  type: string;
  label: string;
  href: string;
  items: SearchItem[];
};

export type SearchResults = {
  query: string;
  total: number;
  groups: SearchGroup[];
};

const EMPTY: SearchResults = { query: '', total: 0, groups: [] };

/**
 * The results page's own fetch, asking for more per heading than the
 * dropdown shows. A search that cannot be run is an empty page with the box
 * still on it rather than an error: the reader can retype.
 */
export async function searchCatalogue(
  query: string,
  limit = 12,
): Promise<SearchResults> {
  const q = query.trim();
  if (!q) return { ...EMPTY, query: q };
  const url = new URL('/api/v1/phase1/search', baseUrl);
  url.searchParams.set('q', q);
  url.searchParams.set('limit', String(limit));
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return { ...EMPTY, query: q };
    const body = (await response.json()) as { data?: SearchResults };
    return body.data ?? { ...EMPTY, query: q };
  } catch {
    return { ...EMPTY, query: q };
  }
}
