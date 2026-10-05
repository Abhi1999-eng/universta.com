import Link from 'next/link';
import { countryScholarshipsHref } from '@/lib/country-scholarship-list';

/**
 * The strip under a destination's hero: the four ways into it.
 *
 * A destination is not one page. It is the guide, the fields taught there,
 * the institutions teaching them and the money on offer -- and until this
 * strip existed each of those lived at a URL a reader had to already know
 * about. The guide linked down into its own sections and nowhere across.
 *
 * A tab with nothing behind it is left out rather than shown at zero. The
 * count is the point of the tab: "Universities 100" is an invitation, and
 * "Universities 0" is a dead end dressed as one. Overview always stays,
 * because the guide is what the destination is.
 */

export type CountryTabKey =
  | 'overview'
  | 'subjects'
  | 'universities'
  | 'scholarships';

export type CountryTab = {
  key: CountryTabKey;
  href: string;
  label: string;
  /** Null on Overview, which is a page rather than a collection. */
  count: number | null;
};

export type CountryTabCounts = {
  subjects: number;
  universities: number;
  scholarships: number;
};

export function countryTabs(
  countrySlug: string,
  counts: CountryTabCounts,
): CountryTab[] {
  const base = `/study-abroad/${countrySlug}`;
  return [
    { key: 'overview', href: base, label: 'Overview', count: null },
    {
      key: 'subjects',
      href: `${base}/subjects`,
      label: 'Subjects',
      count: counts.subjects,
    },
    {
      key: 'universities',
      href: `${base}/universities`,
      label: 'Universities',
      count: counts.universities,
    },
    {
      /* Under the destination, as the behaviour reference files it. This
         tab used to leave for the worldwide finder in the older design,
         which never named the country and had no strip to come back by. */
      key: 'scholarships',
      href: countryScholarshipsHref(countrySlug),
      label: 'Scholarships',
      count: counts.scholarships,
    },
  ].filter((tab) => tab.count === null || tab.count > 0) as CountryTab[];
}

export function CountryTabs({
  tabs,
  current,
  below = false,
}: {
  tabs: CountryTab[];
  /** The tab the reader is on, or none when a page sits below one of them. */
  current?: CountryTabKey;
  /**
   * The page being read sits under `current` rather than being it: a
   * subject's page under Subjects. The tab is still the one to mark, but it
   * is a link to somewhere else, and "current page" on a link that leaves
   * the page is a thing a screen reader would say and be wrong.
   */
  below?: boolean;
}) {
  /* One tab is the Overview on its own, which is not a choice. */
  if (tabs.length < 2) return null;
  return (
    <nav className="unitabs" aria-label="Destination sections">
      <div className="wrap unitabs__inner">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={
              tab.key === current ? (below ? 'true' : 'page') : undefined
            }
          >
            {tab.label}
            {/* A real space: the gap was a margin, so a screen reader and a
                search engine both read "Subjects30". */}
            {tab.count === null ? null : (
              <>
                {' '}
                <em>{tab.count.toLocaleString('en-GB')}</em>
              </>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/**
 * What each of the guide's sections is called in the "On this page" row.
 * A section missing here -- an editor's own, the closing bands -- is not
 * offered as a jump, rather than offered under a made-up name.
 */
const SECTION_LABELS: Readonly<Record<string, string>> = {
  why: 'Why study here',
  overview: 'Overview',
  'study-paths': 'Study paths',
  universities: 'Universities',
  subjects: 'Subjects',
  courses: 'Courses',
  documents: 'Documents',
  intakes: 'Intakes',
  cost: 'Costs',
  language: 'Language',
  'work-visa': 'Visa and work',
  numbers: 'In numbers',
  testimonials: 'Student voices',
  faq: 'FAQs',
  'scholarship-funding': 'Scholarships',
  consultants: 'Consultants',
};

/** The jumps the row offers, in the page's order, for the sections that
 * actually render. */
export function sectionJumps(rendered: readonly string[]) {
  return rendered.flatMap((id) =>
    SECTION_LABELS[id] ? [{ id, label: SECTION_LABELS[id]! }] : [],
  );
}

/**
 * "On this page": the guide's sections, as links to themselves.
 *
 * The behaviour reference puts this row under a destination's tabs. The
 * guide runs to some twenty thousand pixels on a desktop and thirty on a
 * phone, and a reader who came for the visa had to scroll past fees,
 * intakes and documents to find out whether there was a visa section at
 * all. Built from the list of sections the page renders, so it never
 * offers a jump to one that is not there.
 */
export function CountrySectionJumps({ rendered }: { rendered: readonly string[] }) {
  const jumps = sectionJumps(rendered);
  /* Two sections are a page a reader can see the whole of. */
  if (jumps.length < 3) return null;
  return (
    <nav className="pagetoc" aria-label="On this page">
      <div className="wrap pagetoc__inner">
        <span className="pagetoc__label">On this page</span>
        {jumps.map((jump) => (
          <a className="chipbtn chipbtn--sm" href={`#${jump.id}`} key={jump.id}>
            {jump.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
