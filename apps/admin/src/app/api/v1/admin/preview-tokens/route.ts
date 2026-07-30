import type { NextRequest } from "next/server";
import { proxySimpleAdmin } from "@/lib/server/simple-admin-proxy";

/** Issues a short-lived, page-scoped draft-preview token. The proxy already
 * rejects anything without a Bearer session, so an unauthenticated caller
 * never reaches the API. */
export async function POST(request: NextRequest) {
  return proxySimpleAdmin(request, "POST", "preview-tokens");
}
