import type { NextRequest } from "next/server";
import { proxyUniversityClaims } from "@/lib/server/university-claims-proxy";

export async function GET(request: NextRequest) {
  return proxyUniversityClaims(request, "GET", "");
}
