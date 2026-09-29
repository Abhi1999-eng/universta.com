'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { CatalogDialog, CatalogError, CatalogLoading } from './CatalogDialog';
import {
  deleteCourse,
  listAdminCourses,
  listCountries,
  listCourseLevels,
  listSubjects,
  publishCourse,
  unpublishCourse,
} from './catalog-client';
import type {
  CatalogMutationError,
  CourseRecord,
  CountryRecord,
  MasterRecord,
  PageMeta,
  SubjectRecord,
} from './catalog.types';

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
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [subject, setSubject] = useState('');
  const [subSubject, setSubSubject] = useState('');
  const [level, setLevel] = useState('');
  const [country, setCountry] = useState('');
  const [featured, setFeatured] = useState('');
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [levels, setLevels] = useState<MasterRecord[]>([]);
  const [countries, setCountries] = useState<CountryRecord[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pending, setPending] = useState<Pending>(null);
  const [confirm, setConfirm] = useState('');

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
      featured: featured === '' ? undefined : featured === 'true',
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
  }, [country, featured, level, page, q, status, subject, subSubject]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      listSubjects({ limit: 100 }),
      listCourseLevels({ status: 'ACTIVE', limit: 100 }),
      listCountries({ status: 'PUBLISHED', limit: 100 }),
    ])
      .then(([subjectResult, levelResult, countryResult]) => {
        if (!cancelled) {
          setSubjects(subjectResult.data);
          setLevels(levelResult.data);
          setCountries(countryResult.data);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function action() {
    if (!pending || (pending.kind === 'delete' && confirm !== pending.row.name)) return;
    try {
      if (pending.kind === 'publish') await publishCourse(pending.row.id, pending.row.updatedAt);
      if (pending.kind === 'unpublish') await unpublishCourse(pending.row.id, pending.row.updatedAt);
      if (pending.kind === 'delete') await deleteCourse(pending.row.id, pending.row.updatedAt);
      setSuccess(
        pending.kind === 'publish'
          ? 'Course published.'
          : pending.kind === 'unpublish'
            ? 'Course unpublished.'
            : 'Course deleted.',
      );
      setPending(null);
      setConfirm('');
      void load();
    } catch (cause: unknown) {
      const typed = cause as Partial<CatalogMutationError>;
      setError(typed.message ?? 'Course action failed');
      setPending(null);
      setConfirm('');
    }
  }

  return (
    <section className="pa" aria-labelledby="courses-heading">
      <header className="p-head">
        <div>
          <p className="p-eyebrow">Catalog discovery</p>
          <h2 id="courses-heading" className="p-h1">
            Courses
          </h2>
          <p className="p-sub">
            Manage course core data, verified country availability, and controlled editorial
            sections.
          </p>
        </div>
        <div className="p-head__actions">
          <Link href="/courses/new" className="p-btn p-btn--primary">
            Create course
          </Link>
        </div>
      </header>

      {success ? (
        <p role="status" className="p-alert p-alert--ok">
          <span>{success}</span>
        </p>
      ) : null}
      {error ? <CatalogError message={error} onRetry={load} /> : null}

      <section className="p-panel a-filters" aria-label="Filter courses">
        <div className="p-grid3">
          <label className="p-field">
            <span className="p-label">Subject</span>
            <select
              className="p-input"
              value={subject}
              onChange={(event) => {
                setSubject(event.target.value);
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
            <span className="p-label">Sub-Subject slug</span>
            <input
              className="p-input"
              value={subSubject}
              onChange={(event) => {
                setSubSubject(event.target.value);
                setPage(1);
              }}
              placeholder="Optional slug"
            />
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
            <span className="p-label">Featured</span>
            <select
              className="p-input"
              value={featured}
              onChange={(event) => {
                setFeatured(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All featured states</option>
              <option value="true">Featured</option>
              <option value="false">Not featured</option>
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
              setFeatured('');
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
        <div className="p-tablewrap">
          <table className="p-table u-table">
            <thead>
              <tr>
                <th scope="col">Course</th>
                <th scope="col">Subject</th>
                <th scope="col">Level</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.name}</strong>
                    <span className="p-hint">/{row.slug}</span>
                  </td>
                  <td>{row.subject.name}</td>
                  <td>{row.courseLevel.name}</td>
                  <td>
                    <span
                      className={`p-badge ${row.status === 'PUBLISHED' ? 'p-badge--ok' : 'p-badge--visa'}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td>
                    <div className="p-row p-row--wrap">
                      <Link href={`/courses/${row.id}`} className="p-btn p-btn--ghost p-btn--sm">
                        Edit
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
