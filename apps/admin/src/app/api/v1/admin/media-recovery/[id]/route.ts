import type { NextRequest } from "next/server";
import { proxyArchivedMediaDelete } from "@/lib/server/media-recovery-proxy";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: Context) {
  return proxyArchivedMediaDelete(request, (await context.params).id);
}
