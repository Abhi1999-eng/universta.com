'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { CatalogDialog, CatalogError, CatalogLoading } from './CatalogDialog';
import {
  deleteCourse,
  listAdminCourses,
  listCountries,
  listCourseLevels,
  listAllSubjects,
  listSpecializations,
  publishCourse,
  unpublishCourse,
  listEvery,
} from './catalog-client';
import type {
  CourseRecord,
  CountryRecord,
  MasterRecord,
  PageMeta,
  SubjectRecord,
  SubSubjectRecord,
} from './catalog.types';
import { catalogErrorText } from './catalog-errors';
import { BulkBar, ListSummary, RowCheckbox, RowMenu, SelectAllCheckbox, StatusBadge, Toasts, ViewOnSite, bulkSummary, formatUpdated, useFiltersInUrl, useRowSelection, useToasts } from '@/features/shared/records-ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { useHandedOverToast } from '@/features/shared/Flash';

type Pending = { kind: 'publish' | 'unpublish' | 'delete'; row: CourseRecord } | null;

/** Courses, in the reference build's admin design.
 *
 * Same shape as the other catalogue lists: the page opts into the ported
 * stylesheet with `pa`, and the rows are the design's data grid rather than
 * stacked cards. The title stays an `h2` because the Admin shell owns the `h1`.
 */
