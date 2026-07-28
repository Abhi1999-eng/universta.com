import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

const RESOURCES = new Set([
  "universities",
  "offerings",
  "scholarships",
  "consultants",
  "jobs",
  "events",
  "success-stories",
  "testimonials",
  "pages",
  "navigation-menus",
  "contact-inquiries",
]);
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
function fail(
  status: number,
  requestId: string,
  code: string,
  message: string,
) {
  return NextResponse.json(envelope(requestId, null, { code, message }), {
    status,
    headers: { "cache-control": "no-store", "x-request-id": requestId },
  });
}

export async function proxyPhase1Admin(
  request: NextRequest,
  segments: string[],
) {
  const requestId =
    request.headers.get("x-request-id")?.slice(0, 100) || randomUUID();
  const authorization = request.headers.get("authorization");
  const [resource, , action] = segments;
  if (!authorization?.startsWith("Bearer "))
    return fail(
      401,
      requestId,
      "UNAUTHORIZED",
      "Your admin session is invalid",
    );
  const isFormOptions = segments.length === 1 && resource === "form-options";
  if (
    !resource ||
    segments.length > 3 ||
    (!isFormOptions && !RESOURCES.has(resource)) ||
    (action && !["publish", "unpublish", "convert"].includes(action))
  )
    return fail(404, requestId, "NOT_FOUND", "Admin resource not found");
  if (isFormOptions && request.method !== "GET")
    return fail(405, requestId, "METHOD_NOT_ALLOWED", "Method not allowed");
  if (action === "convert" && resource !== "contact-inquiries")
    return fail(404, requestId, "NOT_FOUND", "Admin resource not found");
  const method = request.method;
  if (!["GET", "POST", "PATCH", "DELETE"].includes(method))
    return fail(405, requestId, "METHOD_NOT_ALLOWED", "Method not allowed");
  const path = `/api/v1/admin/phase1/${segments.map(encodeURIComponent).join("/")}`;
  const url = new URL(
    path,
    process.env.API_BASE_URL ?? "http://127.0.0.1:4000",
  );
  if (method === "GET")
    for (const key of ["q", "status", "page", "limit"]) {
      const value = new URL(request.url).searchParams.get(key);
      if (value) url.searchParams.set(key, value);
    }
  let body: string | undefined;
  if (method !== "GET" && method !== "DELETE") {
    body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES)
      return fail(413, requestId, "REQUEST_TOO_LARGE", "Request is too large");
    try {
      JSON.parse(body || "{}");
    } catch {
      return fail(400, requestId, "VALIDATION_ERROR", "Invalid request body");
    }
  }
  try {
    const upstream = await fetch(url, {
      method,
      headers: {
        accept: "application/json",
        authorization,
        "x-request-id": requestId,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    const parsed = await upstream.json();
    return NextResponse.json(parsed, {
      status: upstream.status,
      headers: {
        "cache-control": "no-store",
        "x-request-id": upstream.headers.get("x-request-id") ?? requestId,
      },
    });
  } catch {
    return fail(
      502,
      requestId,
      "SERVICE_UNAVAILABLE",
      "Admin service is temporarily unavailable",
    );
  }
}
