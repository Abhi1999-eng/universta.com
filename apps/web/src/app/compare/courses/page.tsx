import { CompareView } from "@/components/phase1/CompareView";
import type { AnyRecord } from "@/components/phase1/PhaseOneViews";
import { phaseCompare, phaseComparisonOptions } from "@/lib/phase1";
import { staticPageMetadata } from "@/lib/static-page-seo";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return staticPageMetadata(
    "compare-courses",
    "Compare university courses",
    "Compare published course offering tuition, intakes and durations side by side.",
    "/compare/courses",
    false,
  );
}
type Comparison = { items: AnyRecord[]; invalid: string[] };

export default async function CompareCourses({
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
      phaseCompare<Comparison>("courses", items),
      phaseComparisonOptions<{ slug: string; name: string }>("courses"),
    ]);
  } catch {}
  return <CompareView type="courses" result={result} items={items} options={options} />;
}
