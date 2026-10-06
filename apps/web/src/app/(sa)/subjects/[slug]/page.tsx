import {
  getCourseLevels,
  getCoursesByLevel,
  getSubject,
  getSubjects,
  type Subject,
  type SubSubject,
} from "@/lib/catalog";
import { everyLevel, LEVEL_ROWS_FETCHED } from "@/lib/course-levels";
import { programmeSample } from "@/lib/programme-sample";
import { relatedSubjects } from "@/lib/related-subjects";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import type { AnyRecord } from "@/components/phase1/PhaseOneViews";
import { SubjectGuide } from "@/components/study-abroad/SubjectGuide";
import { RecordVisit } from "@/components/study-abroad/ContinueJourney";
import { phaseList } from "@/lib/phase1";

import { jsonLdString } from "@/lib/json-ld";
import { resolvedMetadata } from "@/lib/seo-management";
import { toScholarshipCards } from "@/lib/scholarship-card";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

/** A listing row: the subjects list sends each subject's branches. */
type SubjectWithBranches = Subject & { subSubjects?: SubSubject[] };

async function load(slug: string) {
  try {
    return await getSubject(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const subject = await load((await params).slug);
  if (!subject) return { title: "Subject not found" };
  const resolved = resolvedMetadata(
    subject.seo,
    subject.name,
    subject.shortDescription ?? `Explore ${subject.name} courses.`,
    `/subjects/${subject.slug}`,
  );
  /* `resolvedMetadata` appends the site name, and this route family's layout
     appends it again through its title template. Hand the template the bare
     title and let it do that once. */
  return { ...resolved, title: subject.seo?.seoTitle ?? subject.name };
}

export default async function SubjectDetailPage({ params }: Props) {
  const slug = (await params).slug;
  const subject = await load(slug);
  if (!subject) notFound();

  /* Scholarships are a cross-link, not the point of the page: a failure here
     drops the section rather than the route. */
  const [scholarships, universities, levels, allSubjects, allLevels, programmes] = await Promise.all([
    phaseList<AnyRecord>("scholarships", { subject: slug, limit: "6" })
      .then((result) => toScholarshipCards(result.data))
      .catch(() => []),
    /* The reference's subject page has no universities section of its own,
       but the page it replaced cross-linked them, so they are kept as a
       group in the closing connect band rather than dropped. The total is
       kept too: the page's figure used to be the eight it read. */
    phaseList<AnyRecord>("universities", { subject: slug, limit: "8" })
      .then((result) => ({
        rows: result.data.map((row) => ({
          id: String(row.id),
          name: String(row.name ?? ""),
          slug: String(row.slug ?? ""),
        })),
        total: Number((result.meta as { total?: unknown } | null)?.total) || null,
      }))
      .catch(() => ({ rows: [], total: null })),
    /* The subject's courses under their levels. A failure leaves the guide
       with the six mixed courses it always had, not without a section. */
    getCoursesByLevel({ subject: slug, perLevel: LEVEL_ROWS_FETCHED }).catch(
      () => null,
    ),
    /* Every subject with its specializations, to find this one's
       neighbours. Without it the page simply has no related band. */
    getSubjects({ limit: "100" })
      .then((result) => result.data as SubjectWithBranches[])
      .catch(() => []),
    /* Every study level, so the six the page always shows are there even
       where nothing is listed at them yet. */
    getCourseLevels().catch(() => null),
    /* The first few of the universities' programmes in it, as the
       reference's subject page shows its courses, and how many there are
       in all. None, or a failed read, leaves the section out. */
    programmeSample({ subject: [slug] }),
  ]);
  const related = relatedSubjects(subject, allSubjects).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    iconMedia: row.iconMedia ?? null,
  }));

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "/" },
      { "@type": "ListItem", position: 2, name: "Subjects", item: "/subjects" },
      {
        "@type": "ListItem",
        position: 3,
        name: subject.name,
        item: `/subjects/${subject.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumb) }}
      />
      <RecordVisit
        kind="subject"
        href={`/subjects/${subject.slug}`}
        title={subject.name}
      />
      <SubjectGuide
        subject={subject}
        scholarships={scholarships}
        universities={universities.rows}
        universityTotal={universities.total}
        levels={everyLevel(levels, allLevels)}
        related={related}
        programmes={programmes}
      />
    </>
  );
}
