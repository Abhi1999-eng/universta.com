import type { NextRequest } from "next/server";
import { proxyLocations } from "@/lib/server/locations-proxy";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return proxyLocations(request, "cities", "PUT", `/${encodeURIComponent(id)}/seo`);
}
