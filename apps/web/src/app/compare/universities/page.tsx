import { CompareView } from "@/components/phase1/CompareView";
import type { AnyRecord } from "@/components/phase1/PhaseOneViews";
import { phaseCompare, phaseComparisonOptions } from "@/lib/phase1";
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
  let options: { slug: string; name: string }[] = [];
  try {
    [result, options] = await Promise.all([
      phaseCompare<Comparison>("universities", items),
      phaseComparisonOptions<{ slug: string; name: string }>("universities"),
    ]);
  } catch {}
  return <CompareView type="universities" result={result} items={items} options={options} />;
}
