import type { NextRequest } from "next/server";
import { proxyInternalLinks } from "@/lib/server/internal-links-proxy";

export async function GET(request: NextRequest) {
  return proxyInternalLinks(request, "/resolve");
}
