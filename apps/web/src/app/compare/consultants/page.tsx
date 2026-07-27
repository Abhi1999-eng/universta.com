import { CompareView } from "@/components/phase1/CompareView";
import type { AnyRecord } from "@/components/phase1/PhaseOneViews";
import { phaseCompare } from "@/lib/phase1";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Compare consultants | Universta",
  robots: { index: false, follow: true },
  alternates: { canonical: "/compare/consultants" },
};
type Comparison = { items: AnyRecord[]; invalid: string[] };

export default async function CompareConsultants({
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
    result = await phaseCompare<Comparison>("consultants", items);
  } catch {}
  return <CompareView type="consultants" result={result} items={items} />;
}
