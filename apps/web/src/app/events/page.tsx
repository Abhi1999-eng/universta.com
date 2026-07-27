import {
  PhaseListing,
  type AnyRecord,
  type PageMeta,
} from "@/components/phase1/PhaseOneViews";
import { phaseList } from "@/lib/phase1";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Events | Universta",
  alternates: { canonical: "/events" },
};

export default async function EventsPage() {
  let rows: AnyRecord[] = [];
  let meta: PageMeta | null = null;
  try {
    const result = await phaseList<AnyRecord>("events");
    rows = result.data;
    meta = result.meta as PageMeta;
  } catch {}
  return (
    <PhaseListing resource="events" rows={rows} meta={meta} search={false} />
  );
}
