import { NextResponse, type NextRequest } from "next/server";

type Context = { params: Promise<{ filename: string }> };

/** Streams a media file through to the browser so <img> tags in the admin
 * app can use a same-origin relative src, without exposing the API's own
 * origin/port to the client bundle. */
export async function GET(_request: NextRequest, context: Context) {
  const { filename } = await context.params;
  const upstream = await fetch(
    new URL(
      `/api/v1/media/${encodeURIComponent(filename)}`,
      process.env.API_BASE_URL ?? "http://127.0.0.1:4000",
    ),
    { cache: "no-store" },
  );
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { data: null, error: { code: "NOT_FOUND", message: "Media file not found" } },
      { status: upstream.status || 404 },
    );
  }
  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