export function CoursesPage() {
  const [rows, setRows] = useState<CourseRecord[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const initial = useSearchParams();
  const [q, setQ] = useState(() => initial.get('q') ?? '');
  const [status, setStatus] = useState(() => initial.get('status') ?? '');
  const [subject, setSubject] = useState(() => initial.get('subject') ?? '');
  const [subSubject, setSubSubject] = useState(() => initial.get('subSubject') ?? '');
  const [level, setLevel] = useState(() => initial.get('level') ?? '');
  const [country, setCountry] = useState(() => initial.get('country') ?? '');
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [levels, setLevels] = useState<MasterRecord[]>([]);
  const [countries, setCountries] = useState<CountryRecord[]>([]);
  const [specializations, setSpecializations] = useState<SubSubjectRecord[]>([]);
  const [page, setPage] = useState(() => Number(initial.get('page')) || 1);
  useFiltersInUrl({ q, status, subject, subSubject, level, country, page });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Pending>(null);
  const [confirm, setConfirm] = useState('');
  const [counts, setCounts] = useState<{ published: number; draft: number } | null>(null);
  const [busy, setBusy] = useState<Record<string, string>>({});
  const { toasts, push: toast, dismiss } = useToasts();
  const showPublished = useCallback((message: string) => toast('success', message), [toast]);
  useHandedOverToast(showPublished);
  const router = useRouter();

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    void listAdminCourses({
      q,
      status,
      subject,
      subSubject,
      level,
      country,
      page,
      limit: 12,
    })
      .then((result) => {
        setRows(result.data);
        setMeta(result.meta);
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Unable to load courses'),
      )
      .finally(() => setLoading(false));
  }, [country, level, page, q, status, subject, subSubject]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      listAllSubjects(),
      listCourseLevels({ status: 'ACTIVE', limit: 100 }),
      // A filter has to offer every destination, not the first page of them.
      listEvery(listCountries, { status: 'PUBLISHED' }),
    ])
      .then(([subjectResult, levelResult, countries]) => {
        if (!cancelled) {
          setSubjects(subjectResult);
          setLevels(levelResult.data);
          setCountries(countries);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  /* The specialization filter offers the chosen subject's specializations,
     by name. It used to be a box for typing a slug. */
  const subjectId = subjects.find((item) => item.slug === subject)?.id ?? '';
  useEffect(() => {
    if (!subjectId) return;
    let cancelled = false;
    void listSpecializations({ subjectId, limit: 100 })
      .then((result) => {
        if (!cancelled) setSpecializations(result.data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  /* How many are live and how many are not, for the line over the table. */
  const loadCounts = useCallback(() => {
    void Promise.all([
      listAdminCourses({ status: 'PUBLISHED', limit: 1 }),
      listAdminCourses({ status: 'DRAFT', limit: 1 }),
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
  async function quick(row: CourseRecord, kind: 'publish' | 'unpublish') {
    setBusy((current) => ({ ...current, [row.id]: kind }));
    try {
      const result = kind === 'publish' ? await publishCourse(row.id, row.updatedAt) : await unpublishCourse(row.id, row.updatedAt);
      setRows((current) => current.map((item) => (item.id === row.id ? result.data : item)));
      toast('ok', kind === 'publish' ? `${row.name} published.` : `${row.name} moved to draft.`);
      void load();
      loadCounts();
    } catch (cause: unknown) {
      toast('error', `${row.name}: ${kind === 'publish' ? 'not published' : 'not moved to draft'}. ${catalogErrorText(cause, 'The request failed')}`, {
        label: 'Fix in editor',
        onSelect: () => router.push(`/courses/${row.id}`),
      });
    } finally {
      setBusy((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
    }
  }

  async function action() {
    if (!pending || (pending.kind === 'delete' && confirm !== pending.row.name)) return;
    try {
      if (pending.kind === 'publish') await publishCourse(pending.row.id, pending.row.updatedAt);
      if (pending.kind === 'unpublish') await unpublishCourse(pending.row.id, pending.row.updatedAt);
      if (pending.kind === 'delete') await deleteCourse(pending.row.id, pending.row.updatedAt);
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
      toast('error', `${pending.row.name}: ${catalogErrorText(cause, 'Course action failed')}`);
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
        if (kind === 'publish') await publishCourse(row.id, row.updatedAt);
        else await unpublishCourse(row.id, row.updatedAt);
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
    <section aria-labelledby="courses-heading">
      <header className="p-head">
        <div>
          <h2 id="courses-heading" className="p-h1">
            Courses
          </h2>
          <p className="p-sub">
            Add courses, the countries they are offered in, and the content their pages show.
          </p>
          <ListSummary total={meta ? meta.total : null} published={counts?.published} draft={counts?.draft} noun="course" />
        </div>
        <div className="p-head__actions">
          <Link href="/courses/new" className="p-btn p-btn--primary">
            Create course
          </Link>
        </div>
      </header>

      {error ? <CatalogError message={error} onRetry={load} /> : null}
      <Toasts toasts={toasts} onDismiss={dismiss} />

      <section className="p-panel a-filters" aria-label="Filter courses">
        <div className="p-grid3">
          <label className="p-field">
            <span className="p-label">Subject</span>
            <select
              className="p-input"
              value={subject}
              onChange={(event) => {
                setSubject(event.target.value);
                setSubSubject('');
                setPage(1);
              }}
            >
              <option value="">All subjects</option>
              {subjects.map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="p-field">
            <span className="p-label">Specialization</span>
            <select
              className="p-input"
              value={subSubject}
              disabled={!subjectId}
              onChange={(event) => {
                setSubSubject(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{subjectId ? 'All specializations' : 'Choose a subject first'}</option>
              {(subjectId ? specializations : []).map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="p-field">
            <span className="p-label">Course level</span>
            <select
              className="p-input"
              value={level}
              onChange={(event) => {
                setLevel(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All levels</option>
              {levels.map((item) => (
                <option key={item.id} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="p-field">
            <span className="p-label">Country</span>
            <select
              className="p-input"
              value={country}
              onChange={(event) => {
                setCountry(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All countries</option>
              {countries.map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="p-field">
            <span className="p-label">Search</span>
            <input
              className="p-input"
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
              placeholder="Name, slug, or code"
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
              setSubject('');
              setSubSubject('');
              setLevel('');
              setCountry('');
              setPage(1);
            }}
          >
            Clear
          </button>
        </div>
      </section>

      {loading ? (
        <CatalogLoading label="Loading courses…" />
      ) : rows.length ? (
        <>
        <BulkBar count={selection.count} busy={bulkBusy} onPublish={() => void bulk('publish')} onUnpublish={() => void bulk('unpublish')} onClear={selection.clear} />
        <div className="p-tablewrap">
          <table className="p-table u-table">
            <thead>
              <tr>
                <th scope="col" className="w-8"><SelectAllCheckbox checked={selection.allSelected} onChange={selection.toggleAll} /></th>
                <th scope="col">Course</th>
                <th scope="col">Subject</th>
                <th scope="col">Level</th>
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
                    <Link href={`/courses/${row.id}`} className="p-link font-semibold">{row.name}</Link>
                    <span className="p-hint block">
                      /{row.slug}
                      {row.status === 'PUBLISHED' ? <> · <ViewOnSite path={`/courses/${row.slug}`} /></> : null}
                    </span>
                  </td>
                  <td>{row.subject.name}</td>
                  <td>{row.courseLevel.name}</td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                  <td>{formatUpdated(row.updatedAt)}</td>
                  <td className="p-td-actions">
                    <div className="p-row p-row--actions">
                      <Link href={`/courses/${row.id}`} className="p-btn p-btn--ghost p-btn--sm">
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
                          className="p-btn p-btn--outline p-btn--sm"
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
          <h3 className="p-empty__t">No courses found</h3>
          <p className="p-empty__d">Create a course or adjust the filters.</p>
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
          title={
            pending.kind === 'delete'
              ? 'Delete course?'
              : `${pending.kind === 'publish' ? 'Publish' : 'Unpublish'} course?`
          }
          description={
            pending.kind === 'delete'
              ? `Type ${pending.row.name} to confirm soft deletion.`
              : 'This changes public visibility and is recorded in the audit log.'
          }
          onClose={() => {
            setPending(null);
            setConfirm('');
          }}
        >
          <div className="p-row p-row--wrap">
            {pending.kind === 'delete' ? (
              <label className="p-field">
                <span className="p-label">Course name</span>
                <input
                  aria-label="Confirm course name"
                  className="p-input p-input--sm"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  placeholder={pending.row.name}
                />
              </label>
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
              onClick={() => void action()}
            >
              Confirm
            </button>
          </div>
        </CatalogDialog>
      ) : null}
    </section>
  );
}
