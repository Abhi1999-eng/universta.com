import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { type AnyRecord } from "@/components/phase1/PhaseOneViews";
import { ReferenceConsultantDetail } from "@/components/templates/ReferenceResourceViews";
import { phaseDetail, phaseResolveRedirect } from "@/lib/phase1";
import { phaseOneMetadata } from "@/lib/phase1-metadata";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

async function consultant(slug: string) {
  try {
    return await phaseDetail<AnyRecord>("consultants", slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const row = await consultant(slug);
  return row
    ? phaseOneMetadata(row, `/study-abroad-consultants/${row.slug ?? slug}`, "Study abroad consultant")
    : { title: "Consultant not found | Universta", robots: { index: false } };
}

export default async function ConsultantPage({ params }: Props) {
  const { slug } = await params;
  const row = await consultant(slug);
  if (!row) {
    const redirect = await phaseResolveRedirect(`/study-abroad-consultants/${slug}`);
    if (redirect) permanentRedirect(redirect.targetPath);
    notFound();
  }
  return <ReferenceConsultantDetail row={row} />;
}
