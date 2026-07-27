import { EditorialPage } from "@/components/phase1/EditorialPage";
import type { AnyRecord } from "@/components/phase1/PhaseOneViews";
import { phasePage } from "@/lib/phase1";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let page: AnyRecord | null = null;
  try {
    page = await phasePage<AnyRecord>("home");
  } catch {}
  return (
    <EditorialPage
      home
      page={page}
      fallbackTitle="Plan your study abroad journey with clarity."
      fallbackDescription="Explore published countries, subjects, courses, universities and scholarships, then speak with a counsellor when you are ready."
    />
  );
}
