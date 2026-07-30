const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

function parseInternalLink(value: string): { entityType: string; entityId: string } | null {
  const match = /^internal:\/\/([a-z]+)\/([^/]+)$/.exec(value.trim());
  return match ? { entityType: match[1], entityId: match[2] } : null;
}

/** Resolves a `internal://type/id` reference (written by the admin
 * InternalLinkPicker) to the target's *current* canonical path, live, at
 * render time -- so the link stays correct after the target is renamed and
 * disappears automatically if the target is unpublished or deleted. A
 * plain path/anchor/external URL is returned unchanged. */
export async function resolveHref(value: string | undefined | null): Promise<string | null> {
  if (!value) return null;
  const parsed = parseInternalLink(value);
  if (!parsed) return value;
  try {
    const response = await fetch(
      new URL(
        `/api/v1/phase1/internal-links/resolve?entityType=${encodeURIComponent(parsed.entityType)}&entityId=${encodeURIComponent(parsed.entityId)}`,
        baseUrl,
      ),
      { cache: "no-store", headers: { accept: "application/json" } },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: { path?: string | null } };
    return body.data?.path ?? null;
  } catch {
    return null;
  }
}
