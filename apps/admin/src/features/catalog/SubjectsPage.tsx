'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { CatalogDialog, CatalogError, CatalogLoading } from './CatalogDialog';
import { deleteSubject, listSubjects, publishSubject, unpublishSubject } from './catalog-client';
import type { PageMeta, SubjectRecord } from './catalog.types';
import { catalogErrorText } from './catalog-errors';
import { BulkBar, bulkSummary, formatUpdated, ListSummary, RowCheckbox, RowMenu, SelectAllCheckbox, StatusBadge, Toasts, useRowSelection, useToasts, ViewOnSite } from '@/features/shared/records-ui';
import { useRouter } from 'next/navigation';

type Pending = { kind: 'publish' | 'unpublish' | 'delete'; row: SubjectRecord } | null;

/** Subjects, in the reference build's admin design.
 *
 * The page opts into the ported stylesheet with `pa` on its root; everything
 * below is that design's own vocabulary -- `p-head`, `p-panel`, the data grid,
 * `p-btn` -- rather than utility classes.
 *
 * The title stays an `h2`: the Admin shell owns each screen's `h1`, and
 * `p-h1` here is the reference's heading *style*, not its level.
 */
export function SubjectsPage() {
  const [rows, setRows] = useState<SubjectRecord[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Pending>(null);
  const [confirm, setConfirm] = useState('');
  const [counts, setCounts] = useState<{ published: number; draft: number } | null>(null);
  const [busy, setBusy] = useState<Record<string, string>>({});
  const { toasts, push: toast, dismiss } = useToasts();
  const router = useRouter();

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    void listSubjects({
      q,
      status,
      page,
      limit: 12,
    })
      .then((result) => {
        setRows(result.data);
        setMeta(result.meta);
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Unable to load subjects'),
      )
      .finally(() => setLoading(false));
  }, [page, q, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  /* How many are live and how many are not, for the line over the table. */
  const loadCounts = useCallback(() => {
    void Promise.all([
      listSubjects({ status: 'PUBLISHED', limit: 1 }),
      listSubjects({ status: 'DRAFT', limit: 1 }),
    ])
      .then(([published, draft]) =>
        setCounts({ published: published.meta?.total ?? 0, draft: draft.meta?.total ?? 0 }),
      )
      .catch(() => setCounts(null));
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => loadCounts(), 0);
    return () => window.clearTimeout(timer);
  }, [loadCounts]);

  /* Publish or unpublish straight from the row: the button says what it is
     doing, the badge changes when the API answers, and a toast says what
     happened -- or why it did not, with the editor one click away. */
  async function quick(row: SubjectRecord, kind: 'publish' | 'unpublish') {
    setBusy((current) => ({ ...current, [row.id]: kind }));
    try {
      const result = kind === 'publish' ? await publishSubject(row.id, row.updatedAt) : await unpublishSubject(row.id, row.updatedAt);
      setRows((current) => current.map((item) => (item.id === row.id ? result.data : item)));
      toast('ok', kind === 'publish' ? `${row.name} published.` : `${row.name} moved to draft.`);
      void load();
      loadCounts();
    } catch (cause: unknown) {
      toast('error', `${row.name}: ${kind === 'publish' ? 'not published' : 'not moved to draft'}. ${catalogErrorText(cause, 'The request failed')}`, {
        label: 'Fix in editor',
        onSelect: () => router.push(`/subjects/${row.id}`),
      });
    } finally {
      setBusy((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
    }
  }

  async function act() {
    if (!pending || (pending.kind === 'delete' && confirm !== pending.row.name)) return;
    try {
      if (pending.kind === 'publish') await publishSubject(pending.row.id, pending.row.updatedAt);
      if (pending.kind === 'unpublish') await unpublishSubject(pending.row.id, pending.row.updatedAt);
      if (pending.kind === 'delete') await deleteSubject(pending.row.id, pending.row.updatedAt);
      toast(
        'ok',
        pending.kind === 'publish'
          ? `${pending.row.name} published.`
          : pending.kind === 'unpublish'
            ? `${pending.row.name} moved to draft.`
            : `${pending.row.name} deleted.`,
      );
      setPending(null);
      setConfirm('');
      void load();
      loadCounts();
    } catch (cause: unknown) {
      toast('error', `${pending.row.name}: ${catalogErrorText(cause, 'Subject action failed')}`);
      setPending(null);
      setConfirm('');
    }
  }


  /* Publish or unpublish every ticked row, one after another, and say in
     one line what happened. Rows already in the asked-for state are left
     alone and counted as such. */
  const selection = useRowSelection(rows.map((row) => row.id));
  const [bulkBusy, setBulkBusy] = useState(false);
  async function bulk(kind: 'publish' | 'unpublish') {
    const picked = rows.filter((row) => selection.has(row.id));
    const targets = picked.filter((row) => (kind === 'publish' ? row.status !== 'PUBLISHED' : row.status === 'PUBLISHED'));
    setBulkBusy(true);
    const failed: string[] = [];
    let done = 0;
    for (const row of targets) {
      try {
        if (kind === 'publish') await publishSubject(row.id, row.updatedAt);
        else await unpublishSubject(row.id, row.updatedAt);
        done += 1;
      } catch (cause: unknown) {
        failed.push(`${row.name} (${catalogErrorText(cause, 'failed')})`);
      }
    }
    toast(failed.length ? 'error' : 'ok', bulkSummary(kind, done, picked.length - targets.length, failed));
    selection.clear();
    setBulkBusy(false);
    void load();
    loadCounts();
  }

  return (
    <section aria-labelledby="subjects-heading">
      <header className="p-head">
        <div>
          <p className="p-eyebrow">Catalog discovery</p>
          <h2 id="subjects-heading" className="p-h1">
            Subjects
          </h2>
          <p className="p-sub">Manage subject pathways. Each subject&apos;s specializations have a list and editor of their own.</p>
          <ListSummary total={meta ? meta.total : null} published={counts?.published} draft={counts?.draft} noun="subject" />
        </div>
        <div className="p-head__actions">
          <Link href="/subjects/new" className="p-btn p-btn--primary">
            Create subject
          </Link>
        </div>
      </header>

      {error ? <CatalogError message={error} onRetry={load} /> : null}
      <Toasts toasts={toasts} onDismiss={dismiss} />

      <section className="p-panel a-filters" aria-label="Filter subjects">
        <div className="p-grid3">
          <label className="p-field">
          <span className="p-label">Search</span>
          <input
            className="p-input"
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setPage(1);
            }}
            placeholder="Name or slug"
          />
        </label>
        <label className="p-field">
          <span className="p-label">Status</span>
          <select
            className="p-input"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </label>
        </div>
        <div className="p-row p-row--wrap">
          <button
            type="button"
            className="p-btn p-btn--ghost p-btn--sm"
            onClick={() => {
              setQ('');
              setStatus('');
              setPage(1);
            }}
          >
            Clear
          </button>
        </div>
      </section>

      {loading ? (
        <CatalogLoading label="Loading subjects…" />
      ) : rows.length ? (
        <>
        <BulkBar count={selection.count} busy={bulkBusy} onPublish={() => void bulk('publish')} onUnpublish={() => void bulk('unpublish')} onClear={selection.clear} />
        <div className="p-tablewrap">
          <table className="p-table u-table">
            <thead>
              <tr>
                <th scope="col" className="w-8"><SelectAllCheckbox checked={selection.allSelected} onChange={selection.toggleAll} /></th>
                <th scope="col">Subject</th>
                <th scope="col">Levels</th>
                <th scope="col">Status</th>
                <th scope="col">Updated</th>
                <th scope="col" className="p-td-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td><RowCheckbox name={row.name} checked={selection.has(row.id)} onChange={(on) => selection.toggle(row.id, on)} /></td>
                  <td>
                    <Link href={`/subjects/${row.id}`} className="p-link font-semibold">{row.name}</Link>
                    <span className="p-hint block">
                      /{row.slug}
                      {row.status === 'PUBLISHED' ? <> · <ViewOnSite path={`/subjects/${row.slug}`} /></> : null}
                    </span>
                  </td>
                  <td>
                    {row.courseLevels?.length ? (
                      row.courseLevels.map((level) => level.code ?? level.name).join(', ')
                    ) : (
                      <span className="p-muted">—</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                  <td>{formatUpdated(row.updatedAt)}</td>
                  <td className="p-td-actions">
                    <div className="p-row p-row--actions">
                      <Link href={`/subjects/${row.id}`} className="p-btn p-btn--ghost p-btn--sm">
                        Edit
                      </Link>
                      <Link
                        href={`/specializations?subject=${row.id}`}
                        className="p-btn p-btn--ghost p-btn--sm"
                      >
                        Specializations
                      </Link>
                      {row.status === 'PUBLISHED' ? (
                        <button
                          type="button"
                          className="p-btn p-btn--ghost p-btn--sm"
                          disabled={Boolean(busy[row.id])}
                          onClick={() => void quick(row, 'unpublish')}
                        >
                          {busy[row.id] === 'unpublish' ? 'Moving to draft…' : 'Unpublish'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="p-btn p-btn--primary p-btn--sm"
                          disabled={Boolean(busy[row.id])}
                          onClick={() => void quick(row, 'publish')}
                        >
                          {busy[row.id] === 'publish' ? 'Publishing…' : 'Publish'}
                        </button>
                      )}
                      <RowMenu items={[{ label: 'Delete', danger: true, onSelect: () => setPending({ kind: 'delete', row }) }]} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      ) : (
        <div className="p-panel p-empty">
          <h3 className="p-empty__t">No subjects found</h3>
          <p className="p-empty__d">Create a subject or adjust the filters.</p>
        </div>
      )}

      {meta && meta.totalPages > 1 ? (
        <nav className="a-grid__pager" aria-label="Pagination">
          <button
            type="button"
            className="p-btn p-btn--ghost p-btn--sm"
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </button>
          <span className="p-hint">
            Page {meta.page} of {meta.totalPages}
          </span>
          <button
            type="button"
            className="p-btn p-btn--ghost p-btn--sm"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </nav>
      ) : null}

      {pending ? (
        <CatalogDialog
          title={pending.kind === 'delete' ? 'Delete subject?' : 'Change subject visibility?'}
          description={
            pending.kind === 'delete'
              ? `Type ${pending.row.name} to confirm soft deletion.`
              : 'This action is audited and changes public visibility.'
          }
          onClose={() => {
            setPending(null);
            setConfirm('');
          }}
        >
          <div className="p-row p-row--wrap">
            {pending.kind === 'delete' ? (
              <input
                aria-label="Confirm subject name"
                className="p-input p-input--sm"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder={pending.row.name}
              />
            ) : null}
            <button
              type="button"
              className="p-btn p-btn--ghost"
              onClick={() => {
                setPending(null);
                setConfirm('');
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="p-btn p-btn--primary"
              disabled={pending.kind === 'delete' && confirm !== pending.row.name}
              onClick={() => void act()}
            >
              Confirm
            </button>
          </div>
        </CatalogDialog>
      ) : null}
    </section>
  );
}
