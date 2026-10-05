'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { DestinationDirectory } from '@/lib/study-abroad';
import { PRIMARY, StudyAbroadFooter, StudyAbroadHeader } from './StudyAbroadChrome';
import { AssessmentDialog } from './AssessmentDialog';
import { FlagMark } from './FlagMark';
import { searchDestinations } from '@/lib/study-abroad-view';
import type { SearchGroup } from '@/lib/search';

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
  /** The page the lead is filed under, when it is not the country's guide:
   *  a university's page, so the counsellor sees which institution the
   *  student was reading about. */
  sourcePagePath?: string;
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

/* Matches the search API: two letters match half the catalogue and say
   nothing. Destinations keep matching from the first keystroke -- that list
   is already in the browser and costs no request. */
const MIN_SEARCH = 3;
const SEARCH_DEBOUNCE_MS = 180;

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

  /* Opened anywhere on a country guide, the assessment belongs to that country:
   * its destination step arrives answered and the lead records the guide it
   * came from. The page's own buttons are plain markup that only name their
   * intent, so the country comes from the address at the moment of opening. */
  const openAssessment = useCallback((context?: AssessmentContext) => {
    setDrawerOpen(false);
    setSelectorOpen(false);
    const pageCountry = window.location.pathname.match(/^\/study-abroad\/([^/]+)\/?$/)?.[1];
    setAssessment({ ...(pageCountry ? { countrySlug: pageCountry } : {}), ...context });
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

  /* The header is static markup, so the state its buttons announce is kept in
   * step here. Without this the menu button said "Open menu", collapsed, with
   * the drawer open, and showed no way to close it. */
  useEffect(() => {
    const burger = document.querySelector<HTMLElement>('.sa [data-toggle-drawer]');
    burger?.setAttribute('aria-expanded', String(drawerOpen));
    burger?.setAttribute('aria-label', drawerOpen ? 'Close menu' : 'Open menu');
  }, [drawerOpen]);
  useEffect(() => {
    document
      .querySelectorAll<HTMLElement>('.sa [data-open-selector][aria-expanded]')
      .forEach((button) => button.setAttribute('aria-expanded', String(selectorOpen)));
  }, [selectorOpen]);

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
  const matches = useMemo(() => searchDestinations(all, query).slice(0, 40), [all, query]);

  /* The header's magnifier replaced the "Explore countries" pill, and with it
     the panel only ever searched countries -- so typing "computer" into the
     one search control on the page answered "No destination matches that
     name", while the catalogue search that does answer it sat on the home
     page and on /search where nobody looked for it.
     
     The destinations stay matched in the browser, instantly and without a
     request, because choosing a destination is what this panel is for. What
     the catalogue knows is fetched and shown underneath. */
  const term = query.trim();
  const tooShort = term.length < MIN_SEARCH;
  const [fetched, setFetched] = useState<SearchGroup[]>([]);
  /* Derived during render rather than cleared from inside the effect: setting
     state synchronously in an effect is a cascading render, and there is
     nothing to record anyway -- a query this short simply has no results. */
  const groups = selectorOpen && !tooShort ? fetched : [];
  useEffect(() => {
    if (!selectorOpen || tooShort) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/search?q=${encodeURIComponent(term)}`, {
        signal: controller.signal,
      })
        .then((response) => response.json())
        .then((body: { data?: { groups?: SearchGroup[] } }) =>
          /* Countries are already on screen, matched locally and with their
             flags, so the group that repeats them is dropped. */
          setFetched(
            (body.data?.groups ?? []).filter((group) => group.type !== 'country'),
          ),
        )
        /* An aborted request is the next keystroke, not a failure; anything
           else leaves the destinations showing rather than an error. */
        .catch(() => undefined);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [term, tooShort, selectorOpen]);
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

      {/* The drawer holds this route family's primary links, so it is the
          mobile navigation landmark rather than an unnamed div -- the same
          identity the shared chrome's drawer exposes. */}
      <nav
        className="drawer"
        id="sa-drawer"
        aria-label="Mobile navigation"
        data-drawer
        data-open={String(drawerOpen)}
        aria-hidden={!drawerOpen}
      >
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
      </nav>

      <div
        className="cs"
        data-selector
        data-open={String(selectorOpen)}
        role="dialog"
        aria-modal="true"
        aria-label="Search Universta"
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
              placeholder="Search countries, courses, universities, scholarships…"
              aria-label="Search Universta"
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
            {matches.length === 0 && groups.length === 0 ? (
              <p className="cs__empty">
                {tooShort
                  ? 'No destination matches that name.'
                  : `Nothing in the catalogue matches "${term}".`}
              </p>
            ) : null}
            {matches.length ? (
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
                        <FlagMark iso2Code={entry.iso2Code} bands={entry.bands} />
                        <span className="cs__item-name">{entry.name}</span>
                        <span className="cs__item-meta">Guide</span>
                      </Link>
                    ) : (
                      <span className="cs__item cs__item--soon" key={entry.name} aria-disabled="true">
                        <FlagMark iso2Code={entry.iso2Code} bands={entry.bands} />
                        <span className="cs__item-name">{entry.name}</span>
                        <span className="cs__item-meta">Soon</span>
                      </span>
                    ),
                  )}
                </div>
              </>
            ) : null}

            {groups.map((group) => (
              <div key={group.type}>
                <p className="cs__grouptitle">{group.label}</p>
                <div className="cs__grid">
                  {group.items.map((item) => (
                    <Link
                      className="cs__item"
                      key={item.id}
                      href={item.href}
                      onClick={closeSelector}
                    >
                      <span className="cs__item-name">{item.label}</span>
                      {item.meta ? (
                        <span className="cs__item-meta">{item.meta}</span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="cs__foot">
            <span className="cs__count">
              {destinations
                ? `${destinations.counts.available} guides · ${destinations.counts.total} destinations`
                : ''}
            </span>
            <Link className="linkcta" href="/study-abroad" onClick={closeSelector}>
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
