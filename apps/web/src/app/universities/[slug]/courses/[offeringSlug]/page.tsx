import { notFound } from "next/navigation";
import { PhaseDetail, type AnyRecord } from "@/components/phase1/PhaseOneViews";
import { phaseUniversityCourses } from "@/lib/phase1";

export const dynamic = "force-dynamic";

async function universityCourse(universitySlug: string, offeringSlug: string) {
  try {
    return await phaseUniversityCourses<AnyRecord>(
      universitySlug,
      offeringSlug,
    );
  } catch {
    notFound();
  }
}

export default async function UniversityCoursePage({
  params,
}: {
  params: Promise<{ slug: string; offeringSlug: string }>;
}) {
  const value = await params;
  const row = await universityCourse(value.slug, value.offeringSlug);
  return (
    <PhaseDetail
      resource="courses"
      row={row}
      parent={["University courses", `/universities/${value.slug}/courses`]}
    />
  );
}
