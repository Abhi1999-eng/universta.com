import Link from 'next/link';

/** Legacy per-template chrome. The public Header and Footer are now rendered
 * once in the root layout from Admin-managed navigation and settings
 * (see components/chrome/SiteChrome.tsx), so these render nothing. They are
 * kept as no-ops so the page templates that still call them compile unchanged
 * and cannot reintroduce a second, divergent header. */

export function PhaseOneHeader() {
  return null;
}

export function PhaseOneFooter() {
  return null;
}

/** Breadcrumbs are page content, not site chrome, so this one is unchanged. */
export function Crumbs({ items }: { items: Array<[string, string?]> }) {
  return <div className="shell crumbs"><nav aria-label="Breadcrumb"><ol>{items.map(([label, href], index) => <li key={`${label}-${index}`}>{index ? <span className="sep">/</span> : null}{href ? <Link href={href}>{label}</Link> : label}</li>)}</ol></nav></div>;
}
