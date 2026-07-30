import Link from "next/link";

type SeoEntry = { label: string; href: string; note: string };

const ENTRIES: SeoEntry[] = [
  { label: "Countries", href: "/countries", note: "Open a country, use its SEO tab (title, description, canonical, OG, hreflang, schema)." },
  { label: "Cities", href: "/locations", note: "Open the Cities tab, use the “SEO” action on any row." },
  { label: "Universities", href: "/phase1/universities", note: "Edit a university, use the SEO section of the structured editor." },
  { label: "University course offerings", href: "/phase1/offerings", note: "Edit an offering, use the SEO section of the structured editor." },
  { label: "Scholarships", href: "/phase1/scholarships", note: "Edit a scholarship, use the SEO section of the structured editor." },
  { label: "Consultants", href: "/phase1/consultants", note: "Edit a consultant, use the SEO section of the structured editor." },
  { label: "Consultant locations", href: "/consultant-locations", note: "Use the “SEO” action on any location row." },
  { label: "Jobs", href: "/phase1/jobs", note: "Edit a job, use the SEO section of the structured editor." },
  { label: "Events", href: "/phase1/events", note: "Edit an event, use the SEO section of the structured editor." },
  { label: "Success stories", href: "/phase1/success-stories", note: "Edit a story, use the SEO section of the structured editor." },
  { label: "Testimonials", href: "/phase1/testimonials", note: "Edit a testimonial, use the SEO section of the structured editor." },
  { label: "Editorial pages", href: "/phase1/pages", note: "Edit a page, use the SEO fieldset (title, description, canonical, focus keyword)." },
];

export function SeoManagementHub() {
  return (
    <section className="mx-auto max-w-[1180px]">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">Platform tools</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">SEO management</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
        SEO title, meta description, canonical URL, Open Graph image and robots directives are edited inline within
        each resource&apos;s own editor rather than a separate global form, so changes stay next to the content
        they describe. Every SEO-enabled resource type is listed here so nothing is left undiscoverable.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {ENTRIES.map((entry) => (
          <Link
            key={entry.href}
            href={entry.href}
            className="block rounded-2xl border border-[#E8ECF3] bg-white p-5 transition hover:border-[#1657CF] hover:shadow-[0_8px_24px_rgba(22,87,207,0.08)]"
          >
            <h3 className="text-base font-semibold text-[#0D1524]">{entry.label}</h3>
            <p className="mt-2 text-sm leading-6 text-[#667085]">{entry.note}</p>
          </Link>
        ))}
      </div>
      <p className="mt-8 text-xs text-[#828B9B]">
        Not covered yet: FAQ entries (nested within Country/Course records, no standalone SEO record) and the
        code-defined listing/comparison routes (Careers, Events, Compare — these are static routes, not CMS
        records, so per-record SEO does not apply to them the same way).
      </p>
    </section>
  );
}
