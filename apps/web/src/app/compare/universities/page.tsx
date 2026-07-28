import { CompareView } from "@/components/phase1/CompareView";
import type { AnyRecord } from "@/components/phase1/PhaseOneViews";
import { phaseCompare } from "@/lib/phase1";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Compare universities | Universta",
  robots: { index: false, follow: true },
  alternates: { canonical: "/compare/universities" },
};
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
