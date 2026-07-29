import type { NextRequest } from "next/server";
import { proxyExperiments } from "@/lib/server/experiments-proxy";

type Context = { params: Promise<{ id: string; variantId: string }> };

export async function GET(request: NextRequest, context: Context) {
  const { id, variantId } = await context.params;
  return proxyExperiments(
    request,
    "GET",
    `/${encodeURIComponent(id)}/variants/${encodeURIComponent(variantId)}/preview`,
  );
}
