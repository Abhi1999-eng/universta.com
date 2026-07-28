import {
  PhaseListing,
  type AnyRecord,
  type PageMeta,
} from "@/components/phase1/PhaseOneViews";
import { phaseList } from "@/lib/phase1";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Scholarships | Universta",
  alternates: { canonical: "/scholarships" },
};

export default async function ScholarshipsPage({
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
    const result = await phaseList<AnyRecord>("scholarships", params);
    rows = result.data;
    meta = result.meta as PageMeta;
  } catch {}
  return <PhaseListing resource="scholarships" rows={rows} meta={meta} />;
}
