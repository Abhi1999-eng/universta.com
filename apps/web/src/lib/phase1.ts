export type Envelope<T> = {
  data: T | null;
  meta: unknown;
  error: { code: string; message: string } | null;
};
const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

async function request<T>(path: string): Promise<{ data: T; meta: unknown }> {
  const response = await fetch(new URL(`/api/v1/phase1${path}`, baseUrl), {
    cache: "no-store",
    headers: { accept: "application/json" },
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
export function phaseDetail<T>(resource: string, slug: string) {
  return request<T>(`/${resource}/${encodeURIComponent(slug)}`).then(
    (result) => result.data,
  );
}
export function phasePage<T>(slug: string) {
  return request<T>(`/pages/${encodeURIComponent(slug)}`).then(
    (result) => result.data,
  );
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
