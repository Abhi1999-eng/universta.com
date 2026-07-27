import { notFound } from "next/navigation";
import {
  PhaseListing,
  type AnyRecord,
  type PageMeta,
} from "@/components/phase1/PhaseOneViews";
import { phaseUniversityCourses } from "@/lib/phase1";

export const dynamic = "force-dynamic";

type UniversityCoursesResult = {
  university?: { name?: string };
  data?: AnyRecord[];
  meta?: PageMeta;
};

async function universityCourses(slug: string) {
  try {
    return await phaseUniversityCourses<UniversityCoursesResult>(slug);
  } catch {
    notFound();
  }
}

export default async function UniversityCoursesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const value = await params;
  const result = await universityCourses(value.slug);
  return (
    <PhaseListing
      resource="courses"
      title={`${result.university?.name ?? "University"} courses`}
      basePath={`/universities/${value.slug}/courses`}
      rows={result.data ?? []}
      meta={result.meta ?? null}
      search={false}
    />
  );
}
