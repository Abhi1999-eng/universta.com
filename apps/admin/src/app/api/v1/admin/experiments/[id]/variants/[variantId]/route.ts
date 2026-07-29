import type { NextRequest } from "next/server";
import { proxyExperiments } from "@/lib/server/experiments-proxy";

type Context = { params: Promise<{ id: string; variantId: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const { id, variantId } = await context.params;
  return proxyExperiments(
    request,
    "PATCH",
    `/${encodeURIComponent(id)}/variants/${encodeURIComponent(variantId)}`,
  );
}
export async function DELETE(request: NextRequest, context: Context) {
  const { id, variantId } = await context.params;
  return proxyExperiments(
    request,
    "DELETE",
    `/${encodeURIComponent(id)}/variants/${encodeURIComponent(variantId)}`,
  );
}
