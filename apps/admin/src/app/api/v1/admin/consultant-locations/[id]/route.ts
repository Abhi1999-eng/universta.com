import type { NextRequest } from "next/server";
import { proxySimpleAdmin } from "@/lib/server/simple-admin-proxy";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return proxySimpleAdmin(request, "GET", "consultant-locations", `/${encodeURIComponent(id)}`);
}
export async function PATCH(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return proxySimpleAdmin(request, "PATCH", "consultant-locations", `/${encodeURIComponent(id)}`);
}
export async function DELETE(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return proxySimpleAdmin(request, "DELETE", "consultant-locations", `/${encodeURIComponent(id)}`);
}
