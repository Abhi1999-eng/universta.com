import type { NextRequest } from "next/server";
import { proxyRedirects } from "@/lib/server/redirects-proxy";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return proxyRedirects(request, "POST", `/${encodeURIComponent(id)}/disable`);
}
