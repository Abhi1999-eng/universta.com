import type { NextRequest } from "next/server";
import { proxyMediaList, proxyMediaUpload } from "@/lib/server/media-proxy";

export async function GET(request: NextRequest) {
  return proxyMediaList(request);
}
export async function POST(request: NextRequest) {
  return proxyMediaUpload(request);
}
