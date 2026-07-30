import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

const MAX_BODY_BYTES = 64 * 1024;

function envelope(
  requestId: string,
  data: unknown,
  error: { code: string; message: string } | null,
  meta: unknown = null,
) {
  return {
    data,
    meta,
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

async function forward(upstream: Response, requestId: string) {
  const parsed = await upstream.json();
  return NextResponse.json(parsed, {
    status: upstream.status,
    headers: {
      "cache-control": "no-store",
      "x-request-id": upstream.headers.get("x-request-id") ?? requestId,
    },
  });
}

/** Generic proxy for a flat admin CRUD-plus-action surface
 * (list/detail/create/update/archive[/seo]) -- mirrors the
 * States/Cities/Redirects proxy shape, parameterized by base path so new
 * simple resources (consultant locations, intakes, scholarship providers,
 * page templates) don't each need a bespoke proxy file. */
export async function proxySimpleAdmin(
  request: NextRequest,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  basePath: string,
  subPath = "",
) {
  const requestId = request.headers.get("x-request-id")?.slice(0, 100) || randomUUID();
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer "))
    return fail(401, requestId, "UNAUTHORIZED", "Your admin session is invalid");
  let body: string | undefined;
  const search = method === "GET" ? new URL(request.url).searchParams : undefined;
  if (method === "POST" || method === "PATCH" || method === "PUT") {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES)
      return fail(413, requestId, "REQUEST_TOO_LARGE", "Request is too large");
    try {
      JSON.parse(raw || "{}");
    } catch {
      return fail(400, requestId, "VALIDATION_ERROR", "Invalid request body");
    }
    body = raw || "{}";
  }
  const url = new URL(
    `/api/v1/admin/${basePath}${subPath}`,
    process.env.API_BASE_URL ?? "http://127.0.0.1:4000",
  );
  if (search) for (const [key, value] of search) url.searchParams.set(key, value);
  const upstream = await fetch(url, {
    method,
    headers: {
      accept: "application/json",
      authorization,
      "x-request-id": requestId,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body } : {}),
    cache: "no-store",
  });
  return forward(upstream, requestId);
}
