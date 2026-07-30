import type { NextRequest } from "next/server";
import { proxySimpleAdmin } from "@/lib/server/simple-admin-proxy";

type Context = { params: Promise<{ pageId: string }> };

export async function POST(request: NextRequest, context: Context) {
  const { pageId } = await context.params;
  return proxySimpleAdmin(request, "POST", "page-templates", `/assign/${encodeURIComponent(pageId)}`);
}
