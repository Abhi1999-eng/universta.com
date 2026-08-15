import { NextResponse, type NextRequest } from "next/server";

type Context = { params: Promise<{ path: string[] }> };

async function forward(request: NextRequest, context: Context) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer "))
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Your admin session is invalid",
        },
      },
      { status: 401 },
    );
  const path = (await context.params).path.map(encodeURIComponent).join("/");
  const target = new URL(
    `/api/v1/admin/student-operations/${path}`,
    process.env.API_BASE_URL ?? "http://127.0.0.1:4000",
  );
  const contentType = request.headers.get("content-type");
  const body = ["GET", "DELETE"].includes(request.method)
    ? undefined
    : await request.arrayBuffer();
  const upstream = await fetch(target, {
    method: request.method,
    headers: {
      accept: "application/json",
      authorization,
      ...(contentType ? { "content-type": contentType } : {}),
    },
    body: body && body.byteLength ? body : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  return new NextResponse(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
    },
  });
}

export async function GET(request: NextRequest, context: Context) {
  return forward(request, context);
}
export async function PATCH(request: NextRequest, context: Context) {
  return forward(request, context);
}
