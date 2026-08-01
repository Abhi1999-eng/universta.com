import { permanentRedirect } from 'next/navigation';

/** The Countries listing now lives at "/" (the site's homepage). This route
 * is kept only so existing links and bookmarks to "/countries" still land on
 * the same content, at its new canonical address -- forwarding any filter
 * query string along with it. */
export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CountriesRedirect({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') query.set(key, value);
    else if (Array.isArray(value) && value[0]) query.set(key, value[0]);
  }
  const suffix = query.size ? `?${query.toString()}` : '';
  permanentRedirect(`/${suffix}`);
}
