import Link from 'next/link';

/**
 * The header, mobile drawer and footer from the approved Study Abroad design.
 *
 * The export ships every navigation link as `href=", , , , , "` -- a template
 * artefact, not a destination. Those are replaced here with the routes this
 * site actually serves, and the three legal pages the design lists but the site
 * does not have yet are left out rather than pointed at a 404.
 */

export const PRIMARY = [
  { label: 'Destinations', href: '/study-abroad' },
  { label: 'Courses', href: '/courses' },
  { label: 'Universities', href: '/universities' },
  { label: 'Scholarships', href: '/scholarships' },
  { label: 'Success Stories', href: '/success-stories' },
  { label: 'How It Works', href: '/about' },
] as const;

const FOOTER_COLUMNS = [
  {
    title: 'Platform',
    links: [
      { label: 'All destinations', href: '/study-abroad' },
      { label: 'Courses', href: '/courses' },
      { label: 'Universities', href: '/universities' },
      { label: 'Cities', href: '/cities' },
      { label: 'How it works', href: '/about' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Scholarships', href: '/scholarships' },
      { label: 'Subjects', href: '/subjects' },
      { label: 'Events', href: '/events' },
      { label: 'Questions', href: '/faq' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Free counselling', href: '/counselling' },
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Careers', href: '/careers' },
    ],
  },
] as const;

function Brand() {
  return (
    <Link className="brand" href="/">
      <span className="brand__mark" aria-hidden="true">
        U
      </span>
      <span className="brand__name">Universta</span>
    </Link>
  );
}

export function StudyAbroadHeader() {
  return (
    <>
      <header className="nav">
        <div className="wrap nav__inner">
          <Brand />
          <nav className="nav__links" aria-label="Primary">
            {PRIMARY.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="nav__right">
            <button
              className="nav__search"
              type="button"
              data-open-selector
              aria-haspopup="dialog"
              aria-expanded="false"
              aria-label="Search destinations"
              title="Search destinations"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </button>
            <button className="btn btn--sm nav__cta" type="button" data-open-assessment>
              Check My Options{' '}
              <span className="btn__arrow" aria-hidden="true">
                &rarr;
              </span>
            </button>
            <button
              className="nav__burger"
              type="button"
              data-toggle-drawer
              aria-controls="sa-drawer"
              aria-expanded="false"
              aria-label="Open menu"
            >
              {/* Both icons ship; the stylesheet shows the one that matches
                  `aria-expanded`, which the shell keeps in step. */}
              <svg
                className="nav__burger-open"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
              <svg
                className="nav__burger-close"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </div>
      </header>

    </>
  );
}

export function StudyAbroadFooter() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer__top">
          <div className="footer__brand">
            <Brand />
            <p className="footer__note">
              Guidance for students planning to study abroad, from profile assessment to your
              first semester.
            </p>
            <p className="footer__tagline">Your country. Your options. Your plan.</p>
          </div>
          {FOOTER_COLUMNS.map((column) => (
            <div className="footer__col" key={column.title}>
              <h2>{column.title}</h2>
              <ul>
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="footer__bottom">
          <span>&copy; {new Date().getFullYear()} Universta. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
