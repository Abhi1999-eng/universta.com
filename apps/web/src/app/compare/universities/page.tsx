import { CompareView } from "@/components/phase1/CompareView";
import type { AnyRecord } from "@/components/phase1/PhaseOneViews";
import { phaseCompare } from "@/lib/phase1";
import { staticPageMetadata } from "@/lib/static-page-seo";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return staticPageMetadata(
    "compare-universities",
    "Compare universities",
    "Compare published university tuition, campuses and course offerings side by side.",
    "/compare/universities",
    false,
  );
}
type Comparison = { items: AnyRecord[]; invalid: string[] };

export default async function CompareUniversities({
  searchParams,
}: {
  searchParams: Promise<{ items?: string }>;
}) {
  const items = ((await searchParams).items ?? "")
    .split(",")
    .filter(Boolean)
    .slice(0, 3);
  let result: Comparison = { items: [], invalid: [] };
  try {
    result = await phaseCompare<Comparison>("universities", items);
  } catch {}
  return <CompareView type="universities" result={result} items={items} />;
}
