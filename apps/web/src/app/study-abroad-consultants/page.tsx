import {
  PhaseListing,
  type AnyRecord,
  type PageMeta,
} from "@/components/phase1/PhaseOneViews";
import { phaseList } from "@/lib/phase1";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Study abroad consultants | Universta",
  alternates: { canonical: "/study-abroad-consultants" },
};

export default async function ConsultantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = Object.fromEntries(
    Object.entries(raw).flatMap(([key, value]) =>
      typeof value === "string" && value ? [[key, value]] : [],
    ),
  );
  let rows: AnyRecord[] = [];
  let meta: PageMeta | null = null;
  try {
    const result = await phaseList<AnyRecord>("consultants", params);
    rows = result.data;
    meta = result.meta as PageMeta;
  } catch {}
  return <PhaseListing resource="consultants" rows={rows} meta={meta} />;
}
