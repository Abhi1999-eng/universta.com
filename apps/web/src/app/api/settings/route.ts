import { NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

/** Same-origin proxy so client components (the Header/Footer, which render
 * on every page) can read platform Settings without needing a
 * NEXT_PUBLIC_-exposed API URL baked into the browser bundle. */
export async function GET() {
  try {
    const upstream = await fetch(`${API_BASE_URL}/api/v1/phase1/settings`, {
      cache: "no-store",
    });
    const body = await upstream.json();
    return NextResponse.json(body, {
      status: upstream.status,
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { data: null, error: { code: "UPSTREAM_UNAVAILABLE", message: "Settings are temporarily unavailable" } },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}
