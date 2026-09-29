import { getSubject } from "@/lib/catalog";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import type { AnyRecord } from "@/components/phase1/PhaseOneViews";
import { SubjectGuide } from "@/components/study-abroad/SubjectGuide";
import { phaseList } from "@/lib/phase1";

import { jsonLdString } from "@/lib/json-ld";
import { resolvedMetadata } from "@/lib/seo-management";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

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
  const [scholarships, universities] = await Promise.all([
    phaseList<AnyRecord>("scholarships", { subject: slug, limit: "6" })
      .then((result) =>
        result.data.map((row) => ({
          id: String(row.id),
          name: String(row.name ?? row.title ?? ""),
          slug: String(row.slug ?? ""),
        })),
      )
      .catch(() => []),
    /* The reference's subject page has no universities section of its own,
       but the page it replaced cross-linked them, so they are kept as a
       group in the closing connect band rather than dropped. */
    phaseList<AnyRecord>("universities", { subject: slug, limit: "8" })
      .then((result) =>
        result.data.map((row) => ({
          id: String(row.id),
          name: String(row.name ?? ""),
          slug: String(row.slug ?? ""),
        })),
      )
      .catch(() => []),
  ]);

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
      <SubjectGuide
        subject={subject}
        scholarships={scholarships}
        universities={universities}
      />
    </>
  );
}
