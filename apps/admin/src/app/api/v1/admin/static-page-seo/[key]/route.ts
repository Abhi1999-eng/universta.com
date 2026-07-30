import type { NextRequest } from "next/server";
import { proxySimpleAdmin } from "@/lib/server/simple-admin-proxy";

type Context = { params: Promise<{ key: string }> };

export async function PUT(request: NextRequest, context: Context) {
  const { key } = await context.params;
  return proxySimpleAdmin(request, "PUT", "static-page-seo", `/${encodeURIComponent(key)}`);
}
