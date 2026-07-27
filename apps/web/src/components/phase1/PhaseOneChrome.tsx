import Link from 'next/link';

const links = [
  ['Countries', '/countries'], ['Universities', '/universities'], ['Subjects', '/subjects'], ['Courses', '/courses'], ['Scholarships', '/scholarships'], ['Consultants', '/study-abroad-consultants'],
] as const;

export function PhaseOneHeader() {
  return <header className="site-header"><div className="shell header-inner"><Link className="brand" href="/">universta<span>.</span></Link><nav aria-label="Primary navigation">{links.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}<Link href="/counselling">Counselling</Link></nav></div></header>;
}

export function PhaseOneFooter() {
  return <footer className="site-footer"><div className="shell footer-grid"><div><Link className="brand" href="/">universta<span>.</span></Link><p>Published study-abroad information, maintained as source-aware local Phase 1 content.</p></div><nav aria-label="Footer navigation"><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/faq">FAQ</Link><Link href="/careers">Careers</Link><Link href="/events">Events</Link></nav></div></footer>;
}

export function Crumbs({ items }: { items: Array<[string, string?]> }) {
  return <div className="shell crumbs"><nav aria-label="Breadcrumb"><ol>{items.map(([label, href], index) => <li key={`${label}-${index}`}>{index ? <span className="sep">/</span> : null}{href ? <Link href={href}>{label}</Link> : label}</li>)}</ol></nav></div>;
}
