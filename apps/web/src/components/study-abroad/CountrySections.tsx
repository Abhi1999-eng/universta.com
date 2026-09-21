'use client';

import { useId, useState } from 'react';
import { SectionHead } from './SectionHead';

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
  summary?: string | null;
  note: string | null;
  courseCount: number | null;
};

export function StudyPaths({
  paths,
  countryName,
  fields = [],
  n = null,
  alt,
}: {
  paths: StudyPath[];
  countryName: string;
  /** Subjects taught in the country, shown on every path as where it leads. */
  fields?: string[];
  n?: string | null;
  alt: boolean;
}) {
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
    <section className={`sec ${alt ? 'sec--paper' : 'sec--white'}`} id="study-paths">
      <div className="wrap">
        <SectionHead
          n={n}
          eyebrow="Study paths"
          title="Find your study path"
          lead={`Pick the route closest to where you are today. Entry rules, timelines and costs in ${countryName} all change with it.`}
        />

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
            /* The design shows a panel by data-active; with only `hidden`
               every panel, the selected one included, stayed display: none. */
            data-active={String(index === active)}
            hidden={index !== active}
          >
            <div className="path">
              <div>
                {path.summary ? <p className="path__summary">{path.summary}</p> : null}
                <dl className="path__stats">
                  {path.duration ? (
                    <div className="path__stat">
                      <dt>Typical duration</dt>
                      <dd>{path.duration}</dd>
                    </div>
                  ) : null}
                  {path.courseCount !== null ? (
                    <div className="path__stat">
                      <dt>Courses on Universta</dt>
                      <dd>{path.courseCount}</dd>
                    </div>
                  ) : null}
                </dl>
                {fields.length ? (
                  <div className="path__fields">
                    {fields.map((field) => (
                      <span className="pill" key={field}>
                        {field}
                      </span>
                    ))}
                  </div>
                ) : null}
                <button className="btn" type="button" data-open-assessment data-intent={`path-${path.id}`}>
                  Check My Eligibility{' '}
                  <span className="btn__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </button>
              </div>
              {path.entry || path.note ? (
                <div>
                  <p className="path__h">What you need to enter</p>
                  {path.entry ? (
                    <ul className="path__list">
                      <li>{path.entry}</li>
                    </ul>
                  ) : null}
                  <p className="path__note">
                    {path.note ??
                      'Durations and entry rules are typical for the level. Each programme sets its own, so check before you shortlist.'}
                  </p>
                </div>
              ) : null}
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
  n = null,
  alt,
}: {
  faqs: Array<{ id: string; question: string; answer: string }>;
  countryName: string;
  n?: string | null;
  alt: boolean;
}) {
  const [open, setOpen] = useState<string | null>(faqs[0]?.id ?? null);
  const base = useId().replace(/:/g, '');
  if (faqs.length === 0) return null;

  return (
    <section className={`sec ${alt ? 'sec--paper' : 'sec--white'}`} id="faq">
      <div className="wrap">
        <SectionHead
          n={n}
          eyebrow="Questions"
          title={`Straight answers about ${countryName}.`}
          lead="The questions students ask before they commit. If yours is not here, the assessment is the fastest way to a specific answer."
        />

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
                  /* The design shows an answer by data-open on the answer
                     itself; set only on the item, every answer stayed hidden. */
                  data-open={String(expanded)}
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
