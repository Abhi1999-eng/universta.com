import Link from 'next/link';
import {
  COMPARE_LIMIT,
  COMPARE_ROWS,
  compareMarks,
  withoutSlug,
  type CompareCell,
  type CompareColumn,
  type CompareOption,
  type CompareRowKey,
} from '@/lib/course-compare';
import { AssessmentCta } from './AssessmentCta';
import {
  CompareAddPicker,
  CompareRemoveLink,
  CompareSync,
  StoredShortlist,
} from './CourseCompare';
import { Crumbs } from './Crumbs';
import { PlanBand } from './PlanBand';

/**
 * Programmes side by side, at /compare/courses, in the design's comparison:
 * a compact hero with the "Add a course…" list, the twelve-row table with a
 * Remove under each programme, the "Which course fits me best?" card and
 * the plan band.
 *
 * The behaviour is the reference's: the address names the programmes, so a
 * comparison can be shared and comes back the same; each Remove is a link
 * to the same comparison without that one; and whatever the address names
 * that the catalogue cannot find is said plainly rather than dropped. The
 * shortlist on this device follows the address, so the tray elsewhere
 * shows what was last compared.
 *
 * The design never names a winner. The lower tuition and the shorter
 * duration are marked only where the figures can honestly be set side by
 * side, and the note under the table says that neither makes a course
 * better.
 */

const MARKED: Partial<Record<CompareRowKey, string>> = {
  tuition: 'lowest tuition',
  duration: 'shortest',
};

function Cell({ cell, best }: { cell: CompareCell; best: string | null }) {
  const body = cell.href ? (
    cell.external ? (
      <a href={cell.href} rel="nofollow noopener" target="_blank">
        {/* One string: the compiler drops the space before an entity that
            follows an expression. */}
        {`${cell.value} ↗`}
      </a>
    ) : (
      <Link href={cell.href}>{cell.value}</Link>
    )
  ) : (
    cell.value
  );
  return (
    <>
      {best ? (
        <b>{body}</b>
      ) : (
        <span className={cell.missing ? 'uc-none' : undefined}>{body}</span>
      )}
      {best ? <span className="sr-only"> ({best})</span> : null}
      {cell.note ? <span className="cmpnote">{cell.note}</span> : null}
    </>
  );
}

export function CourseComparePage({
  requested,
  columns,
  invalid,
  options,
  unavailable = false,
}: {
  /** The programmes the address names, in its order. */
  requested: string[];
  columns: CompareColumn[];
  /** What the address names that the catalogue has no live programme for. */
  invalid: string[];
  options: CompareOption[];
  /** The comparison could not be read at all: an outage, not an empty list. */
  unavailable?: boolean;
}) {
  const marks = compareMarks(columns);

  return (
    <>
      <section className="hero hero--compact comparehero">
        <div className="wrap">
          <Crumbs
            trail={[
              { label: 'Home', href: '/' },
              { label: 'Courses', href: '/courses' },
              { label: 'Compare' },
            ]}
          />

          <div className="hero__lead">
            <p className="hero__eyebrow">
              Comparison<b>·</b>up to {COMPARE_LIMIT} courses
            </p>
            <h1 className="hero__h1">Compare courses side by side</h1>
            <p className="hero__sub">
              University, degree, duration, tuition, language, intake, deadline,
              eligibility and location, in one view.
            </p>
          </div>

          <CompareAddPicker
            options={options}
            picked={columns.map((column) => column.slug)}
          />
        </div>
      </section>

      <section className="sec sec--white" id="comparison">
        <div className="wrap">
          <h2 className="sr-only">Comparison</h2>

          {unavailable ? (
            <p className="uc-missing" role="status">
              The comparison could not be loaded just now. Please try again in a
              moment.
            </p>
          ) : null}

          {invalid.length ? (
            <div className="uc-missing compare-invalid" role="status">
              <p>
                {invalid.length === 1
                  ? 'This is not a published course in our catalogue, so it is left out:'
                  : 'These are not published courses in our catalogue, so they are left out:'}
              </p>
              <ul>
                {invalid.map((slug) => (
                  <li key={slug}>
                    <code>{slug}</code>{' '}
                    <CompareRemoveLink
                      className="cmpremove"
                      href={withoutSlug(requested, slug)}
                      slug={slug}
                      label={`Remove ${slug} from the address`}
                    >
                      Remove
                    </CompareRemoveLink>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {columns.length ? (
            <>
              <div className="tablewrap">
                <table className="data comparetable">
                  <caption className="sr-only">Course comparison</caption>
                  <thead>
                    <tr>
                      <th scope="col">
                        <span className="sr-only">Attribute</span>
                      </th>
                      {columns.map((column) => (
                        <th scope="col" key={column.slug}>
                          <span className="cmphead">
                            <span className="unimark unimark--xs" aria-hidden="true">
                              {column.initials}
                            </span>
                            {column.href ? (
                              <Link className="cmphead__name" href={column.href}>
                                {column.name}
                              </Link>
                            ) : (
                              <span className="cmphead__name">{column.name}</span>
                            )}
                            {column.meta ? (
                              <span className="cmphead__meta">{column.meta}</span>
                            ) : null}
                            <CompareRemoveLink
                              className="cmpremove"
                              href={withoutSlug(requested, column.slug)}
                              slug={column.slug}
                              label={`Remove ${column.name}, ${column.university}, from the comparison`}
                            >
                              Remove
                            </CompareRemoveLink>
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARE_ROWS.map((row) => (
                      <tr key={row.key}>
                        <th scope="row">{row.label}</th>
                        {columns.map((column, index) => {
                          const best = marks[row.key] === index ? MARKED[row.key]! : null;
                          return (
                            <td key={column.slug} className={best ? 'is-best' : undefined}>
                              <Cell cell={column.cells[row.key]} best={best} />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="trust__note">
                Where two courses differ on a number you can compare directly, the
                lower tuition and shorter duration are marked. Tuition is marked
                only when every course states its fee in the same currency for the
                same period. Neither makes a course better for you.
              </p>

              <div className="magnet">
                <div>
                  <h3 className="magnet__t">Which course fits me best?</h3>
                  <p className="magnet__b">
                    Tell us your background, grades, language score and budget,
                    and a counsellor will help you weigh these courses against
                    them.
                  </p>
                </div>
                <AssessmentCta
                  className="btn btn--onnavy btn--lg"
                  intent="compare-courses"
                  arrow={false}
                >
                  Help me choose{' '}
                  <span className="btn__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </AssessmentCta>
              </div>
            </>
          ) : (
            <div className="compare-empty">
              <p className="ov__lead">No courses selected yet.</p>
              {/* With nothing to add, the list above is disabled and no
                  card carries a Compare tick, so the page says why rather
                  than asking for either. */}
              <p className="sec-lead">
                {options.length
                  ? 'Tick Compare on any course card, or add courses above. Your selection is remembered on this device.'
                  : 'No programmes are listed to compare yet.'}
              </p>
              {/* Only on the bare address: one that names programmes is
                  answered by them, found or not. */}
              {requested.length ? null : <StoredShortlist />}
              <div className="btn-row compare-empty__actions">
                <Link className="btn" href="/courses">
                  Search courses{' '}
                  <span className="btn__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      <PlanBand secondary={{ href: '/courses', label: 'Search courses' }} />

      <CompareSync
        items={columns.map((column) => ({
          slug: column.slug,
          name: `${column.name} · ${column.university}`,
        }))}
      />
    </>
  );
}
