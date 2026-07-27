import {
  PhaseListing,
  type AnyRecord,
  type PageMeta,
} from "@/components/phase1/PhaseOneViews";
import { phaseList } from "@/lib/phase1";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Careers | Universta",
  alternates: { canonical: "/careers" },
};

export default async function CareersPage() {
  let rows: AnyRecord[] = [];
  let meta: PageMeta | null = null;
  try {
    const result = await phaseList<AnyRecord>("jobs");
    rows = result.data;
    meta = result.meta as PageMeta;
  } catch {}
  return (
    <PhaseListing resource="jobs" rows={rows} meta={meta} search={false} />
  );
}
