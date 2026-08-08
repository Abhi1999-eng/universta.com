import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024;
const MAX_BODY_BYTES = 64 * 1024;

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

function apiUrl(path: string, search?: URLSearchParams) {
  const url = new URL(
    `/api/v1/admin/bulk${path}`,
    process.env.API_BASE_URL ?? "http://127.0.0.1:4000",
  );
  if (search) for (const [key, value] of search) url.searchParams.set(key, value);
  return url;
}

function requireAuth(request: NextRequest, requestId: string) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return { authorization: null, error: fail(401, requestId, "UNAUTHORIZED", "Your admin session is invalid") };
  }
  return { authorization, error: null };
}

/** JSON GET/POST passthrough for /resources, /bulk-update, /bulk-archive. */
export async function proxyBulkJson(
  request: NextRequest,
  method: "GET" | "POST",
  path: string,
) {
  const requestId = request.headers.get("x-request-id")?.slice(0, 100) || randomUUID();
  const auth = requireAuth(request, requestId);
  if (auth.error) return auth.error;
  let body: string | undefined;
  const search = method === "GET" ? new URL(request.url).searchParams : undefined;
  if (method === "POST") {
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
  const upstream = await fetch(apiUrl(path, search), {
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
  const parsed = await upstream.json();
  return NextResponse.json(parsed, {
    status: upstream.status,
    headers: { "cache-control": "no-store", "x-request-id": upstream.headers.get("x-request-id") ?? requestId },
  });
}

/** Streams a binary file response (template/export downloads) straight
 * through, so the admin app's own origin serves the download without
 * exposing the real API origin to the browser. */
export async function proxyBulkFile(request: NextRequest, path: string) {
  const requestId = request.headers.get("x-request-id")?.slice(0, 100) || randomUUID();
  const auth = requireAuth(request, requestId);
  if (auth.error) return auth.error;
  const upstream = await fetch(apiUrl(path, new URL(request.url).searchParams), {
    headers: { authorization: auth.authorization!, "x-request-id": requestId },
    cache: "no-store",
  });
  if (!upstream.ok) {
    const parsed = await upstream.json().catch(() => null);
    return NextResponse.json(parsed ?? envelope(requestId, null, { code: "BULK_FILE_ERROR", message: "Unable to fetch file" }), {
      status: upstream.status,
    });
  }
  const buffer = await upstream.arrayBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "content-disposition": upstream.headers.get("content-disposition") ?? "attachment",
      "cache-control": "no-store",
    },
  });
}

/** Multipart passthrough for /dry-run and /import (real file uploads).
 * Buffering the already-size-capped body before forwarding avoids relying on
 * a live ReadableStream surviving the Next route-handler -> API fetch hop.
 * This is especially important in production where proxies/runtime adapters
 * may consume or close the incoming request stream before undici forwards it. */
export async function proxyBulkUpload(request: NextRequest, path: string) {
  const requestId = request.headers.get("x-request-id")?.slice(0, 100) || randomUUID();
  const auth = requireAuth(request, requestId);
  if (auth.error) return auth.error;
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data"))
    return fail(400, requestId, "VALIDATION_ERROR", "Expected a multipart/form-data upload");
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_UPLOAD_BYTES)
    return fail(413, requestId, "REQUEST_TOO_LARGE", "Upload is too large");

  const upload = await request.arrayBuffer();
  if (upload.byteLength > MAX_UPLOAD_BYTES)
    return fail(413, requestId, "REQUEST_TOO_LARGE", "Upload is too large");
  if (upload.byteLength === 0)
    return fail(400, requestId, "VALIDATION_ERROR", "Choose a CSV or XLSX file to upload");

  const upstream = await fetch(apiUrl(path), {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: auth.authorization!,
      "content-type": contentType,
      "content-length": String(upload.byteLength),
      "x-request-id": requestId,
    },
    body: upload,
    cache: "no-store",
  });
  const parsed = await upstream.json();
  return NextResponse.json(parsed, {
    status: upstream.status,
    headers: { "cache-control": "no-store", "x-request-id": upstream.headers.get("x-request-id") ?? requestId },
  });
}
