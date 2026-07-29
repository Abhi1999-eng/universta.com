import type { NextRequest } from "next/server";
import { proxyLocations } from "@/lib/server/locations-proxy";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return proxyLocations(request, "cities", "GET", `/${encodeURIComponent(id)}`);
}
export async function PATCH(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return proxyLocations(request, "cities", "PATCH", `/${encodeURIComponent(id)}`);
}
export async function DELETE(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return proxyLocations(request, "cities", "DELETE", `/${encodeURIComponent(id)}`);
}
