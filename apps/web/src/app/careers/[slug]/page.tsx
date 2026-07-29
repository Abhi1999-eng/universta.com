import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { PhaseDetail, type AnyRecord } from "@/components/phase1/PhaseOneViews";
import { phaseDetail, phaseResolveRedirect } from "@/lib/phase1";
import { phaseOneMetadata } from "@/lib/phase1-metadata";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

async function job(slug: string) {
  try {
    return await phaseDetail<AnyRecord>("jobs", slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const row = await job(slug);
  return row
    ? phaseOneMetadata(row, `/careers/${row.slug ?? slug}`, "Career")
    : { title: "Career not found | Universta", robots: { index: false } };
}

export default async function JobPage({ params }: Props) {
  const { slug } = await params;
  const row = await job(slug);
  if (!row) {
    const redirect = await phaseResolveRedirect(`/careers/${slug}`);
    if (redirect) permanentRedirect(redirect.targetPath);
    notFound();
  }
  return <PhaseDetail resource="jobs" row={row} />;
}
