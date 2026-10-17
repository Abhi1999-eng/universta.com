'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteLevelPage, listLevelPages } from './catalog-client';
import type { LevelPageOwner, LevelPageRow } from './catalog.types';
import { CatalogDialog, CatalogError } from './CatalogDialog';
import { catalogErrorText } from './catalog-errors';
import { levelPageEditorHref, levelPagesAnchor, levelSourcesHint } from './level-pages';
import { RowMenu, StatusBadge, Toasts, ViewOnSite, useToasts } from '@/features/shared/records-ui';
import { useHandedOverToast } from '@/features/shared/Flash';

type Loaded = { key: string; rows: LevelPageRow[] | null; error: string };

/**
 * The pages a subject or a specialization has, one per study level it is
 * offered at, on the owner's own editor. Each page is written on a page of
 * its own (the level-page editor); this card lists them, says what each has,
 * and deletes what was written.
 *
 * The rows come from the API, which decides which levels are offered; the
 * admin never works that out itself. A page kept for a level that is no
 * longer offered stays listed, off the site, so it can still be deleted.
 *
 * The card sits inside the owner's <form>, so every button in it -- the menu,
 * the dialog -- is type="button": none of them may submit the subject.
 */
export function LevelPagesCard({
  owner,
  ownerId,
  ownerName,
  ownerPublished,
  refreshKey,
  ticksChanged,
  parentDirty,
}: {
  owner: LevelPageOwner;
  /** Unset until the owner has been saved once. */
  ownerId?: string;
  ownerName: string;
  ownerPublished: boolean;
  /** Bumped by the owner after each save, to read the rows again. */
  refreshKey: number;
  /** The study-level ticks differ from the saved ones. */
  ticksChanged: boolean;
  /** The owner's form has unsaved edits. */
  parentDirty: boolean;
}) {
  const noun = owner === 'subject' ? 'subject' : 'specialization';
  const anchor = levelPagesAnchor(owner);
  const [attempt, setAttempt] = useState(0);
  const key = `${owner}:${ownerId ?? ''}:${refreshKey}:${attempt}`;
  const [loaded, setLoaded] = useState<Loaded>({ key: '', rows: null, error: '' });
  const [pending, setPending] = useState<LevelPageRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toasts, push: toast, dismiss } = useToasts();
  /* Publishing a level page comes back here; the editor's confirmation shows
     as the green corner toast, as it does on the lists. */
  const showPublished = useCallback((message: string) => toast('success', message), [toast]);
  useHandedOverToast(showPublished);
  const fieldset = useRef<HTMLFieldSetElement>(null);
  const scrolled = useRef(false);

  useEffect(() => {
    if (!ownerId) return undefined;
    let active = true;
    listLevelPages(owner, ownerId)
      .then((result) => {
        if (active) setLoaded({ key, rows: result.data, error: '' });
      })
      .catch((cause: unknown) => {
        if (active) setLoaded({ key, rows: null, error: catalogErrorText(cause, 'Unable to load level pages') });
      });
    return () => {
      active = false;
    };
  }, [owner, ownerId, key]);

  /* Sent back from the editor to this card (#subject-level-pages): the form
     above it is long, so the card is brought into view once its rows are in. */
  useEffect(() => {
    if (scrolled.current || !loaded.rows) return;
    scrolled.current = true;
    if (window.location.hash === `#${anchor}`) fieldset.current?.scrollIntoView({ block: 'start' });
  }, [loaded.rows, anchor]);

  const reload = () => setAttempt((value) => value + 1);

  async function remove(row: LevelPageRow) {
    if (!ownerId || !row.page) return;
    setDeleting(true);
    try {
      await deleteLevelPage(owner, ownerId, row.level.id, row.page.updatedAt);
      toast('ok', `${row.level.name} page content deleted.`);
      reload();
    } catch (cause: unknown) {
      toast('error', `${row.level.name} page: ${catalogErrorText(cause, 'content not deleted')}`);
    } finally {
      setDeleting(false);
      setPending(null);
    }
  }

  /* Client-side navigation skips the browser's leave-page warning, so the
     owner's unsaved edits would go without a word. */
  const confirmLeave = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (parentDirty && !window.confirm(`Leave this ${noun} without saving your changes?`)) event.preventDefault();
  };

  const rows = loaded.rows;
  const settled = loaded.key === key;

  return (
    <fieldset id={anchor} ref={fieldset} className="p-panel">
      <legend className="sr-only">Level pages</legend>
      <p className="p-eyebrow">Study levels</p>
      <h3 className="mt-2 text-xl font-semibold">Level pages</h3>
      <p className="p-sub">
        {!ownerId
          ? `Save the ${noun} first; a page can then be written for each study level it is offered at.`
          : `One page for each study level this ${noun} is offered at. Each page already lists its programmes; write an intro, notes and FAQs to give it words of its own.`}
      </p>
      {ownerId && ticksChanged ? <p className="p-hint mt-2">Study level changes show here after you save.</p> : null}

      {ownerId ? (
        <div className="mt-6">
          {settled && loaded.error ? (
            <CatalogError message={loaded.error} onRetry={reload} />
          ) : !rows ? (
            <p className="p-hint" role="status">Loading level pages…</p>
          ) : rows.length === 0 ? (
            <div className="p-card p-sub">
              No study level is offered yet. Tick a level under Study levels and save; a level with a published course shows here on its own.
            </div>
          ) : (
            <ul className="divide-y divide-[#E8ECF3] rounded-xl border border-[#E8ECF3]">
              {rows.map((row) => {
                const page = row.page;
                const verb = page ? 'Edit' : 'Write';
                return (
                  <li key={row.level.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <span className="font-semibold">{row.level.name}</span>
                      <span className="p-hint ml-2 break-all">{row.path}</span>
                      {ownerPublished && row.offered ? <span className="ml-2"><ViewOnSite path={row.path} /></span> : null}
                      {row.offered && row.sources.length ? <p className="p-hint">{levelSourcesHint(row.sources)}</p> : null}
                      {page ? (
                        <p className="p-hint">
                          {page.hasIntro ? 'Intro' : 'No intro'} · {page.faqCount} FAQ{page.faqCount === 1 ? '' : 's'}
                        </p>
                      ) : null}
                      {page?.searchReady ? (
                        <span className="p-chip mt-1 text-xs font-normal" title="Its own words let search engines index this page before it lists any programmes.">
                          Search-ready
                        </span>
                      ) : null}
                      {!row.offered ? (
                        <span className="p-chip mt-1 text-xs font-normal" title="This level is not offered here any more, so the page is not on the site. Its content is kept until you delete it.">
                          Not offered now
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      {page ? <StatusBadge status={page.status} /> : <span className="p-chip">Not written</span>}
                      {row.offered || page ? (
                        /* Named in full, "Edit the Master's page": a row of
                           links all called "Edit" says nothing on its own.
                           The full name is the aria-label; the button shows
                           only the verb. */
                        <Link
                          href={levelPageEditorHref(owner, ownerId, row.level.id)}
                          className="p-btn p-btn--ghost p-btn--sm"
                          aria-label={`${verb} the ${row.level.name} page`}
                          onClick={confirmLeave}
                        >
                          {verb}
                        </Link>
                      ) : null}
                      {page ? (
                        <RowMenu
                          label={`More actions for the ${row.level.name} page`}
                          items={[{ label: 'Delete content', danger: true, onSelect: () => setPending(row) }]}
                        />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {pending ? (
        <CatalogDialog
          title="Delete this level page's content?"
          description={`The intro, notes, FAQs and SEO written for ${pending.level.name} in ${ownerName} are removed for good.${pending.offered ? ' The page itself stays on the site while the level is offered, with its programmes and the standard text.' : ''}`}
          onClose={() => setPending(null)}
        >
          <div className="p-row p-row--wrap">
            <button type="button" className="p-btn p-btn--ghost" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button type="button" className="p-btn p-btn--danger" disabled={deleting} onClick={() => void remove(pending)}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </CatalogDialog>
      ) : null}
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </fieldset>
  );
}
