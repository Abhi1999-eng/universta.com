import {
  SuccessStoriesListing,
  type SuccessStoryRow,
} from "@/components/phase1/SuccessStoryViews";
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
  let rows: SuccessStoryRow[] = [];
  let total = 0;
  try {
    const result = await phaseList<SuccessStoryRow>("success-stories");
    rows = result.data;
    total = (result.meta as { total?: number } | null)?.total ?? rows.length;
  } catch {}
  return <SuccessStoriesListing stories={rows} total={total} />;
}
