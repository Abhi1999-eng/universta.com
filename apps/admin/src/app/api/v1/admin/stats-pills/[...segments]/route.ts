import type { NextRequest } from "next/server";
import { proxySimpleAdmin } from "@/lib/server/simple-admin-proxy";

type Context = { params: Promise<{ segments: string[] }> };
async function path(context: Context) {
  return `stats-pills/${(await context.params).segments.map(encodeURIComponent).join("/")}`;
}

export async function GET(request: NextRequest, context: Context) {
  return proxySimpleAdmin(request, "GET", await path(context));
}
export async function PUT(request: NextRequest, context: Context) {
  return proxySimpleAdmin(request, "PUT", await path(context));
}
export async function POST(request: NextRequest, context: Context) {
  return proxySimpleAdmin(request, "POST", await path(context));
}
