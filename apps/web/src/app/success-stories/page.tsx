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
    "success-stories-listing",
    "Success stories",
    "Explore currently published Universta student success stories.",
    "/success-stories",
  );
}

export default async function StoriesPage() {
  let rows: AnyRecord[] = [];
  let meta: PageMeta | null = null;
  try {
    const result = await phaseList<AnyRecord>("success-stories");
    rows = result.data;
    meta = result.meta as PageMeta;
  } catch {}
  return (
    <PhaseListing
      resource="success-stories"
      rows={rows}
      meta={meta}
      search={false}
    />
  );
}
