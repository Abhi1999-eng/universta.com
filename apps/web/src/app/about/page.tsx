import { headers } from "next/headers";
import { EditorialPage } from "@/components/phase1/EditorialPage";
import type { AnyRecord } from "@/components/phase1/PhaseOneViews";
import { phasePage } from "@/lib/phase1";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "About Universta",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  let page: AnyRecord | null = null;
  try {
    const anonymousId = (await headers()).get("x-anon-id") ?? undefined;
    page = await phasePage<AnyRecord>("about", anonymousId);
  } catch {}
  return (
    <EditorialPage
      page={page}
      fallbackTitle="About Universta"
      fallbackDescription="A source-aware local study abroad information platform."
    />
  );
}
