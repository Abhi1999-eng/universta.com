import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCourse } from "@/lib/catalog";
import { CourseGuide } from "@/components/study-abroad/CourseGuide";
import { resolvedMetadata } from "@/lib/seo-management";
import { phaseList } from "@/lib/phase1";
import type { AnyRecord } from "@/components/phase1/PhaseOneViews";
import { toScholarshipCards } from "@/lib/scholarship-card";
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
async function load(slug: string, country?: string) {
  try {
    return await getCourse(slug, country);
  } catch {
    return null;
  }
}
export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const p = await params;
  const q = await searchParams;
  const course = await load(p.slug, one(q.country));
  if (!course) return { title: "Course not found" };
  const resolved = resolvedMetadata(
    course.seo,
    course.name,
    course.shortDescription ?? `Explore ${course.name}.`,
    `/courses/${course.slug}`,
  );
  /* This route family's layout appends the site name through its title
     template; `resolvedMetadata` appends it too. Hand over the bare title. */
  return { ...resolved, title: course.seo?.seoTitle ?? course.name };
}
export default async function CourseDetailPage({
  params,
  searchParams,
}: Props) {
  const p = await params;
  const q = await searchParams;
  const country = one(q.country);
  const course = await load(p.slug, country);
  if (!course) notFound();
  /* Funding is a cross-link, not the point of the page: a failure here drops
     the section rather than the route. */
  const scholarships = await phaseList<AnyRecord>("scholarships", {
    course: course.slug,
    limit: "6",
    ...(country ? { country } : {}),
  })
    .then((result) => toScholarshipCards(result.data))
    .catch(() => []);
  return (
    <>
      <CourseGuide
        course={course}
        country={country}
        scholarships={scholarships}
      />
      <script type="application/ld+json">
        {JSON.stringify(course.jsonLd).replace(/</g, "\\u003c")}
      </script>
    </>
  );
}
