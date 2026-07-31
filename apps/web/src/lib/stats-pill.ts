export type ResolvedStatsPill = {
  visible: true;
  variant: "pill" | "badge";
  icon: { visible: boolean; name: "dot" | "globe" | "book" };
  items: Array<{
    id: string;
    label: string;
    value: number;
    displayOrder: number;
  }>;
};

const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

export async function getStatsPill(
  pageSlug: string,
): Promise<ResolvedStatsPill | null> {
  try {
    const response = await fetch(
      new URL(
        `/api/v1/phase1/stats-pills/${encodeURIComponent(pageSlug)}`,
        baseUrl,
      ),
      { cache: "no-store", headers: { accept: "application/json" } },
    );
    const body = (await response.json()) as {
      data: ResolvedStatsPill | null;
      error: { message?: string } | null;
    };
    return response.ok && !body.error ? body.data : null;
  } catch {
    return null;
  }
}
