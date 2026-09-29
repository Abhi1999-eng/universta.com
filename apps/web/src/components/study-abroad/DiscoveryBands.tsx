import Link from 'next/link';

/**
 * The two bands the reference closes almost every subject, specialization and
 * course page with.
 *
 * They are one file because they always travel together and because their copy
 * is the same everywhere bar the noun: keeping them apart invited six slightly
 * different versions of the same invitation.
 */

/** "Found your field?" — the navy band that hands you on to programme search. */
export function MatchBand({
  heading = 'Found your field?',
  lead = 'Now find universities and programmes that match your academic profile, budget and intake.',
  href,
}: {
  heading?: string;
  lead?: string;
  /** Where "Find my programmes" goes, already filtered where we can. */
  href: string;
}) {
  return (
    <section className="sec sec--navy sec--tight" id="find-programs">
      <div className="wrap">
        <div className="matchband">
          <div>
            <p className="eyebrow">
              <span className="eyebrow__n">Next</span> Programme discovery
            </p>
            <h2 className="matchband__h">{heading}</h2>
            <p className="sec-lead">{lead}</p>
          </div>
          <div className="matchband__cta">
            <Link className="btn btn--onnavy btn--lg btn--block" href={href}>
              Find my programmes{' '}
              <span className="btn__arrow" aria-hidden="true">
                →
              </span>
            </Link>
            <Link
              className="btn btn--onnavy-ghost btn--block"
              href="/contact"
              style={{ marginTop: 10 }}
            >
              Talk to a consultant{' '}
              <span className="btn__arrow" aria-hidden="true">
                →
              </span>
            </Link>
            <p className="matchband__note">
              Programme listings are built from what universities publish.
              Admission decisions are made by universities alone.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export type RelatedGroup = {
  title: string;
  items: Array<{ id: string; name: string; href: string }>;
};

/** "Explore next" — the closing band of cross-links. */
export function ConnectBand({
  actions,
  groups = [],
}: {
  actions: Array<{ href: string; label: string; ghost?: boolean }>;
  groups?: RelatedGroup[];
}) {
  const filled = groups.filter((group) => group.items.length > 0);
  return (
    <section className="sec sec--paper sec--tight h-connect" id="connect">
      <div className="wrap">
        <div className="h-next">
          <p className="eyebrow eyebrow--plain">Explore next</p>
          <div className="btn-row">
            {actions.map((action) => (
              <Link
                key={action.href + action.label}
                className={`btn btn--sm${action.ghost ? ' btn--ghost' : ''}`}
                href={action.href}
              >
                {action.label}
              </Link>
            ))}
          </div>
        </div>
        {filled.length ? (
          <div className="h-related">
            <h2 className="sec-title h-related__t">Related on Universta</h2>
            <div className="h-related__grid">
              {filled.map((group) => (
                <div className="h-relgroup" key={group.title}>
                  <h3 className="h-relgroup__t">
                    {group.title}{' '}
                    <span className="h-count__n">{group.items.length}</span>
                  </h3>
                  <ul className="h-list">
                    {group.items.slice(0, 6).map((item) => (
                      <li key={item.id}>
                        <Link href={item.href}>{item.name}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
