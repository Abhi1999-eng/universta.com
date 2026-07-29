import type { NextRequest } from "next/server";
import { proxyExperiments } from "@/lib/server/experiments-proxy";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return proxyExperiments(request, "GET", `/${encodeURIComponent(id)}`);
}
export async function PATCH(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return proxyExperiments(request, "PATCH", `/${encodeURIComponent(id)}`);
}
export async function DELETE(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return proxyExperiments(request, "DELETE", `/${encodeURIComponent(id)}`);
}
