import type { NextRequest } from "next/server";
import { proxySimpleAdmin } from "@/lib/server/simple-admin-proxy";

type Context = { params: Promise<{ group: string }> };

export async function PUT(request: NextRequest, context: Context) {
  const { group } = await context.params;
  return proxySimpleAdmin(request, "PUT", "settings", `/${encodeURIComponent(group)}`);
}
