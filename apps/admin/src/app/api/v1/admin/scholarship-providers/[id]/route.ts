import type { NextRequest } from "next/server";
import { proxySimpleAdmin } from "@/lib/server/simple-admin-proxy";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return proxySimpleAdmin(request, "GET", "scholarship-providers", `/${encodeURIComponent(id)}`);
}
export async function PATCH(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return proxySimpleAdmin(request, "PATCH", "scholarship-providers", `/${encodeURIComponent(id)}`);
}
export async function DELETE(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return proxySimpleAdmin(request, "DELETE", "scholarship-providers", `/${encodeURIComponent(id)}`);
}
