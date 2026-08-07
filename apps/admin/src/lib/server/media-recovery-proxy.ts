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

function apiUrl(path: string) {
  return new URL(
    `/api/v1/admin/media-recovery${path}`,
    process.env.API_BASE_URL ?? "http://127.0.0.1:4000",
  );
}

function requireAuth(request: NextRequest, requestId: string) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return {
      authorization: null,
      error: fail(401, requestId, "UNAUTHORIZED", "Your admin session is invalid"),
    };
  }
  return { authorization, error: null };
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

export async function proxyArchivedMediaList(request: NextRequest) {
  const requestId = request.headers.get("x-request-id")?.slice(0, 100) || randomUUID();
  const auth = requireAuth(request, requestId);
  if (auth.error) return auth.error;

  const url = apiUrl("");
  for (const [key, value] of new URL(request.url).searchParams) {
    if (["q", "folder"].includes(key)) url.searchParams.set(key, value);
  }

  const upstream = await fetch(url, {
    headers: {
      accept: "application/json",
      authorization: auth.authorization!,
      "x-request-id": requestId,
    },
    cache: "no-store",
  });
  return forward(upstream, requestId);
}

export async function proxyArchivedMediaDelete(request: NextRequest, id: string) {
  const requestId = request.headers.get("x-request-id")?.slice(0, 100) || randomUUID();
  const auth = requireAuth(request, requestId);
  if (auth.error) return auth.error;

  const upstream = await fetch(apiUrl(`/${encodeURIComponent(id)}`), {
    method: "DELETE",
    headers: {
      accept: "application/json",
      authorization: auth.authorization!,
      "x-request-id": requestId,
    },
    cache: "no-store",
  });
  return forward(upstream, requestId);
}
