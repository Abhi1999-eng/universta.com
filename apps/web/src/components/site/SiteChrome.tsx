'use client';

import Link from 'next/link';
import { useState } from 'react';

type SiteIconName = 'cap' | 'book' | 'globe' | 'menu' | 'close' | 'arrow' | 'search' | 'facebook' | 'instagram' | 'linkedin' | 'youtube';

const sitePaths: Record<SiteIconName, string> = {
  cap: 'M22 10 12 5 2 10l10 5 10-5zM6 12v5c0 1 2.7 3 6 3s6-2 6-3v-5',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z',
  globe: 'M2 12h20M12 2a15 15 0 0 1 0 20M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M18 6 6 18M6 6l12 12',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  search: 'm21 21-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14',
  facebook: 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z',
  instagram: 'M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM17.5 6.5h.01',
  linkedin: 'M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM10 9h3.6v1.7h.05c.5-.9 1.7-1.9 3.5-1.9 3.7 0 4.4 2.4 4.4 5.6V21h-4v-5.5c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V21h-4z',
  youtube: 'M22 12s0-3.5-.4-5.1a2.8 2.8 0 0 0-2-2C17.9 4.5 12 4.5 12 4.5s-5.9 0-7.6.4a2.8 2.8 0 0 0-2 2C2 8.5 2 12 2 12s0 3.5.4 5.1a2.8 2.8 0 0 0 2 2c1.7.4 7.6.4 7.6.4s5.9 0 7.6-.4a2.8 2.8 0 0 0 2-2C22 15.5 22 12 22 12zM10 15.5v-7l6 3.5z',
};

function SiteIcon({ name, size = 18 }: { name: SiteIconName; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={sitePaths[name]} />
    </svg>
  );
}

const primaryNav: Array<{ label: string; href: string }> = [
  { label: 'Countries', href: '/countries' },
  { label: 'Subjects', href: '/subjects' },
  { label: 'Courses', href: '/courses' },
];

export function SiteHeader({ active }: { active?: 'countries' | 'subjects' | 'courses' }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="uv-header">
      <div className="uv-wrap uv-header-inner">
        <Link href="/" className="uv-logo">
          <span className="uv-logo-mark"><SiteIcon name="cap" size={18} /></span>
          <span>UNIVERSTA<small>Your Journey. Our Mission.</small></span>
        </Link>
        <nav className="uv-nav" aria-label="Primary">
          {primaryNav.map((item) => (
            <Link href={item.href} key={item.href} aria-current={active === item.label.toLowerCase() ? 'page' : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="uv-header-right">
          <Link href="/counselling" className="uv-btn uv-btn-primary uv-btn-sm">Book Free Counselling</Link>
          <button type="button" className="uv-toggle" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            <SiteIcon name={open ? 'close' : 'menu'} size={20} />
          </button>
        </div>
      </div>
      {open ? (
        <nav className="uv-wrap" aria-label="Mobile primary" style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 16 }}>
          {primaryNav.map((item) => (
            <Link href={item.href} key={item.href} onClick={() => setOpen(false)} style={{ padding: '10px 4px', fontWeight: 600, color: 'var(--uv-ink)' }}>
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}

export function SiteBreadcrumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <div className="uv-wrap uv-crumbs">
      <nav aria-label="Breadcrumb">
        <ol>
          {items.map((item, index) => (
            <li key={item.label} aria-current={index === items.length - 1 ? 'page' : undefined} style={{ display: 'contents' }}>
              {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
              {index < items.length - 1 ? <span className="sep">/</span> : null}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}

const footerColumns: Array<[string, Array<{ label: string; href: string }>]> = [
  ['Explore', [
    { label: 'Countries', href: '/countries' },
    { label: 'Subjects', href: '/subjects' },
    { label: 'Courses', href: '/courses' },
  ]],
  ['Guidance', [
    { label: 'Book Free Counselling', href: '/counselling' },
  ]],
];

export function SiteFooter() {
  return (
    <footer className="uv-footer">
      <div className="uv-wrap">
        <div className="uv-foot-grid">
          <div className="uv-foot-brand">
            <Link href="/" className="uv-logo">
              <span className="uv-logo-mark"><SiteIcon name="cap" size={18} /></span>
              <span>UNIVERSTA<small>Your Journey. Our Mission.</small></span>
            </Link>
            <p>Structured, source-aware study abroad guidance — explore published countries, subjects and courses in one place.</p>
            <div className="uv-foot-social">
              <a href="#" aria-label="Facebook"><SiteIcon name="facebook" size={16} /></a>
              <a href="#" aria-label="Instagram"><SiteIcon name="instagram" size={16} /></a>
              <a href="#" aria-label="LinkedIn"><SiteIcon name="linkedin" size={16} /></a>
              <a href="#" aria-label="YouTube"><SiteIcon name="youtube" size={16} /></a>
            </div>
          </div>
          {footerColumns.map(([title, links]) => (
            <div className="uv-foot-col" key={title}>
              <h4>{title}</h4>
              <ul>
                {links.map((link) => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="uv-foot-bottom">
          <span>© {new Date().getFullYear()} Universta. Information may vary by institution, programme, applicant and policy — always verify with official sources.</span>
          <span>Made for students worldwide</span>
        </div>
      </div>
    </footer>
  );
}

export { SiteIcon };
export type { SiteIconName };
