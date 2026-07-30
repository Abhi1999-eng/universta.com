import type { NextRequest } from "next/server";
import { proxyRedirects } from "@/lib/server/redirects-proxy";

export async function GET(request: NextRequest) {
  return proxyRedirects(request, "GET", "");
}
export async function POST(request: NextRequest) {
  return proxyRedirects(request, "POST", "");
}
