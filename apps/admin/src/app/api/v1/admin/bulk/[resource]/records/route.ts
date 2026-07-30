import type { NextRequest } from "next/server";
import { proxyBulkJson } from "@/lib/server/bulk-proxy";

type Context = { params: Promise<{ resource: string }> };

export async function GET(request: NextRequest, context: Context) {
  const { resource } = await context.params;
  return proxyBulkJson(request, "GET", `/${encodeURIComponent(resource)}/records`);
}
