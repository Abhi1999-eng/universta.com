'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { CatalogDialog, CatalogError, CatalogLoading } from './CatalogDialog';
import { deleteSubject, listSubjects, publishSubject, unpublishSubject } from './catalog-client';
import type { CatalogMutationError, PageMeta, SubjectRecord } from './catalog.types';
import { catalogErrorText } from './catalog-errors';

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
  const [featured, setFeatured] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pending, setPending] = useState<Pending>(null);
  const [confirm, setConfirm] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    void listSubjects({
      q,
      status,
      featured: featured === '' ? undefined : featured === 'true',
      page,
      limit: 12,
      sort: 'featured',
    })
      .then((result) => {
        setRows(result.data);
        setMeta(result.meta);
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Unable to load subjects'),
      )
      .finally(() => setLoading(false));
  }, [featured, page, q, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function act() {
    if (!pending || (pending.kind === 'delete' && confirm !== pending.row.name)) return;
    try {
      if (pending.kind === 'publish') await publishSubject(pending.row.id, pending.row.updatedAt);
      if (pending.kind === 'unpublish') await unpublishSubject(pending.row.id, pending.row.updatedAt);
      if (pending.kind === 'delete') await deleteSubject(pending.row.id, pending.row.updatedAt);
      setSuccess(
        pending.kind === 'publish'
          ? 'Subject published.'
          : pending.kind === 'unpublish'
            ? 'Subject unpublished.'
            : 'Subject deleted.',
      );
      setPending(null);
      setConfirm('');
      void load();
    } catch (cause: unknown) {
      setError(catalogErrorText(cause, 'Subject action failed'));
      setPending(null);
      setConfirm('');
    }
  }

  return (
    <section aria-labelledby="subjects-heading">
      <header className="p-head">
        <div>
          <p className="p-eyebrow">Catalog discovery</p>
          <h2 id="subjects-heading" className="p-h1">
            Subjects
          </h2>
          <p className="p-sub">Manage subject pathways and their Sub-Subjects.</p>
        </div>
        <div className="p-head__actions">
          <Link href="/subjects/new" className="p-btn p-btn--primary">
            Create subject
          </Link>
        </div>
      </header>

      {success ? (
        <p role="status" className="p-alert p-alert--ok">
          <span>{success}</span>
        </p>
      ) : null}
      {error ? <CatalogError message={error} onRetry={load} /> : null}

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
        <label className="p-field">
          <span className="p-label">Featured</span>
          <select
            className="p-input"
            value={featured}
            onChange={(event) => {
              setFeatured(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="true">Featured</option>
            <option value="false">Not featured</option>
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
              setFeatured('');
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
        <div className="p-tablewrap">
          <table className="p-table u-table">
            <thead>
              <tr>
                <th scope="col">Subject</th>
                <th scope="col">Status</th>
                <th scope="col">Updated</th>
                <th scope="col" className="p-td-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.name}</strong>
                    <span className="p-hint">
                      /{row.slug}
                      {row.isFeatured ? ' · Featured' : ''}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`p-badge ${row.status === 'PUBLISHED' ? 'p-badge--ok' : 'p-badge--visa'}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td>
                    {row.updatedAt ? (
                      new Date(row.updatedAt).toLocaleString()
                    ) : (
                      <span className="p-muted">—</span>
                    )}
                  </td>
                  <td className="p-td-actions">
                    <div className="p-row p-row--actions">
                      <Link href={`/subjects/${row.id}`} className="p-btn p-btn--ghost p-btn--sm">
                        Edit
                      </Link>
                      <Link
                        href={`/subjects/${row.id}?subSubjects=1`}
                        className="p-btn p-btn--ghost p-btn--sm"
                      >
                        Sub-Subjects
                      </Link>
                      {row.status === 'PUBLISHED' ? (
                        <button
                          type="button"
                          className="p-btn p-btn--ghost p-btn--sm"
                          onClick={() => setPending({ kind: 'unpublish', row })}
                        >
                          Unpublish
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="p-btn p-btn--primary p-btn--sm"
                          onClick={() => setPending({ kind: 'publish', row })}
                        >
                          Publish
                        </button>
                      )}
                      <button
                        type="button"
                        className="p-btn p-btn--danger p-btn--sm"
                        onClick={() => setPending({ kind: 'delete', row })}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
