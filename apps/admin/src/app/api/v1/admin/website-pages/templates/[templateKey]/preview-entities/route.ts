import type { NextRequest } from "next/server";
import { proxySimpleAdmin } from "@/lib/server/simple-admin-proxy";

/** Real published entities a dynamic template can be previewed against. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateKey: string }> },
) {
  const { templateKey } = await params;
  return proxySimpleAdmin(
    request,
    "GET",
    "website-pages",
    `/templates/${encodeURIComponent(templateKey)}/preview-entities`,
  );
}
