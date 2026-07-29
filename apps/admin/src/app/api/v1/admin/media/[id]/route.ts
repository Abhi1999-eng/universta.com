import type { NextRequest } from "next/server";
import { proxyMediaArchive, proxyMediaUpdate } from "@/lib/server/media-proxy";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  return proxyMediaUpdate(request, (await context.params).id);
}
export async function DELETE(request: NextRequest, context: Context) {
  return proxyMediaArchive(request, (await context.params).id);
}
