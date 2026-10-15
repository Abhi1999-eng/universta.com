import Link from 'next/link';
import { Crumbs } from './Crumbs';

/**
 * The page-not-found page, as the client's zip draws it: the compact hero
 * that says so, a search, and the popular places to start. Drawn inside
 * the Study Abroad frame wherever the lost address was, so a dead link is
 * not also a change of site.
 */
const PLACES = [
  ['/study-abroad', 'Destinations', 'Study abroad destinations'],
  ['/courses', 'Courses', 'Find a course'],
  ['/universities', 'Universities', 'Explore universities'],
  ['/scholarships', 'Scholarships', 'Find funding'],
] as const;

export function NotFoundBody() {
  return (
    <>
      <section className="hero hero--compact h-hero">
        <div className="wrap">
          <Crumbs trail={[{ label: 'Home', href: '/' }, { label: 'Page not found' }]} />
          <div className="hero__lead">
            <p className="hero__eyebrow">404</p>
            <h1 className="hero__h1">We could not find that page</h1>
            <p className="hero__sub">
              The link may be old or mistyped. Search Universta, or continue from one of these pages.
            </p>
          </div>
          <form className="bigsearch h-bigsearch" action="/search" method="get" role="search">
            <input
              className="bigsearch__input"
              type="search"
              name="q"
              placeholder="Search Universta"
              aria-label="Search Universta"
              autoComplete="off"
            />
            <button className="btn btn--sm" type="submit">
              Search
            </button>
          </form>
        </div>
      </section>

      <section className="sec sec--white sec--tight h-sec">
        <div className="wrap">
          <div className="h-head">
            <p className="eyebrow eyebrow--plain">Popular</p>
            <h2 className="sec-title">Popular places to start</h2>
          </div>
          <div className="h-grid h-grid--4">
            {PLACES.map(([href, title, body]) => (
              <Link className="h-card" href={href} key={href}>
                <strong className="h-card__t">{title}</strong>
                <span className="h-card__d">{body}</span>
              </Link>
            ))}
          </div>
          <p className="h-more">
            <Link className="linkcta" href="/contact">
              Contact Universta <span className="linkcta__arrow" aria-hidden="true">&rarr;</span>
            </Link>
            <Link className="linkcta" href="/faq">
              Read the FAQ <span className="linkcta__arrow" aria-hidden="true">&rarr;</span>
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
