import Link from 'next/link';
import { StudyAbroadMegaMenu, type NavigationGroup } from './StudyAbroadMegaMenu';

/**
 * The approved export's navigation, with its links limited to pages this
 * product serves. Its institution and planning links also cover later phases,
 * so those menus lead to the existing directories and contact page here.
 */

export const PRIMARY = [
  { label: 'Destinations', href: '/study-abroad' },
  { label: 'Courses', href: '/courses' },
  { label: 'Universities', href: '/universities' },
  { label: 'Scholarships', href: '/scholarships' },
  { label: 'Success Stories', href: '/success-stories' },
  { label: 'How It Works', href: '/about' },
] as const;

export const NAVIGATION_GROUPS: readonly NavigationGroup[] = [
  {
    label: 'Study Abroad',
    description: 'Explore where and what to study',
    items: [
      { label: 'Destinations', href: '/study-abroad', description: 'Countries with universities, courses and costs' },
      { label: 'Universities', href: '/universities', description: 'Compare universities worldwide' },
      { label: 'Courses', href: '/courses', description: 'Find programmes by subject and level' },
      { label: 'Subjects', href: '/subjects', description: 'Browse subjects and career areas' },
      { label: 'Specializations', href: '/specializations', description: 'Narrow down within a subject' },
      { label: 'Scholarships', href: '/scholarships', description: 'Funding by country, level and subject' },
      { label: 'Consultants', href: '/study-abroad-consultants', description: 'Study abroad consultants by destination' },
      { label: 'Cities', href: '/cities', description: 'Explore places to study' },
    ],
  },
  {
    label: 'Tools',
    description: 'Plan, compare and check',
    items: [
      { label: 'Course Finder', href: '/courses', description: 'Filter programmes' },
      { label: 'University Finder', href: '/universities', description: 'Filter universities' },
      { label: 'Scholarship Finder', href: '/scholarships', description: 'Filter scholarships' },
      { label: 'University Compare', href: '/compare/universities', description: 'Compare universities side by side' },
      { label: 'Course Compare', href: '/compare/courses', description: 'Compare programmes side by side' },
      { label: 'Country Compare', href: '/compare/countries', description: 'Compare study destinations' },
      { label: 'Consultant Compare', href: '/compare/consultants', description: 'Compare consultant profiles' },
    ],
  },
  {
    label: 'Resources',
    description: 'Guides and answers',
    items: [
      { label: 'Country Guides', href: '/study-abroad', description: 'Explore study destinations' },
      { label: 'Success Stories', href: '/success-stories', description: 'Read student stories' },
      { label: 'Events', href: '/events', description: 'Browse upcoming events' },
      { label: 'FAQs', href: '/faq', description: 'Answers to common questions' },
    ],
  },
  {
    label: 'For Institutions',
    description: 'Connect with Universta',
    items: [
      { label: 'Universities', href: '/universities', description: 'Find a university profile and its claim option' },
      { label: 'Consultants', href: '/study-abroad-consultants', description: 'Explore consultant profiles' },
      { label: 'Contact', href: '/contact', description: 'Talk to Universta' },
    ],
  },
  {
    label: 'About',
    description: 'Universta',
    items: [
      { label: 'About Universta', href: '/about', description: 'Who we are' },
      { label: 'How It Works', href: '/about', description: 'Learn about Universta' },
      { label: 'Free counselling', href: '/counselling', description: 'Talk through your study plans' },
      { label: 'Contact', href: '/contact', description: 'Talk to Universta' },
      { label: 'Careers', href: '/careers', description: 'Explore opportunities' },
    ],
  },
];

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
          <StudyAbroadMegaMenu groups={NAVIGATION_GROUPS} />
          <div className="nav__right">
            <Link
              className="nav__search"
              href="/search"
              aria-label="Search Universta"
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <span className="nav__search-label">Search</span>
            </Link>
            <button
              className="nav__globe"
              type="button"
              data-open-selector
              aria-haspopup="dialog"
              aria-expanded="false"
              aria-label="Explore countries"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
              </svg>
              <span className="nav__globe-label">Explore countries</span>
            </button>
            <Link className="nav__account" href="/student/login">Log in</Link>
            <button className="btn btn--sm nav__cta" type="button" data-open-assessment>
              Start My Journey{' '}
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
