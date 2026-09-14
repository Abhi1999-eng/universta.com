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
  { label: 'Study Destinations', href: '/study-abroad' },
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
    <Link className="brand" href="/study-abroad">
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
              className="nav__globe"
              type="button"
              data-open-selector
              aria-haspopup="dialog"
              aria-expanded="false"
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
              </svg>
              <span className="nav__globe-label">Explore countries</span>
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
              aria-expanded="false"
              aria-label="Open menu"
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
                <path d="M3 6h18M3 12h18M3 18h18" />
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
              <h4>{column.title}</h4>
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
