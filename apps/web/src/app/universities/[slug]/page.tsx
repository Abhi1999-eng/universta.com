import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import {
  UniversityDetail,
  type AnyRecord,
} from "@/components/phase1/PhaseOneViews";
import { phaseDetail, phaseResolveRedirect } from "@/lib/phase1";
import { phaseOneMetadata } from "@/lib/phase1-metadata";

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
  return row
    ? phaseOneMetadata(row, `/universities/${row.slug ?? slug}`, "University")
    : { title: "University not found | Universta", robots: { index: false } };
}

export default async function UniversityPage({ params }: Props) {
  const { slug } = await params;
  const row = await university(slug);
  if (!row) {
    const redirect = await phaseResolveRedirect(`/universities/${slug}`);
    if (redirect) permanentRedirect(redirect.targetPath);
    notFound();
  }
  return <UniversityDetail row={row} />;
}
