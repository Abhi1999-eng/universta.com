import type { NextRequest } from "next/server";
import { proxyExperiments } from "@/lib/server/experiments-proxy";

export async function GET(request: NextRequest) {
  return proxyExperiments(request, "GET", "");
}
export async function POST(request: NextRequest) {
  return proxyExperiments(request, "POST", "");
}
