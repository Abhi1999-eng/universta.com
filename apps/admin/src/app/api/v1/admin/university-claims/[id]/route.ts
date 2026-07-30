import type { NextRequest } from "next/server";
import { proxyUniversityClaims } from "@/lib/server/university-claims-proxy";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return proxyUniversityClaims(request, "GET", `/${encodeURIComponent(id)}`);
}
export async function DELETE(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return proxyUniversityClaims(request, "DELETE", `/${encodeURIComponent(id)}`);
}
