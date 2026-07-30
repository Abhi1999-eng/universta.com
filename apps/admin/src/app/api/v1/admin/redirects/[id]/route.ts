import type { NextRequest } from "next/server";
import { proxyRedirects } from "@/lib/server/redirects-proxy";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return proxyRedirects(request, "GET", `/${encodeURIComponent(id)}`);
}
export async function PATCH(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return proxyRedirects(request, "PATCH", `/${encodeURIComponent(id)}`);
}
export async function DELETE(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return proxyRedirects(request, "DELETE", `/${encodeURIComponent(id)}`);
}
