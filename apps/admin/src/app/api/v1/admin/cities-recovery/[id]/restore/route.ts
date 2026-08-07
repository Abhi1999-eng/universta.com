import type { NextRequest } from "next/server";
import { proxySimpleAdmin } from "@/lib/server/simple-admin-proxy";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return proxySimpleAdmin(
    request,
    "POST",
    "cities-recovery",
    `/${encodeURIComponent(id)}/restore`,
  );
}
