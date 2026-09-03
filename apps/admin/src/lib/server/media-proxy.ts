import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

// A little above the API's own 5MB file cap, to allow for multipart
// boundary/field overhead without silently truncating a borderline upload.
const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

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
    `/api/v1/admin/media${path}`,
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

export async function proxyMediaList(request: NextRequest) {
  const requestId = request.headers.get("x-request-id")?.slice(0, 100) || randomUUID();
  const auth = requireAuth(request, requestId);
  if (auth.error) return auth.error;
  const url = apiUrl("");
  for (const [key, value] of new URL(request.url).searchParams) {
    if (["q", "folder", "page", "limit", "kind"].includes(key)) url.searchParams.set(key, value);
  }
  const upstream = await fetch(url, {
    headers: { accept: "application/json", authorization: auth.authorization!, "x-request-id": requestId },
    cache: "no-store",
  });
  return forward(upstream, requestId);
}

export async function proxyMediaUpload(request: NextRequest) {
  const requestId = request.headers.get("x-request-id")?.slice(0, 100) || randomUUID();
  const auth = requireAuth(request, requestId);
  if (auth.error) return auth.error;
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data"))
    return fail(400, requestId, "VALIDATION_ERROR", "Expected a multipart/form-data upload");
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_UPLOAD_BYTES)
    return fail(413, requestId, "REQUEST_TOO_LARGE", "Upload is too large");
  const upstream = await fetch(apiUrl(""), {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: auth.authorization!,
      "content-type": contentType,
      "x-request-id": requestId,
    },
    body: request.body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  return forward(upstream, requestId);
}

export async function proxyMediaUpdate(request: NextRequest, id: string) {
  const requestId = request.headers.get("x-request-id")?.slice(0, 100) || randomUUID();
  const auth = requireAuth(request, requestId);
  if (auth.error) return auth.error;
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 64 * 1024)
    return fail(413, requestId, "REQUEST_TOO_LARGE", "Request is too large");
  try {
    JSON.parse(raw || "{}");
  } catch {
    return fail(400, requestId, "VALIDATION_ERROR", "Invalid request body");
  }
  const upstream = await fetch(apiUrl(`/${encodeURIComponent(id)}`), {
    method: "PATCH",
    headers: {
      accept: "application/json",
      authorization: auth.authorization!,
      "content-type": "application/json",
      "x-request-id": requestId,
    },
    body: raw,
    cache: "no-store",
  });
  return forward(upstream, requestId);
}

export async function proxyMediaArchive(request: NextRequest, id: string) {
  const requestId = request.headers.get("x-request-id")?.slice(0, 100) || randomUUID();
  const auth = requireAuth(request, requestId);
  if (auth.error) return auth.error;
  const upstream = await fetch(apiUrl(`/${encodeURIComponent(id)}`), {
    method: "DELETE",
    headers: { accept: "application/json", authorization: auth.authorization!, "x-request-id": requestId },
    cache: "no-store",
  });
  return forward(upstream, requestId);
}
