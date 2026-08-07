import type { NextRequest } from "next/server";
import { proxySimpleAdmin } from "@/lib/server/simple-admin-proxy";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return proxySimpleAdmin(request, "PATCH", "cities-recovery", `/${encodeURIComponent(id)}`);
}

export async function DELETE(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return proxySimpleAdmin(request, "DELETE", "cities-recovery", `/${encodeURIComponent(id)}`);
}
