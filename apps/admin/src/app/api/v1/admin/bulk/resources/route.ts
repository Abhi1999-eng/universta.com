import type { NextRequest } from "next/server";
import { proxyBulkJson } from "@/lib/server/bulk-proxy";

export async function GET(request: NextRequest) {
  return proxyBulkJson(request, "GET", "/resources");
}
