import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getCourse } from "@/lib/catalog";
import { CourseGuide } from "@/components/study-abroad/CourseGuide";
import { resolvedMetadata } from "@/lib/seo-management";
import { phaseCourseSlug, phaseList } from "@/lib/phase1";
import type { AnyRecord } from "@/components/phase1/PhaseOneViews";
import { programmeSample } from "@/lib/programme-sample";
import { toScholarshipCards } from "@/lib/scholarship-card";
import { withQuery } from "@/lib/university-courses";
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
/* How many of the course's programmes the guide reads: six drawn as cards,
   the rest named a line each, so a course taught at a few dozen
   universities names every one of them on its own page. */
const PROGRAMMES_READ = 30;
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
  /* The course and the universities' programmes of it are read together;
     the programmes are not the point of the page, so a failure there
     costs their section and not the route. */
  const [course, programmes] = await Promise.all([
    load(p.slug, country),
    programmeSample(
      { course: [p.slug], ...(country ? { country: [country] } : {}) },
      PROGRAMMES_READ,
    ),
  ]);
  if (!course) {
    /* The reference sends /courses/<slug>/ to whatever carries the slug,
       so a programme, a subject or a specialization reached by its bare
       name lands on its own page. Only one live match moves the reader;
       none or several stay a 404 rather than a guess. */
    const match = await phaseCourseSlug(p.slug);
    if (match) permanentRedirect(withQuery(match.path, q));
    notFound();
  }
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
        programmes={programmes}
      />
      <script type="application/ld+json">
        {JSON.stringify(course.jsonLd).replace(/</g, "\\u003c")}
      </script>
    </>
  );
}
