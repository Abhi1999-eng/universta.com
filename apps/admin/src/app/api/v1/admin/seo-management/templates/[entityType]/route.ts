import type { NextRequest } from "next/server";
import { proxySimpleAdmin } from "@/lib/server/simple-admin-proxy";

type Context = { params: Promise<{ entityType: string }> };

export async function PUT(request: NextRequest, context: Context) {
  const { entityType } = await context.params;
  return proxySimpleAdmin(
    request,
    "PUT",
    "seo-management/templates",
    `/${encodeURIComponent(entityType)}`,
  );
}
