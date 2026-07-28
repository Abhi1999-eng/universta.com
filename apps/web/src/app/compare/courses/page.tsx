import { CompareView } from "@/components/phase1/CompareView";
import type { AnyRecord } from "@/components/phase1/PhaseOneViews";
import { phaseCompare } from "@/lib/phase1";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Compare university courses | Universta",
  robots: { index: false, follow: true },
  alternates: { canonical: "/compare/courses" },
};
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
  try {
    result = await phaseCompare<Comparison>("courses", items);
  } catch {}
  return <CompareView type="courses" result={result} items={items} />;
}
