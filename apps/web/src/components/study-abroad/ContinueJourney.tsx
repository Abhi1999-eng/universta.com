'use client';

import Link from 'next/link';
import { useEffect, useSyncExternalStore } from 'react';
import { SectionHead } from './SectionHead';
import {
  recentLabel,
  recentServerSnapshot,
  recentSnapshot,
  recordVisit,
  subscribeRecent,
  type RecentKind,
} from '@/lib/recent-visits';

/**
 * Records that this page was opened.
 *
 * Mounted by the pages worth returning to. It renders nothing -- it exists so
 * the home page's strip has something to show.
 */
export function RecordVisit({
  kind,
  href,
  title,
}: {
  kind: RecentKind;
  href: string;
  title: string;
}) {
  useEffect(() => {
    recordVisit({ kind, href, title });
  }, [kind, href, title]);
  return null;
}

/**
 * "Continue your journey": the last few pages this visitor opened.
 *
 * The list lives in their browser, so the server cannot render it. The section
 * stays out of the document until the first client pass has read storage,
 * which also keeps it from flashing an empty band for a first-time visitor --
 * the reference hides its own section the same way.
 */
export function ContinueJourney({ alt = false }: { alt?: boolean } = {}) {
  /* The list is browser state, not page state, so it is read as the external
     store it is: the server snapshot is empty, the client's is whatever that
     browser has stored, and React reconciles the difference itself. */
  const items = useSyncExternalStore(
    subscribeRecent,
    recentSnapshot,
    recentServerSnapshot,
  );

  if (!items.length) return null;

  return (
    <section
      className={`sec ${alt ? 'sec--paper' : 'sec--white'} sec--tight h-sec`}
      id="continue"
    >
      <div className="wrap">
        <SectionHead eyebrow="Continue" title="Continue your journey" />
        <div className="h-cont">
          {items.map((item) => (
            <Link className="h-cont__item" href={item.href} key={item.href}>
              <span className="h-cont__k">{recentLabel(item.kind)}</span>
              <span className="h-cont__t">{item.title}</span>
              <span className="h-cont__d">Pick up where you left off</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
