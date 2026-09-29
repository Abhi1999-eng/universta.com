import Link from 'next/link';

/**
 * The reference's breadcrumb: slash-separated, the last step not a link.
 * One component so every page in the family spells it the same way.
 */
export function Crumbs({
  trail,
}: {
  trail: Array<{ label: string; href?: string }>;
}) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {trail.map((step, index) => (
        <span key={step.label + index}>
          {index > 0 ? (
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
          ) : null}
          {step.href ? (
            <Link href={step.href}>{step.label}</Link>
          ) : (
            <span aria-current="page">{step.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
