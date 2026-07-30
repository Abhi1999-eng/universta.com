import type { NextRequest } from "next/server";
import { proxySimpleAdmin } from "@/lib/server/simple-admin-proxy";

export async function GET(request: NextRequest) {
  return proxySimpleAdmin(request, "GET", "page-templates");
}
export async function POST(request: NextRequest) {
  return proxySimpleAdmin(request, "POST", "page-templates");
}
