import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { PhaseDetail, type AnyRecord } from "@/components/phase1/PhaseOneViews";
import { phaseDetail, phaseResolveRedirect } from "@/lib/phase1";
import { phaseOneMetadata } from "@/lib/phase1-metadata";
import { jsonLdString } from "@/lib/json-ld";

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

function jobPostingJsonLd(row: AnyRecord) {
  const datePosted = row.publishedDate ?? row.createdAt;
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: row.title,
    description: row.description ?? row.summary ?? row.title,
    datePosted,
    validThrough: row.expiryDate ?? undefined,
    employmentType: row.employmentType ?? undefined,
    hiringOrganization: { "@type": "Organization", name: "Universta" },
    jobLocation: row.location
      ? { "@type": "Place", address: row.location }
      : undefined,
    jobLocationType:
      row.remoteStatus === "REMOTE" ? "TELECOMMUTE" : undefined,
  };
}

export default async function JobPage({ params }: Props) {
  const { slug } = await params;
  const row = await job(slug);
  if (!row) {
    const redirect = await phaseResolveRedirect(`/careers/${slug}`);
    if (redirect) permanentRedirect(redirect.targetPath);
    notFound();
  }
  return (
    <>
      <PhaseDetail resource="jobs" row={row} />
      <script type="application/ld+json">
        {jsonLdString(jobPostingJsonLd(row))}
      </script>
    </>
  );
}
