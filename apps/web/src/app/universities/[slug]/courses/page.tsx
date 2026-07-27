import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  PhaseListing,
  type AnyRecord,
  type PageMeta,
} from "@/components/phase1/PhaseOneViews";
import { phaseUniversityCourses } from "@/lib/phase1";
import { phaseOneMetadata } from "@/lib/phase1-metadata";

export const dynamic = "force-dynamic";

type UniversityCoursesResult = {
  university?: { name?: string };
  data?: AnyRecord[];
  meta?: PageMeta;
};

type Props = { params: Promise<{ slug: string }> };

async function universityCourses(slug: string) {
  try {
    return await phaseUniversityCourses<UniversityCoursesResult>(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await universityCourses(slug);
  const name = result?.university?.name ?? "University";
  return result
    ? phaseOneMetadata({ name, summary: `Published university courses from ${name}.` }, `/universities/${slug}/courses`, "University courses")
    : { title: "University courses not found | Universta", robots: { index: false } };
}

export default async function UniversityCoursesPage({ params }: Props) {
  const value = await params;
  const result = await universityCourses(value.slug);
  if (!result) notFound();
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
