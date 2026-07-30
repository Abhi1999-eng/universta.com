import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

function envelope(
  requestId: string,
  data: unknown,
  error: { code: string; message: string } | null,
) {
  return {
    data,
    meta: null,
    error: error ? { ...error, details: null } : null,
    requestId,
    timestamp: new Date().toISOString(),
  };
}
function fail(status: number, requestId: string, code: string, message: string) {
  return NextResponse.json(envelope(requestId, null, { code, message }), {
    status,
    headers: { "cache-control": "no-store", "x-request-id": requestId },
  });
}

/** Read-only GET proxy for the internal-link picker's search/resolve calls. */
export async function proxyInternalLinks(request: NextRequest, path: string) {
  const requestId = request.headers.get("x-request-id")?.slice(0, 100) || randomUUID();
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer "))
    return fail(401, requestId, "UNAUTHORIZED", "Your admin session is invalid");
  const url = new URL(
    `/api/v1/admin/internal-links${path}`,
    process.env.API_BASE_URL ?? "http://127.0.0.1:4000",
  );
  const search = new URL(request.url).searchParams;
  for (const [key, value] of search) url.searchParams.set(key, value);
  const upstream = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json", authorization, "x-request-id": requestId },
    cache: "no-store",
  });
  const parsed = await upstream.json();
  return NextResponse.json(parsed, {
    status: upstream.status,
    headers: {
      "cache-control": "no-store",
      "x-request-id": upstream.headers.get("x-request-id") ?? requestId,
    },
  });
}
