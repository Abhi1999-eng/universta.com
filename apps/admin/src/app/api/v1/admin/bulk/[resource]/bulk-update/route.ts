import type { NextRequest } from "next/server";
import { proxyBulkJson } from "@/lib/server/bulk-proxy";

type Context = { params: Promise<{ resource: string }> };

export async function POST(request: NextRequest, context: Context) {
  const { resource } = await context.params;
  return proxyBulkJson(request, "POST", `/${encodeURIComponent(resource)}/bulk-update`);
}
