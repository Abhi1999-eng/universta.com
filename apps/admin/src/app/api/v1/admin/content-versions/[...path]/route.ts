import type { NextRequest } from "next/server";
import { proxySimpleAdmin } from "@/lib/server/simple-admin-proxy";

/** Catch-all so the whole version-history surface -- list, compare and
 * restore -- goes through one proxy rather than three near-identical files.
 * The API validates the resource type and version numbers; this only forwards. */

function subPath(request: NextRequest) {
  const path = new URL(request.url).pathname.replace(
    "/api/v1/admin/content-versions",
    "",
  );
  return path;
}

export async function GET(request: NextRequest) {
  return proxySimpleAdmin(request, "GET", "content-versions", subPath(request));
}

export async function POST(request: NextRequest) {
  return proxySimpleAdmin(request, "POST", "content-versions", subPath(request));
}
