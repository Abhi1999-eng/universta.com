'use client';

import { useId, useState } from 'react';

/**
 * The two sections of a country guide that need behaviour: the study-path tabs
 * and the FAQ accordion.
 *
 * Both follow the design's markup and both are operable from the keyboard --
 * the tabs with arrow keys as a tablist should be, the accordion as ordinary
 * buttons. The design's export used click handlers only.
 */

export type StudyPath = {
  id: string;
  label: string;
  duration: string | null;
  entry: string | null;
  note: string | null;
  courseCount: number | null;
};

export function StudyPaths({ paths, countryName }: { paths: StudyPath[]; countryName: string }) {
  const [active, setActive] = useState(0);
  const base = useId().replace(/:/g, '');
  if (paths.length === 0) return null;

  const onKey = (event: React.KeyboardEvent) => {
    const last = paths.length - 1;
    if (event.key === 'ArrowRight') setActive(active === last ? 0 : active + 1);
    else if (event.key === 'ArrowLeft') setActive(active === 0 ? last : active - 1);
    else if (event.key === 'Home') setActive(0);
    else if (event.key === 'End') setActive(last);
    else return;
    event.preventDefault();
  };

  return (
    <section className="sec sec--paper" id="study-paths">
      <div className="wrap">
        <p className="eyebrow">Study paths</p>
        <h2 className="sec-title">What you can study in {countryName}</h2>

        <div className="tabs__list" role="tablist" aria-label="Study levels" onKeyDown={onKey}>
          {paths.map((path, index) => (
            <button
              className="tabs__btn"
              type="button"
              role="tab"
              key={path.id}
              id={`${base}-tab-${path.id}`}
              aria-selected={index === active}
              aria-controls={`${base}-panel-${path.id}`}
              tabIndex={index === active ? 0 : -1}
              onClick={() => setActive(index)}
            >
              {path.label}
            </button>
          ))}
        </div>

        {paths.map((path, index) => (
          <div
            className="tabs__panel"
            role="tabpanel"
            key={path.id}
            id={`${base}-panel-${path.id}`}
            aria-labelledby={`${base}-tab-${path.id}`}
            hidden={index !== active}
          >
            <div className="path">
            <div className="path__stats">
              {path.duration ? (
                <div className="path__stat">
                  <span>Typical duration</span>
                  <b>{path.duration}</b>
                </div>
              ) : null}
              {path.entry ? (
                <div className="path__stat">
                  <span>Usual entry point</span>
                  <b>{path.entry}</b>
                </div>
              ) : null}
              {path.courseCount !== null ? (
                <div className="path__stat">
                  <span>Published courses</span>
                  <b>{path.courseCount}</b>
                </div>
              ) : null}
            </div>
            {path.note ? <p className="path__summary">{path.note}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function FaqAccordion({
  faqs,
  countryName,
}: {
  faqs: Array<{ id: string; question: string; answer: string }>;
  countryName: string;
}) {
  const [open, setOpen] = useState<string | null>(faqs[0]?.id ?? null);
  const base = useId().replace(/:/g, '');
  if (faqs.length === 0) return null;

  return (
    <section className="sec sec--paper" id="faq">
      <div className="wrap wrap--narrow">
        <p className="eyebrow">Questions</p>
        <h2 className="sec-title">Studying in {countryName}</h2>

        <div className="faq">
          {faqs.map((faq) => {
            const expanded = open === faq.id;
            return (
              <div className="faq__item" key={faq.id} data-open={String(expanded)}>
                <h3>
                  <button
                    className="faq__q"
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={`${base}-a-${faq.id}`}
                    id={`${base}-q-${faq.id}`}
                    onClick={() => setOpen(expanded ? null : faq.id)}
                  >
                    <span>{faq.question}</span>
                    <span className="faq__plus" aria-hidden="true" />
                  </button>
                </h3>
                <div
                  className="faq__a"
                  id={`${base}-a-${faq.id}`}
                  role="region"
                  aria-labelledby={`${base}-q-${faq.id}`}
                  hidden={!expanded}
                  /* Authored in the Admin WYSIWYG and sanitised by the API
                     before it is stored and again before it is served. */
                  dangerouslySetInnerHTML={{ __html: faq.answer }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
