'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteLevelPage, listLevelPages } from './catalog-client';
import type { LevelPageOwner, LevelPageRow, MasterRecord } from './catalog.types';
import { CatalogDialog, CatalogError } from './CatalogDialog';
import { catalogErrorText } from './catalog-errors';
import { levelPageEditorHref, levelPagesAnchor, levelSourcesHint, liveLevelRows, type LiveLevelRow } from './level-pages';
import { RowMenu, StatusBadge, Toasts, ViewOnSite, useToasts } from '@/features/shared/records-ui';
import { useHandedOverToast } from '@/features/shared/Flash';

type Loaded = { key: string; rows: LevelPageRow[] | null; error: string };

/**
 * The pages a subject or a specialization has, one per study level it is
 * offered at, on the owner's own editor. Each page is written on a page of
 * its own (the level-page editor); this card lists them, says what each has,
 * and deletes what was written.
 *
 * The rows come from the API, which decides which levels are offered as
 * things are saved. A page kept for a level that is no longer offered stays
 * listed, off the site, so it can still be deleted.
 *
 * The rows also follow the study-level ticks above as they are clicked, not
 * only once saved: a level ticked appears at once, marked "Not saved yet",
 * with "Save and write", and a level unticked is marked as leaving. A page
 * can only be written for a level that is saved as offered (the API refuses
 * the rest), so "Save and write" saves the owner first and then opens the
 * page's editor.
 *
 * The card sits inside the owner's <form>. Every button in it -- the menu,
 * the dialog -- is type="button", except "Save and write", which submits the
 * owner on purpose: its value, `write:<level id>`, tells the owner's submit
 * to keep the record's status and open that level's page once saved.
 */
