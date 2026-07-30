import type { NextRequest } from "next/server";
import { proxyUniversityClaims } from "@/lib/server/university-claims-proxy";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return proxyUniversityClaims(request, "PATCH", `/${encodeURIComponent(id)}/status`);
}
