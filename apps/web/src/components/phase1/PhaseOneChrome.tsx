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

/** The shared public breadcrumb.
 *
 * The separator is drawn by CSS rather than shipped as a literal "/" text
 * node: the markup previously emitted one, and because the only `.crumbs`
 * rules lived inside `@scope (.visual-courses-page)` in visual-reference.css,
 * every page outside that scope fell back to a default <ol> and rendered the
 * trail as a vertical stack of "/Label" lines. The unscoped rules now live in
 * phase1-shared-template.css. The final crumb carries aria-current="page" so
 * the trail matches the listing pages it sits alongside. */
export function Crumbs({ items }: { items: Array<[string, string?]> }) {
  return (
    <div className="shell crumbs">
      <nav aria-label="Breadcrumb">
        <ol>
          {items.map(([label, href], index) => (
            <li key={`${label}-${index}`}>
              {href ? (
                <Link href={href}>{label}</Link>
              ) : (
                <span aria-current={index === items.length - 1 ? 'page' : undefined}>{label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
