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
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, index) => page(index + 2)),
  );
  return {
    data: [...first.data, ...rest.flatMap((result) => result.data)],
    meta: first.meta,
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
