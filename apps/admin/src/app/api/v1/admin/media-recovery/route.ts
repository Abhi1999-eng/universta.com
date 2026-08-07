import type { NextRequest } from "next/server";
import { proxyArchivedMediaList } from "@/lib/server/media-recovery-proxy";

export async function GET(request: NextRequest) {
  return proxyArchivedMediaList(request);
}
