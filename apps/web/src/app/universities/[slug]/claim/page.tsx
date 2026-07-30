import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  PhaseOneFooter,
  PhaseOneHeader,
  Crumbs,
} from "@/components/phase1/PhaseOneChrome";
import { UniversityClaimForm } from "@/components/universities/UniversityClaimForm";
import type { AnyRecord } from "@/components/phase1/PhaseOneViews";
import { phaseDetail } from "@/lib/phase1";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

async function university(slug: string) {
  try {
    return await phaseDetail<AnyRecord>("universities", slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const row = await university(slug);
  if (!row) return { title: "University not found | Universta" };
  return {
    title: `Claim ${row.name ?? "this university"} | Universta`,
    robots: { index: false },
  };
}

export default async function UniversityClaimPage({ params }: Props) {
  const { slug } = await params;
  const row = await university(slug);
  if (!row) notFound();
  const name = row.name ?? "this university";
  return (
    <main>
      <PhaseOneHeader />
      <Crumbs
        items={[
          ["Home", "/"],
          ["Universities", "/universities"],
          [name, `/universities/${slug}`],
          ["Claim this listing"],
        ]}
      />
      <section className="listing-hero">
        <div className="shell">
          <p className="eyebrow">University claim request</p>
          <h1>Claim {name}</h1>
          <p>
            If you represent {name}, request that this listing be assigned to
            you for review. Our team verifies every request before any change
            is made — submitting this form does not grant admin access.
          </p>
        </div>
      </section>
      <section className="shell phase1-editorial">
        <UniversityClaimForm universitySlug={slug} />
      </section>
      <PhaseOneFooter />
    </main>
  );
}