export function LevelPagesCard({
  owner,
  ownerId,
  ownerName,
  ownerPublished,
  refreshKey,
  levels,
  ticked,
  savedTicked,
  basePath,
  parentDirty,
}: {
  owner: LevelPageOwner;
  /** Unset until the owner has been saved once. */
  ownerId?: string;
  ownerName: string;
  ownerPublished: boolean;
  /** Bumped by the owner after each save, to read the rows again. */
  refreshKey: number;
  /** The active levels the ticks above are drawn from, in their order. */
  levels: MasterRecord[];
  /** The study-level ticks as they stand, and as last saved. */
  ticked: string[];
  savedTicked: string[];
  /** The owner's public address, `/subjects/computing`, for a level ticked
   * and not saved yet; null while a new record has no slug. */
  basePath: string | null;
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

  const settled = loaded.key === key;
  /* A record not saved yet has no rows of its own; its ticks still show. */
  const apiRows = ownerId ? loaded.rows : [];
  const rows = apiRows ? liveLevelRows({ rows: apiRows, levels, ticked, savedTicked, basePath }) : null;
  /* Only rows that carry the "Not saved yet" chip; a leaving row says what
     the save does in its own words. */
  const changed = rows ? rows.some((row) => row.unsaved && row.state !== 'leaving') : false;

  return (
    <fieldset id={anchor} ref={fieldset} className="p-panel">
      <legend className="sr-only">Level pages</legend>
      <p className="p-eyebrow">Study levels</p>
      <h3 className="mt-2 text-xl font-semibold">Level pages</h3>
      <p className="p-sub">
        {`One page for each study level this ${noun} is offered at. Each page already lists its programmes; write an intro, notes and FAQs to give it words of its own.`}
      </p>
      {changed ? (
        <p className="p-hint mt-2">
          Rows marked “Not saved yet” follow your study level ticks. Saving keeps them; “Save and write” saves and opens the page.
        </p>
      ) : null}

      <div className="mt-6">
        {ownerId && settled && loaded.error ? (
          <CatalogError message={loaded.error} onRetry={reload} />
        ) : !rows ? (
          <p className="p-hint" role="status">Loading level pages…</p>
        ) : rows.length === 0 ? (
          <div className="p-card p-sub">
            {ownerId
              ? 'No study level is offered yet. Tick a level under Study levels above and it shows here, ready to write; a level with a published course shows here on its own.'
              : `No study level is ticked yet. Tick a level under Study levels above and it shows here; “Save and write” saves the ${noun} and opens its page.`}
          </div>
        ) : (
          <ul className="divide-y divide-[#E8ECF3] rounded-xl border border-[#E8ECF3]">
            {rows.map((row) => (
              <LevelRow
                key={row.level.id}
                row={row}
                noun={noun}
                ownerId={ownerId}
                ownerPublished={ownerPublished}
                editorHref={ownerId ? levelPageEditorHref(owner, ownerId, row.level.id) : null}
                confirmLeave={confirmLeave}
                onDelete={() => {
                  const stored = loaded.rows?.find((item) => item.level.id === row.level.id);
                  if (stored) setPending(stored);
                }}
              />
            ))}
          </ul>
        )}
      </div>

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

/** One level's row: what it has, where it stands against the ticks, and the
 * way to write it. */
function LevelRow({
  row,
  noun,
  ownerId,
  ownerPublished,
  editorHref,
  confirmLeave,
  onDelete,
}: {
  row: LiveLevelRow;
  noun: string;
  ownerId?: string;
  ownerPublished: boolean;
  editorHref: string | null;
  confirmLeave: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  onDelete: () => void;
}) {
  const { page, level, state } = row;
  const verb = page ? 'Edit' : 'Write';
  /* Written only once the level is saved as offered: before that the page
     editor would refuse it. */
  const needsSave = state === 'new' || state === 'returning';
  const leaving = state === 'leaving';
  /* An unticked level with nothing written leaves the list on save; one with
     a written page stays listed, off the site, as "Not offered now". */
  const leavesList = leaving && !page;
  return (
    <li className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3${leaving ? ' bg-[#F7F8FA]' : ''}`} data-level-row={level.name}>
      <div className="min-w-0">
        <span className={`font-semibold${leaving ? ' text-[#667085]' : ''}${leavesList ? ' line-through' : ''}`}>{level.name}</span>
        {row.path ? <span className="p-hint ml-2 break-all">{row.path}</span> : null}
        {ownerPublished && row.offered && !leaving && row.path ? <span className="ml-2"><ViewOnSite path={row.path} /></span> : null}
        {!leaving && row.sources.length ? <p className="p-hint">{levelSourcesHint(row.sources)}</p> : null}
        {leaving ? (
          <p className="p-hint">
            {page
              ? 'Unticked. Its page goes off the site when you save; what is written is kept.'
              : 'Unticked. It leaves this list when you save.'}
          </p>
        ) : null}
        {state === 'returning' ? <p className="p-hint">Ticked again. Its page is back on the site when you save.</p> : null}
        {page ? (
          <p className="p-hint">
            {page.hasIntro ? 'Intro' : 'No intro'} · {page.faqCount} FAQ{page.faqCount === 1 ? '' : 's'}
          </p>
        ) : null}
        {page?.searchReady && !leaving ? (
          <span className="p-chip mt-1 text-xs font-normal" title="Its own words let search engines index this page before it lists any programmes.">
            Search-ready
          </span>
        ) : null}
        {state === 'saved' && !row.offered ? (
          <span className="p-chip mt-1 text-xs font-normal" title="This level is not offered here any more, so the page is not on the site. Its content is kept until you delete it.">
            Not offered now
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {leaving ? (
          <span className="p-chip">{page ? 'Off the site when you save' : 'Removed when you save'}</span>
        ) : (
          <>
            {row.unsaved ? <span className="p-chip">Not saved yet</span> : null}
            {/* A level just ticked has nothing written yet; saying so twice
                is noise. */}
            {state === 'new' ? null : page ? <StatusBadge status={page.status} /> : <span className="p-chip">Not written</span>}
          </>
        )}
        {needsSave ? (
          <button
            type="submit"
            name="intent"
            value={`write:${level.id}`}
            className="p-btn p-btn--outline p-btn--sm"
            /* The name starts with the words on the button, so a voice
               command for them finds it. */
            aria-label={`Save and ${page ? 'edit' : 'write'} the ${level.name} page`}
            title={`Saves the ${noun}, then opens the ${level.name} page`}
          >
            Save and {page ? 'edit' : 'write'}
          </button>
        ) : editorHref && (page || (!leaving && row.offered)) ? (
          /* Named in full, "Edit the Master's page": a row of links all
             called "Edit" says nothing on its own. The full name is the
             aria-label; the button shows only the verb. */
          <Link href={editorHref} className="p-btn p-btn--ghost p-btn--sm" aria-label={`${verb} the ${level.name} page`} onClick={confirmLeave}>
            {verb}
          </Link>
        ) : null}
        {page && ownerId ? (
          <RowMenu label={`More actions for the ${level.name} page`} items={[{ label: 'Delete content', danger: true, onSelect: onDelete }]} />
        ) : null}
      </div>
    </li>
  );
}
