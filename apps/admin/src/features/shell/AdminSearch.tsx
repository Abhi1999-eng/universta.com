'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { authFetch } from '@/features/auth/auth-client';
import { listAdminCourses, listCountries, listSpecializations, listSubjects } from '@/features/catalog/catalog-client';

type Hit = { id: string; name: string; detail: string | null; href: string };
type Group = { label: string; hits: Hit[] };

const PER_GROUP = 5;

async function phase1(resource: string, q: string): Promise<Hit[]> {
  const response = await authFetch(`/api/v1/admin/phase1/${resource}?q=${encodeURIComponent(q)}&limit=${PER_GROUP}`);
  if (!response.ok) return [];
  const body = (await response.json()) as { data?: Array<{ id: string; name?: string; title?: string; slug?: string }> };
  return (body.data ?? []).map((row) => ({ id: row.id, name: row.name ?? row.title ?? 'Untitled', detail: row.slug ? `/${row.slug}` : null, href: `/phase1/${resource}?edit=${row.id}` }));
}

const quiet = async (work: Promise<Hit[]>) => {
  try {
    return await work;
  } catch {
    return [];
  }
};

/** Search across the catalogue from the top bar, as the reference's Control
 * Center has it: type a name, open the record. "/" or Ctrl/⌘+K puts the
 * cursor here; the arrow keys and Enter pick a result. */
export function AdminSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if ((event.key === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !typing)) {
        event.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
    };
    const onDown = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return undefined;
    let active = true;
    const timer = window.setTimeout(() => {
      void Promise.all([
        quiet(listSubjects({ q: term, limit: PER_GROUP }).then((r) => r.data.map((row) => ({ id: row.id, name: row.name, detail: `/${row.slug}`, href: `/subjects/${row.id}` })))),
        quiet(listSpecializations({ q: term, limit: PER_GROUP }).then((r) => r.data.map((row) => ({ id: row.id, name: row.name, detail: row.subject.name, href: `/specializations/${row.id}` })))),
        quiet(listAdminCourses({ q: term, limit: PER_GROUP }).then((r) => r.data.map((row) => ({ id: row.id, name: row.name, detail: row.subject?.name ?? null, href: `/courses/${row.id}` })))),
        quiet(listCountries({ q: term, limit: PER_GROUP }).then((r) => r.data.map((row) => ({ id: row.id, name: row.name, detail: `/${row.slug}`, href: `/countries/${row.id}` })))),
        quiet(phase1('universities', term)),
        quiet(phase1('scholarships', term)),
        quiet(phase1('consultants', term)),
      ]).then(([subjects, specializations, courses, countries, universities, scholarships, consultants]) => {
        if (!active) return;
        setGroups(
          [
            { label: 'Subjects', hits: subjects },
            { label: 'Specializations', hits: specializations },
            { label: 'Courses', hits: courses },
            { label: 'Countries', hits: countries },
            { label: 'Universities', hits: universities },
            { label: 'Scholarships', hits: scholarships },
            { label: 'Consultants', hits: consultants },
          ].filter((group) => group.hits.length),
        );
        setCursor(0);
      });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [q]);

  const term = q.trim();
  const shown = term.length >= 2 ? groups : null;
  const flat = (shown ?? []).flatMap((group) => group.hits);
  const go = (hit: Hit | undefined) => {
    if (!hit) return;
    setOpen(false);
    setQ('');
    setGroups(null);
    router.push(hit.href);
  };

  let index = -1;
  return (
    <div className="p-search a-cmd" ref={box}>
      <svg className="p-ic p-search__ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        ref={input}
        className="p-search__input"
        type="search"
        placeholder="Find a subject, course, country, university…"
        aria-label="Find a record"
        role="combobox"
        aria-expanded={open && Boolean(shown)}
        aria-controls={listId}
        aria-activedescendant={open && flat[cursor] ? `${listId}-${cursor}` : undefined}
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQ(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setCursor((value) => Math.min(value + 1, Math.max(flat.length - 1, 0)));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setCursor((value) => Math.max(value - 1, 0));
          } else if (event.key === 'Enter') {
            event.preventDefault();
            go(flat[cursor]);
          } else if (event.key === 'Escape') {
            setOpen(false);
            input.current?.blur();
          }
        }}
      />
      <kbd className="p-search__kbd" aria-hidden="true">/</kbd>
      {open && shown ? (
        <div className="p-search__panel" id={listId} role="listbox" aria-label="Matching records">
          {shown.length === 0 ? (
            <p className="p-hint px-3 py-2">Nothing matches “{term}”.</p>
          ) : (
            shown.map((group) => (
              <div key={group.label} className="p-search__group" role="group" aria-label={group.label}>
                <p>{group.label}</p>
                {group.hits.map((hit) => {
                  index += 1;
                  const position = index;
                  return (
                    <a
                      key={hit.id}
                      id={`${listId}-${position}`}
                      role="option"
                      aria-selected={cursor === position}
                      href={hit.href}
                      className={`p-search__item${cursor === position ? ' is-active' : ''}`}
                      onMouseEnter={() => setCursor(position)}
                      onClick={(event) => {
                        event.preventDefault();
                        go(hit);
                      }}
                    >
                      <span className="p-search__txt">
                        <strong>{hit.name}</strong>
                        {hit.detail ? <span className="p-search__detail">{hit.detail}</span> : null}
                      </span>
                    </a>
                  );
                })}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
