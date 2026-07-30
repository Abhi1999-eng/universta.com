import {
  PhaseListing,
  type AnyRecord,
  type PageMeta,
} from "@/components/phase1/PhaseOneViews";
import { phaseList } from "@/lib/phase1";
import { staticPageMetadata } from "@/lib/static-page-seo";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return staticPageMetadata(
    "careers-listing",
    "Careers",
    "Explore currently published job openings at Universta.",
    "/careers",
  );
}

export default async function CareersPage() {
  let rows: AnyRecord[] = [];
  let meta: PageMeta | null = null;
  try {
    const result = await phaseList<AnyRecord>("jobs");
    rows = result.data;
    meta = result.meta as PageMeta;
  } catch {}
  return (
    <PhaseListing resource="jobs" rows={rows} meta={meta} search={false} />
  );
}
