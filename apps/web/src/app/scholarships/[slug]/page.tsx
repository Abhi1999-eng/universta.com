import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { PhaseDetail, type AnyRecord } from "@/components/phase1/PhaseOneViews";
import { phaseDetail, phaseResolveRedirect } from "@/lib/phase1";
import { phaseOneMetadata } from "@/lib/phase1-metadata";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

async function scholarship(slug: string) {
  try {
    return await phaseDetail<AnyRecord>("scholarships", slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const row = await scholarship(slug);
  return row
    ? phaseOneMetadata(row, `/scholarships/${row.slug ?? slug}`, "Scholarship")
    : { title: "Scholarship not found | Universta", robots: { index: false } };
}

export default async function ScholarshipPage({ params }: Props) {
  const { slug } = await params;
  const row = await scholarship(slug);
  if (!row) {
    const redirect = await phaseResolveRedirect(`/scholarships/${slug}`);
    if (redirect) permanentRedirect(redirect.targetPath);
    notFound();
  }
  return <PhaseDetail resource="scholarships" row={row} />;
}
