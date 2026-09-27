import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteSearch } from '@/components/study-abroad/SiteSearch';
import { hasFlag } from '@/lib/flag-codes';
import { searchCatalogue } from '@/lib/search';
import { siteOrigin } from '@/lib/site-origin';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Search',
  description:
    'Search countries, subjects, courses, universities and scholarships across Universta.',
  alternates: { canonical: `${siteOrigin}/search` },
  /* A results page is not a page to index: it has no content of its own and
     every query would be another URL saying the same thing. */
  robots: { index: false, follow: true },
};

/**
 * One page for everything the catalogue holds.
 *
 * The box on the homepage answers under headings as somebody types; this is
 * where Enter takes them, and where "See all" of a heading starts. Results
 * are grouped by what they are rather than ranked into one list, because
 * "Computer Science" is a subject, a course, and part of a hundred course
 * names, and only the headings tell those apart at a glance.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? '';
  const results = await searchCatalogue(query);

  return (
    <>
      <section className="sec sec--paper sec--tight srch__hero">
        <div className="wrap">
          <nav className="crumbs dir__crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <span aria-current="page">Search</span>
          </nav>
          {/* Plain: the rule the eyebrow draws beside itself belongs to a
              section heading, and this one sits under a breadcrumb. */}
          <p className="eyebrow eyebrow--plain">Search</p>
          <h1 className="sec-title">Search Universta</h1>
          <p className="sec-lead">
            Countries, subjects, courses, universities and scholarships — every
            published record, in one place.
          </p>
          <SiteSearch autoFocus defaultValue={query} />
        </div>
      </section>

      <section className="sec sec--white">
        <div className="wrap">
          {!query ? (
            <p className="sec-lead">Type something above to begin.</p>
          ) : results.total === 0 ? (
            <p className="sec-lead">
              Nothing published matches <b>{query}</b>. Try a country, a subject,
              or part of a course name.
            </p>
          ) : (
            <>
              <p className="sec-lead srch__count" data-testid="search-count">
                {results.total} {results.total === 1 ? 'result' : 'results'} for{' '}
                <b>{query}</b>
              </p>
              {results.groups.map((group) => (
                <div className="srch__group" key={group.type}>
                  <h2 className="srch__head">
                    {group.label}
                    <span className="srch__n">{group.items.length}</span>
                  </h2>
                  <div className="srch__grid">
                    {group.items.map((item) => (
                      <Link className="srch__card" href={item.href} key={item.id}>
                        {hasFlag(item.iso2Code) ? (
                          /* eslint-disable-next-line @next/next/no-img-element --
                             a 700-byte vector the chips already serve. */
                          <img
                            className="srch__flag"
                            src={`/flags/${item.iso2Code!.toLowerCase()}.svg`}
                            alt=""
                            loading="lazy"
                            decoding="async"
                          />
                        ) : null}
                        <span className="srch__label">{item.label}</span>
                        {item.meta ? (
                          <span className="srch__meta">{item.meta}</span>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                  <Link className="linkcta" href={group.href}>
                    All {group.label.toLowerCase()}{' '}
                    <span className="linkcta__arrow" aria-hidden="true">
                      &rarr;
                    </span>
                  </Link>
                </div>
              ))}
            </>
          )}
        </div>
      </section>
    </>
  );
}
