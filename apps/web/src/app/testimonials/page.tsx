import {
  PhaseListing,
  type AnyRecord,
  type PageMeta,
} from "@/components/phase1/PhaseOneViews";
import { phaseList } from "@/lib/phase1";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Testimonials | Universta",
  alternates: { canonical: "/testimonials" },
};

export default async function TestimonialsPage() {
  let rows: AnyRecord[] = [];
  let meta: PageMeta | null = null;
  try {
    const result = await phaseList<AnyRecord>("testimonials");
    rows = result.data;
    meta = result.meta as PageMeta;
  } catch {}
  return (
    <PhaseListing
      resource="testimonials"
      rows={rows}
      meta={meta}
      search={false}
    />
  );
}
