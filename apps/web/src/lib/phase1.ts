export type Envelope<T> = {
  data: T | null;
  meta: unknown;
  error: { code: string; message: string } | null;
};
const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

async function request<T>(
  path: string,
  headers: Record<string, string> = {},
): Promise<{ data: T; meta: unknown }> {
  const response = await fetch(new URL(`/api/v1/phase1${path}`, baseUrl), {
    cache: "no-store",
    headers: { accept: "application/json", ...headers },
  });
  const body = (await response.json()) as Envelope<T>;
  if (!response.ok || body.error || body.data === null)
    throw new Error(body.error?.message ?? "Phase 1 service unavailable");
  return { data: body.data, meta: body.meta };
}

export function phaseList<T>(
  resource: string,
  params: Record<string, string> = {},
) {
  const q = new URLSearchParams(params).toString();
  return request<T[]>(`/${resource}${q ? `?${q}` : ""}`);
}
/* The phase-1 list endpoints cap a page at 50 rows. */
const PHASE_PAGE_SIZE = 50;
const PHASE_MAX_PAGES = 40;
/* How many of those pages are in flight together. The API sheds load above
   roughly a dozen concurrent reads and answers 503. */
const PHASE_CONCURRENCY = 5;

/** One retry, because the failure this guards against is load, not a bad
 *  request: the same page asked for a moment later usually answers. */
async function withRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return run();
  }
}

/**
 * Every record a phase-1 list holds, read page by page.
 *
 * For the callers that mean "all" -- an A-Z index, a filter's options, the
 * sitemap. They asked for `limit: 100`, the API capped it at 50, and once the
 * catalogue held more than fifty universities the index, the per-destination
 * counts and the sitemap all silently stopped at the fiftieth.
 */
export async function phaseListAll<T>(
  resource: string,
  params: Record<string, string> = {},
) {
  const page = (n: number) =>
    phaseList<T>(resource, {
      ...params,
      limit: String(PHASE_PAGE_SIZE),
      page: String(n),
    });
  const first = await page(1);
  const totalPages = Number(
    (first.meta as { totalPages?: unknown } | null)?.totalPages,
  );
  const pages = Math.min(
    Number.isFinite(totalPages) && totalPages > 1 ? totalPages : 1,
    PHASE_MAX_PAGES,
  );
  /* In batches, not all at once.
     This used to fire every remaining page in one `Promise.all`. While the
     universities listing was capped at 500 rows that was nine requests and
     nobody noticed. The moment the API started reporting its real page
     count -- 3,254 for 9,761 universities -- it became thirty-nine at once,
     and fourteen of them came back 503. One rejection failed the whole
     call, the page caught it, and a catalogue of 9,761 universities
     rendered as "No university is published yet".

     Five at a time is slower and finishes. */
  const rest: Array<{ data: T[]; meta: unknown }> = [];
  for (let from = 2; from <= pages; from += PHASE_CONCURRENCY) {
    const batch = Array.from(
      { length: Math.min(PHASE_CONCURRENCY, pages - from + 1) },
      (_, index) => withRetry(() => page(from + index)),
    );
    rest.push(...(await Promise.all(batch)));
  }
  const data = [...first.data, ...rest.flatMap((result) => result.data)];
  const total = Number((first.meta as { total?: unknown } | null)?.total);
  return {
    data,
    meta: first.meta,
    /* What the caller actually got against what exists, so a screen can say
       "2,000 of 9,761" rather than presenting the cap as the whole. */
    truncated: Number.isFinite(total) && total > data.length
      ? { shown: data.length, total }
      : null,
  };
}
export function phaseDetail<T>(resource: string, slug: string) {
  return request<T>(`/${resource}/${encodeURIComponent(slug)}`).then(
    (result) => result.data,
  );
}
export function phasePage<T>(slug: string, anonymousId?: string) {
  return request<T>(
    `/pages/${encodeURIComponent(slug)}`,
    anonymousId ? { "x-anon-id": anonymousId } : {},
  ).then((result) => result.data);
}
export function phaseUniversityCourses<T>(
  slug: string,
  offering?: string,
  params: Record<string, string> = {},
) {
  const q = new URLSearchParams(params).toString();
  const suffix = offering
    ? `/courses/${encodeURIComponent(offering)}`
    : "/courses";
  return request<T>(
    `/universities/${encodeURIComponent(slug)}${suffix}${q ? `?${q}` : ""}`,
  ).then((result) => result.data);
}
export function phaseLocation<T>(slug: string) {
  return request<T>(`/consultant-locations/${encodeURIComponent(slug)}`).then(
    (result) => result.data,
  );
}
export function phaseCompare<T>(type: string, items: string[]) {
  return request<T>(
    `/compare/${encodeURIComponent(type)}?items=${encodeURIComponent(items.join(","))}`,
  ).then((result) => result.data);
}
export function phaseComparisonOptions<T>(type: string) {
  return request<T[]>(`/compare/${encodeURIComponent(type)}/options`).then(
    (result) => result.data,
  );
}

export type RedirectMatch = { targetPath: string; httpStatusCode: number };
/** Unlike `request`, tolerates a null result — most paths have no redirect. */
export async function phaseResolveRedirect(
  path: string,
): Promise<RedirectMatch | null> {
  try {
    const response = await fetch(
      new URL(
        `/api/v1/phase1/redirects?path=${encodeURIComponent(path)}`,
        baseUrl,
      ),
      { cache: "no-store", headers: { accept: "application/json" } },
    );
    const body = (await response.json()) as Envelope<RedirectMatch>;
    return response.ok ? body.data : null;
  } catch {
    return null;
  }
}
