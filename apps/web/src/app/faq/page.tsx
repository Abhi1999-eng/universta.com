import { headers } from "next/headers";
import { EditorialPage } from "@/components/phase1/EditorialPage";
import type { AnyRecord } from "@/components/phase1/PhaseOneViews";
import { phasePage } from "@/lib/phase1";
import { staticPageMetadata } from "@/lib/static-page-seo";
import { jsonLdString } from "@/lib/json-ld";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return staticPageMetadata(
    "faq",
    "Frequently asked questions",
    "Find published answers about using Universta's study abroad information.",
    "/faq",
  );
}

type FaqSection = { sectionType?: string; bodyJson?: { items?: Array<{ label?: string; value?: string }> } };

function faqJsonLd(page: AnyRecord | null) {
  const sections = (Array.isArray(page?.sections) ? page.sections : []) as unknown as FaqSection[];
  const items = sections
    .filter((section) => section.sectionType === "FAQ_GROUP")
    .flatMap((section) => section.bodyJson?.items ?? [])
    .filter((item): item is { label: string; value: string } => Boolean(item?.label && item?.value));
  if (!items.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.label,
      acceptedAnswer: { "@type": "Answer", text: item.value },
    })),
  };
}

export default async function FaqPage() {
  let page: AnyRecord | null = null;
  try {
    const anonymousId = (await headers()).get("x-anon-id") ?? undefined;
    page = await phasePage<AnyRecord>("faq", anonymousId);
  } catch {}
  const jsonLd = faqJsonLd(page);
  return (
    <>
      <EditorialPage
        page={page}
        fallbackTitle="Frequently asked questions"
        fallbackDescription="Find published answers about using Universta's study abroad information."
      />
      {jsonLd ? (
        <script type="application/ld+json">{jsonLdString(jsonLd)}</script>
      ) : null}
    </>
  );
}
