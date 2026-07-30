import type { NextRequest } from "next/server";
import { proxyBulkUpload } from "@/lib/server/bulk-proxy";

type Context = { params: Promise<{ resource: string }> };

export async function POST(request: NextRequest, context: Context) {
  const { resource } = await context.params;
  return proxyBulkUpload(request, `/${encodeURIComponent(resource)}/import`);
}
