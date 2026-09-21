'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { DestinationDirectory } from '@/lib/study-abroad';
import { PRIMARY, StudyAbroadFooter, StudyAbroadHeader } from './StudyAbroadChrome';
import { AssessmentDialog } from './AssessmentDialog';
import { FlagMark } from './FlagMark';

/**
 * The interactive frame every Study Abroad page sits inside: the mobile drawer,
 * the country selector and the assessment.
 *
 * The approved export wires these with `data-` attributes and a global script.
 * They are state here instead, so a dialog cannot be left open across a
 * navigation and the buttons in the header, the page body and the sticky mobile
 * bar can all reach the same assessment without addressing each other.
 */

type ShellApi = {
  openAssessment: (context?: AssessmentContext) => void;
  openSelector: () => void;
};

export type AssessmentContext = {
  /** The country whose page the assessment was opened from, if any. */
  countrySlug?: string;
  countryName?: string;
  /** Which control opened it, for the counsellor's context. */
  intent?: string;
};

const ShellContext = createContext<ShellApi | null>(null);

export function useStudyAbroadShell(): ShellApi {
  const api = useContext(ShellContext);
  if (!api)
    throw new Error('useStudyAbroadShell must be used inside StudyAbroadShell');
  return api;
}

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [locked]);
}

/** Closes on Escape, so every dialog here behaves the same way. */
function useEscape(active: boolean, close: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, close]);
}

export function StudyAbroadShell({
  destinations,
  children,
}: {
  destinations: DestinationDirectory | null;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [assessment, setAssessment] = useState<AssessmentContext | null>(null);
  const [query, setQuery] = useState('');

  const openAssessment = useCallback((context?: AssessmentContext) => {
    setDrawerOpen(false);
    setSelectorOpen(false);
    setAssessment(context ?? {});
  }, []);
  const openSelector = useCallback(() => {
    setDrawerOpen(false);
    setSelectorOpen(true);
  }, []);
  const closeSelector = useCallback(() => setSelectorOpen(false), []);
  const selectorInput = useRef<HTMLInputElement>(null);

  useBodyScrollLock(selectorOpen || assessment !== null || drawerOpen);
  useEscape(selectorOpen, closeSelector);
  useEscape(drawerOpen, () => setDrawerOpen(false));

  /* The header opens this from a search icon, so typing is the next thing the
   * student does. Focus goes back to whatever opened it on close, rather than
   * being dropped on the body when the dialog hides. */
  useEffect(() => {
    if (!selectorOpen) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    selectorInput.current?.focus();
    return () => opener?.focus();
  }, [selectorOpen]);

  /* The header ships as static markup so it is in the first response. The few
   * controls that need behaviour are found by the attribute the design already
   * gives them, rather than duplicating the markup as JSX twice. */
  useEffect(() => {
    const root = document.querySelector('.sa');
    if (!root) return;
    const onClick = (event: Event) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        '[data-open-assessment],[data-open-selector],[data-toggle-drawer],[data-close-drawer]',
      );
      if (!target) return;
      event.preventDefault();
      if (target.hasAttribute('data-open-assessment'))
        openAssessment({ intent: target.dataset.intent });
      else if (target.hasAttribute('data-open-selector')) openSelector();
      else if (target.hasAttribute('data-toggle-drawer')) setDrawerOpen((open) => !open);
      else setDrawerOpen(false);
    };
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, [openAssessment, openSelector]);

  const all = useMemo(
    () => [...(destinations?.available ?? []), ...(destinations?.comingSoon ?? [])],
    [destinations],
  );
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const pool = needle
      ? all.filter((entry) => entry.name.toLowerCase().includes(needle))
      : all.filter((entry) => entry.isAvailable);
    return pool.slice(0, 40);
  }, [all, query]);
  /* The approved selector heads its grid the same way: what the list is before
   * a search, and how much matched after one. */
  const matchesTitle = query.trim()
    ? `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}`
    : 'Country guides';

  const api = useMemo<ShellApi>(() => ({ openAssessment, openSelector }), [
    openAssessment,
    openSelector,
  ]);

  return (
    <ShellContext.Provider value={api}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <StudyAbroadHeader />

      <div className="drawer" data-drawer data-open={String(drawerOpen)} aria-hidden={!drawerOpen}>
        {PRIMARY.map((item) => (
          <Link key={item.href} href={item.href} onClick={() => setDrawerOpen(false)}>
            {item.label}
          </Link>
        ))}
        <div className="drawer__cta">
          <button
            className="btn btn--block btn--lg"
            type="button"
            onClick={() => openAssessment({ intent: 'drawer' })}
          >
            Build My Study Plan{' '}
            <span className="btn__arrow" aria-hidden="true">
              &rarr;
            </span>
          </button>
        </div>
      </div>

      <div
        className="cs"
        data-selector
        data-open={String(selectorOpen)}
        role="dialog"
        aria-modal="true"
        aria-label="Choose a study destination"
        aria-hidden={!selectorOpen}
      >
        <div className="cs__scrim" onClick={closeSelector} />
        <div className="cs__panel">
          <div className="cs__head">
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#667085"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              ref={selectorInput}
              className="cs__input"
              type="search"
              placeholder="Where do you want to study?"
              aria-label="Search countries"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button className="cs__close" type="button" onClick={closeSelector} aria-label="Close">
              &times;
            </button>
          </div>

          <div className="cs__body">
            {matches.length === 0 ? (
              <p className="cs__empty">No destination matches that name.</p>
            ) : (
              <>
                <p className="cs__grouptitle">{matchesTitle}</p>
                <div className="cs__grid">
                  {matches.map((entry) =>
                    entry.slug ? (
                      <Link
                        className="cs__item"
                        key={entry.name}
                        href={`/study-abroad/${entry.slug}`}
                        onClick={closeSelector}
                      >
                        <FlagMark name={entry.name} iso2Code={entry.iso2Code} bands={entry.bands} />
                        <span className="cs__item-name">{entry.name}</span>
                        <span className="cs__item-meta">Guide</span>
                      </Link>
                    ) : (
                      <span className="cs__item cs__item--soon" key={entry.name} aria-disabled="true">
                        <FlagMark name={entry.name} iso2Code={entry.iso2Code} bands={entry.bands} />
                        <span className="cs__item-name">{entry.name}</span>
                        <span className="cs__item-meta">Soon</span>
                      </span>
                    ),
                  )}
                </div>
              </>
            )}
          </div>

          <div className="cs__foot">
            <span className="cs__count">
              {destinations
                ? `${destinations.counts.available} guides · ${destinations.counts.total} destinations`
                : ''}
            </span>
            <Link className="linkcta" href="/" onClick={closeSelector}>
              All countries{' '}
              <span className="linkcta__arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
          </div>
        </div>
      </div>

      <main id="main">{children}</main>
      <StudyAbroadFooter />

      {assessment ? (
        <AssessmentDialog
          context={assessment}
          destinations={destinations?.available}
          onClose={() => setAssessment(null)}
        />
      ) : null}
    </ShellContext.Provider>
  );
}
