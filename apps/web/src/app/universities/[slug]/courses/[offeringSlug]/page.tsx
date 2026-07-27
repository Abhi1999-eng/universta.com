import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PhaseDetail, type AnyRecord } from "@/components/phase1/PhaseOneViews";
import { phaseUniversityCourses } from "@/lib/phase1";
import { phaseOneMetadata } from "@/lib/phase1-metadata";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; offeringSlug: string }> };

async function universityCourse(universitySlug: string, offeringSlug: string) {
  try {
    return await phaseUniversityCourses<AnyRecord>(
      universitySlug,
      offeringSlug,
    );
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, offeringSlug } = await params;
  const row = await universityCourse(slug, offeringSlug);
  return row
    ? phaseOneMetadata(row, `/universities/${slug}/courses/${row.slug ?? offeringSlug}`, "University course")
    : { title: "University course not found | Universta", robots: { index: false } };
}

export default async function UniversityCoursePage({ params }: Props) {
  const value = await params;
  const row = await universityCourse(value.slug, value.offeringSlug);
  if (!row) notFound();
  return (
    <PhaseDetail
      resource="courses"
      row={row}
      parent={["University courses", `/universities/${value.slug}/courses`]}
    />
  );
}
