import { headers } from "next/headers";
import { ReferenceAboutPage } from '@/components/templates/ReferenceStaticPages';
import type { AnyRecord } from "@/components/phase1/PhaseOneViews";
import { phasePage } from "@/lib/phase1";
import { staticPageMetadata } from "@/lib/static-page-seo";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return staticPageMetadata(
    "about",
    "About Universta",
    "A source-aware local study abroad information platform.",
    "/about",
  );
}

export default async function AboutPage() {
  let page: AnyRecord | null = null;
  try {
    const anonymousId = (await headers()).get("x-anon-id") ?? undefined;
    page = await phasePage<AnyRecord>("about", anonymousId);
  } catch {}
  return <ReferenceAboutPage page={page} />;
}
