'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { CatalogDialog, CatalogError, CatalogLoading } from './CatalogDialog';
import {
  deleteSubSubject,
  listAllSubjects,
  listSpecializations,
  publishSubSubject,
  unpublishSubSubject,
} from './catalog-client';
import type { PageMeta, SubjectRecord, SubSubjectRecord } from './catalog.types';
import { catalogErrorText } from './catalog-errors';
import { formatUpdated, ListSummary, RowMenu, StatusBadge, Toasts, useToasts, ViewOnSite } from '@/features/shared/records-ui';
import { useRouter } from 'next/navigation';

type Pending = { kind: 'publish' | 'unpublish' | 'delete'; row: SubSubjectRecord } | null;

/** Every specialization, across subjects, with its own list the way subjects
 * and courses have theirs. The client asked for specializations to be reached
 * and written on their own rather than only from inside a subject.
 *
 * `?subject=<id>` opens the list narrowed to one subject: the subjects list
 * links here that way.
 */
export function SpecializationsPage() {
  const preselectedSubject = useSearchParams().get('subject') ?? '';
  const [rows, setRows] = useState<SubSubjectRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [q, setQ] = useState('');
  const [subjectId, setSubjectId] = useState(preselectedSubject);
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
    void listSpecializations({ q, subjectId, status, page, limit: 12 })
      .then((result) => {
        setRows(result.data);
        setMeta(result.meta);
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Unable to load specializations'),
      )
      .finally(() => setLoading(false));
  }, [page, q, status, subjectId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  /* The subject filter names every subject; a failure here only leaves the
     filter empty, the list itself still loads. */
  useEffect(() => {
    let active = true;
    void listAllSubjects()
      .then((result) => {
        if (active) setSubjects(result);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  /* How many are live and how many are not, for the line over the table. */
  const loadCounts = useCallback(() => {
    void Promise.all([
      listSpecializations({ status: 'PUBLISHED', limit: 1 }),
      listSpecializations({ status: 'DRAFT', limit: 1 }),
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

  /* Publish or unpublish straight from the row; see SubjectsPage. */
  async function quick(row: SubSubjectRecord, kind: 'publish' | 'unpublish') {
    setBusy((current) => ({ ...current, [row.id]: kind }));
    try {
      const result =
        kind === 'publish'
          ? await publishSubSubject(row.subject.id, row.id, row.updatedAt)
          : await unpublishSubSubject(row.subject.id, row.id, row.updatedAt);
      setRows((current) => current.map((item) => (item.id === row.id ? result.data : item)));
      toast('ok', kind === 'publish' ? `${row.name} published.` : `${row.name} moved to draft.`);
      void load();
      loadCounts();
    } catch (cause: unknown) {
      toast('error', `${row.name}: ${kind === 'publish' ? 'not published' : 'not moved to draft'}. ${catalogErrorText(cause, 'The request failed')}`, {
        label: 'Fix in editor',
        onSelect: () => router.push(`/specializations/${row.id}`),
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
    const { row } = pending;
    try {
      if (pending.kind === 'publish') await publishSubSubject(row.subject.id, row.id, row.updatedAt);
      if (pending.kind === 'unpublish') await unpublishSubSubject(row.subject.id, row.id, row.updatedAt);
      if (pending.kind === 'delete') await deleteSubSubject(row.subject.id, row.id, row.updatedAt);
      toast(
        'ok',
        pending.kind === 'publish'
          ? `${row.name} published.`
          : pending.kind === 'unpublish'
            ? `${row.name} moved to draft.`
            : `${row.name} deleted.`,
      );
      setPending(null);
      setConfirm('');
      void load();
      loadCounts();
    } catch (cause: unknown) {
      toast('error', `${row.name}: ${catalogErrorText(cause, 'Specialization action failed')}`);
      setPending(null);
      setConfirm('');
    }
  }

  const addHref = subjectId ? `/specializations/new?subject=${subjectId}` : '/specializations/new';

  return (
    <section aria-labelledby="specializations-heading">
      <header className="p-head">
        <div>
          <p className="p-eyebrow">Catalog discovery</p>
          <h2 id="specializations-heading" className="p-h1">
            Specializations
          </h2>
          <p className="p-sub">Each subject&apos;s sub-fields, with a page of their own on the site.</p>
          <ListSummary total={meta ? meta.total : null} published={counts?.published} draft={counts?.draft} noun="specialization" />
        </div>
        <div className="p-head__actions">
          <Link href={addHref} className="p-btn p-btn--primary">
            Create specialization
          </Link>
        </div>
      </header>

      {error ? <CatalogError message={error} onRetry={load} /> : null}
      <Toasts toasts={toasts} onDismiss={dismiss} />

      <section className="p-panel a-filters" aria-label="Filter specializations">
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
            <span className="p-label">Subject</span>
            <select
              className="p-input"
              value={subjectId}
              onChange={(event) => {
                setSubjectId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All subjects</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
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
              setSubjectId('');
              setStatus('');
              setPage(1);
            }}
          >
            Clear
          </button>
        </div>
      </section>

      {loading ? (
        <CatalogLoading label="Loading specializations…" />
      ) : rows.length ? (
        <div className="p-tablewrap">
          <table className="p-table u-table">
            <thead>
              <tr>
                <th scope="col">Specialization</th>
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
                  <td>
                    <Link href={`/specializations/${row.id}`} className="p-link font-semibold">{row.name}</Link>
                    <span className="p-hint block">
                      /{row.subject.slug}/{row.slug}
                      {row.status === 'PUBLISHED' ? <> · <ViewOnSite path={`/subjects/${row.subject.slug}/${row.slug}`} /></> : null}
                    </span>
                    {row.shortDescription?.trim() ? null : (
                      <span
                        className="p-chip ml-2 align-middle text-xs"
                        title="Its page stays out of search engines until it has some content."
                      >
                        No short description
                      </span>
                    )}
                  </td>
                  <td>
                    <Link href={`/subjects/${row.subject.id}`} className="p-link">
                      {row.subject.name}
                    </Link>
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
                      <Link href={`/specializations/${row.id}`} className="p-btn p-btn--ghost p-btn--sm">
                        Edit
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
      ) : (
        <div className="p-panel p-empty">
          <h3 className="p-empty__t">No specializations found</h3>
          <p className="p-empty__d">Create a specialization or adjust the filters.</p>
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
          title={pending.kind === 'delete' ? 'Delete specialization?' : 'Change specialization visibility?'}
          description={
            pending.kind === 'delete'
              ? `Type ${pending.row.name} to confirm soft deletion.`
              : pending.kind === 'publish'
                ? 'Its subject must already be published. This action is audited and changes public visibility.'
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
                aria-label="Confirm specialization name"
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
