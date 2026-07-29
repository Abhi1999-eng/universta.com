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

function apiUrl(path: string) {
  return new URL(
    `/api/v1/admin/experiments${path}`,
    process.env.API_BASE_URL ?? "http://127.0.0.1:4000",
  );
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

function requireAuth(request: NextRequest, requestId: string) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return { authorization: null, error: fail(401, requestId, "UNAUTHORIZED", "Your admin session is invalid") };
  }
  return { authorization, error: null };
}

/** Generic JSON-in/JSON-out proxy for the admin experiments endpoints; every
 * operation here shares the same auth + body-size + forwarding shape, so a
 * single helper replaces what would otherwise be ~9 near-identical blocks. */
export async function proxyExperiments(
  request: NextRequest,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
) {
  const requestId = request.headers.get("x-request-id")?.slice(0, 100) || randomUUID();
  const auth = requireAuth(request, requestId);
  if (auth.error) return auth.error;
  let body: string | undefined;
  if (method === "POST" || method === "PATCH") {
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
  const upstream = await fetch(apiUrl(path), {
    method,
    headers: {
      accept: "application/json",
      authorization: auth.authorization!,
      "x-request-id": requestId,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body } : {}),
    cache: "no-store",
  });
  return forward(upstream, requestId);
}
