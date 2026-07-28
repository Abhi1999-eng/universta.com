import { EditorialPage } from "@/components/phase1/EditorialPage";
import type { AnyRecord } from "@/components/phase1/PhaseOneViews";
import { phasePage } from "@/lib/phase1";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Frequently asked questions | Universta",
  alternates: { canonical: "/faq" },
};

export default async function FaqPage() {
  let page: AnyRecord | null = null;
  try {
    page = await phasePage<AnyRecord>("faq");
  } catch {}
  return (
    <EditorialPage
      page={page}
      fallbackTitle="Frequently asked questions"
      fallbackDescription="Find published answers about using Universta's study abroad information."
    />
  );
}
