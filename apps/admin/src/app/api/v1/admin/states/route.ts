import type { NextRequest } from "next/server";
import { proxyLocations } from "@/lib/server/locations-proxy";

export async function GET(request: NextRequest) {
  return proxyLocations(request, "states", "GET", "");
}
export async function POST(request: NextRequest) {
  return proxyLocations(request, "states", "POST", "");
}
