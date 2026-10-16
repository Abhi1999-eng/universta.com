'use client';

import { useId, useMemo, useState } from 'react';
import type { CourseRecord } from './catalog.types';

const SHOWN = 12;

/** Related courses as a search-and-pick: the chosen ones as chips in their
 * order, and a search over the rest. It replaces a checkbox per course in the
 * catalogue, which on a thousand courses made the editor 30,000px tall. */
export function RelatedCoursePicker({
  courses,
  selected,
  excludeId,
  onToggle,
}: {
  courses: CourseRecord[];
  selected: string[];
  excludeId?: string;
  onToggle: (courseId: string) => void;
}) {
  const [q, setQ] = useState('');
  const inputId = useId();
  const byId = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return courses
      .filter((course) => course.id !== excludeId && !selected.includes(course.id))
      .filter((course) => course.name.toLowerCase().includes(needle) || course.subject.name.toLowerCase().includes(needle) || course.slug.includes(needle))
      .slice(0, SHOWN);
  }, [courses, excludeId, q, selected]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold">Selected ({selected.length})</p>
        {selected.length ? (
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Selected related courses">
            {selected.map((id) => {
              const course = byId.get(id);
              const name = course?.name ?? 'Course no longer listed';
              return (
                <li key={id} className="flex items-center gap-2 rounded-full border border-[#B7C6E8] bg-[#EEF3FF] py-1 pl-3 pr-1 text-sm">
                  <span>{name}</span>
                  {course ? <span className="p-hint">{course.subject.name}</span> : null}
                  <button type="button" aria-label={`Remove ${name}`} onClick={() => onToggle(id)} className="rounded-full px-2 font-bold text-[#475467] hover:bg-white">×</button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="p-hint mt-1">None yet. Search below to add courses shown as related on this course&apos;s page.</p>
        )}
      </div>
      <div>
        <label htmlFor={inputId} className="text-sm font-semibold">Add a related course</label>
        <input id={inputId} className="p-input" placeholder="Search by course name or subject" value={q} onChange={(event) => setQ(event.target.value)} />
        {q.trim() ? (
          results.length ? (
            <ul className="mt-2 divide-y divide-[#E8ECF3] rounded-xl border border-[#E8ECF3]" aria-label="Matching courses">
              {results.map((course) => (
                <li key={course.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                  <span><strong className="text-[#1D2939]">{course.name}</strong> <span className="p-hint">{course.subject.name}</span></span>
                  <button type="button" className="p-btn p-btn--outline p-btn--sm" onClick={() => { onToggle(course.id); setQ(''); }}>Add</button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-hint mt-2">No course matches “{q.trim()}”.</p>
          )
        ) : null}
      </div>
    </div>
  );
}
