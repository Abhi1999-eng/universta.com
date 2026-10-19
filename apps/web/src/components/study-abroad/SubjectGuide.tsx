import Link from 'next/link';
import type {
  Course,
  CourseLevelGroup,
  Media,
  SubjectDetail,
} from '@/lib/catalog';
import { counsellingHref } from '@/lib/counselling-link';
import { levelPageHref, levelPageLinks } from '@/lib/subject-levels';
import {
  levelCoursesHref,
  levelTotal,
  programmesHref,
  subjectLevelPages,
  subjectOfferedLevels,
} from '@/lib/course-levels';
import type { ProgrammeSample as Programmes } from '@/lib/programme-sample';
import { levelPickSentence, studyLevelPanels, type StudyLevelPanel } from '@/lib/study-levels';
import { aboutLine, levelFacts } from '@/lib/level-panel-info';
import { universityHref } from '@/lib/university-links';
import { RichText, richTextToPlainText } from '@/components/phase1/RichText';
import { formatNumber } from '@/lib/format';
import { sortByLevelOrder } from '@/lib/level-order';
import { CourseCards } from './CourseCards';
import { Crumbs } from './Crumbs';
import { LevelLinks } from './LevelLinks';
import { StudyLevels } from './StudyLevels';
import { LevelInfo } from './LevelInfo';
import { DestinationSwitcher } from './DestinationSwitcher';
import { firstSentence, splitLead } from './CountryGuideSections';
import {
  destinationsLead,
  rankDestinations,
  sparseBandClass,
  switcherClass,
  teachingDestinations,
  type CountedDestination,
} from './switcher';
import { ConnectBand, MatchBand } from './DiscoveryBands';
import { ConsultantsCta } from './ConsultantsCta';
import { Longform } from './Longform';
import { PlanBand } from './PlanBand';
import { allProgrammes, ProgrammeSample } from './ProgrammeSample';
import { SectionHead } from './SectionHead';
import { SubjectSpecializations } from './SubjectSpecializations';
import { FUNDING_CAVEAT, ScholarshipCards } from './ScholarshipCards';
import type { ScholarshipCard } from '@/lib/scholarship-card';

/** A neighbouring subject, for the "Related subjects" band. */
export type RelatedSubject = {
  id: string;
  name: string;
  slug: string;
  iconMedia?: Media | null;
};

/** The subject's generic mark, where a record has no icon of its own. */
function SubjectGlyph({ media, stroke = '1.4' }: { media?: Media | null; stroke?: string }) {
  return media ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={media.url} alt="" />
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}>
      <path d="M4 5h16v14H4z M4 9h16" />
    </svg>
  );
}

/**
 * A subject's guide, in the approved design.
 *
 * The reference builds subjects from the same stylesheet and the same section
 * bands as the country guides, so this is the study-abroad language rather
 * than a second one: numbered eyebrows, paper and white alternating, the
 * closing navy band.
 *
 * Sections stand down rather than render empty, and both the numbering and the
 * shade are taken from what actually renders, so a subject with no courses yet
 * still reads as a finished page and never shows two paper bands touching.
 */
export function SubjectGuide({
  subject,
  scholarships,
  universities = [],
  universityTotal,
  levels: levelGroups = null,
  catalogue = null,
  related = [],
  programmes = null,
  levelIntros = {},
}: {
  subject: SubjectDetail;
  scholarships: ScholarshipCard[];
  /** Cross-links only: the reference gives a subject no universities section,
   *  so these close the page in the connect band rather than open one. */
  universities?: Array<{ id: string; name: string; slug: string }>;
  /** How many universities teach it in all. The page reads a handful to
   *  link to, and its figure used to be the size of that handful. */
  universityTotal?: number | null;
  /** The subject's courses filed under their study levels, in academic
   *  order. Absent when that read failed; the six mixed courses the subject
   *  carries are shown instead, as they were before. */
  levels?: CourseLevelGroup[] | null;
  /** The catalogue's study levels, the active ones: a level the subject is
   *  offered at that has been switched off opens no page. Null when that
   *  read failed. */
  catalogue?: ReadonlyArray<{ code: string; description?: string | null }> | null;
  /** Subjects that share a specialization with this one, closest first. */
  related?: RelatedSubject[];
  /** The first of the universities' programmes in it, and how many there
   *  are. Null when there are none or they could not be read. */
  programmes?: Programmes | null;
  /** The intros editors wrote on its level pages, by level code. */
  levelIntros?: Record<string, string>;
}) {
  const specializations = subject.subSubjects ?? [];
  /* The places that teach it first, most programmes first: the band used to
     open on Afghanistan, Albania and Algeria, which list every subject and
     teach none of this one. */
  const countries = rankDestinations(
    (subject.countries ?? []) as CountedDestination[],
  );
  const teaching = teachingDestinations(countries);
  const courses: Course[] = subject.featuredCourses ?? [];
  const groups = levelGroups ?? [];
  /* The levels the subject has pages for -- ticked on it, together with
     its specializations' -- so the block links only to those. */
  const pages = subjectLevelPages(subject, catalogue);
  /* In academic order where the grouped read supplied it; the subject's own
     counts arrive in that order too. */
  const levels = groups.length ? groups : (subject.courseCountsByLevel ?? []);
  const levelOrder = levels.flatMap((row) => (row.level.code ? [row.level.code] : []));
  /* The subject's page at each level, by its plain address. Each level's
     panel ends with it; the panel's heading opens the course-guide view,
     which is noindex, so without this a level page had no link from its
     own subject. */
  /* The order the links follow: the catalogue's, where it was read; else
     the subject's `levels`, which the API sends in climbing order; else the
     block's. The block's alone lacks the levels nothing is filed at (the
     grouped read sends only levels with courses), and put those last. */
  const linkOrder = catalogue?.length
    ? catalogue.map((level) => level.code)
    : [
        ...new Set([
          ...(subject.levels ?? []).flatMap((level) => (level.code ? [level.code] : [])),
          ...levelOrder,
        ]),
      ];
  const levelLinks = levelPageLinks(
    sortByLevelOrder(subjectOfferedLevels(subject), linkOrder),
    { subject: subject.slug },
    catalogue,
  );
  /* The levels as a toggle, one panel each: its courses, the
     specializations taught at it, and its own page. */
  const panels = studyLevelPanels(groups, specializations);
  const ownPage = new Map(levelLinks.map((link) => [link.code, link.href]));
  /* A level page with no panel: only when a read failed (no groups, or
     no catalogue to add the levels nothing is filed at). It is still
     linked, in a row of its own. */
  const unpanelled = levelLinks.filter(
    (link) => !groups.some((group) => group.level.code.toUpperCase() === link.code),
  );
  /* What each level's panel says first: its own page's intro where an
     editor wrote one, else the level's description in the catalogue, and
     the facts the page's reads already hold. */
  const levelAbout = (code: string) =>
    aboutLine(richTextToPlainText(levelIntros[code.toUpperCase()] ?? '')) ??
    aboutLine(catalogue?.find((level) => level.code.toUpperCase() === code.toUpperCase())?.description);
  const levelIntro = (panel: StudyLevelPanel) => (
    <LevelInfo
      about={levelAbout(panel.group.level.code)}
      facts={levelFacts({
        group: panel.group,
        programmes: programmes?.byLevel?.[panel.group.level.code.toUpperCase()] ?? null,
      })}
    />
  );
  /* Each specialization's own level pages, so a chip in a level's panel
     opens the specialization at that level -- and only where it has a
     page there, else the specialization itself. */
  const branchPages = new Map(
    specializations.map((branch) => [
      branch.slug,
      new Map(
        levelPageLinks(branch.levels, { subject: subject.slug, specialization: branch.slug }, catalogue).map(
          (link) => [link.code, link.href],
        ),
      ),
    ]),
  );
  const filed = levelTotal(groups);
  const tests = subject.tests ?? [];
  const overview = subject.overview?.trim();
  const hasOverview = Boolean(overview && richTextToPlainText(overview));
  /* The design sets the overview's opening on the page, large, and the
     reference shows the whole of it. Only the opening was hidden behind
     the toggle before, so the section read as a counts line and a button.
     The first paragraph leads; anything after it opens under the toggle. */
  const split = hasOverview ? splitLead(overview!) : null;
  /* The overview usually opens on the short description the hero has just
     printed, and the lead then said it a second time, word for word. */
  const said = subject.shortDescription?.replace(/\s+/g, ' ').trim();
  const leadText = split?.lead?.replace(/\s+/g, ' ').trim();
  const unsaid =
    leadText && said && leadText.startsWith(said)
      ? leadText.slice(said.length).trim()
      : leadText;
  const opening = unsaid ? firstSentence(unsaid) : null;
  /* With the facts line gone, an overview that only repeats the hero's
     short description leaves the band nothing of its own to show. */
  const hasAbout = Boolean(opening || split?.rest);
  const universityCount = universityTotal ?? universities.length;
  const counselling = counsellingHref({
    source: 'subject',
    subject: subject.slug,
    from: `/subjects/${subject.slug}`,
  });

  /* The universities' programmes in it, where any are listed. The design
     counts those as "Programmes profiled"; while there are none the figure
     is the catalogue's courses, as it always was, and once there are the
     courses keep a figure of their own. */
  const sampled = programmes?.cards.length ? programmes : null;
  /* Every other count on the page is of the catalogue's courses: the
     specializations' and the destinations'. Beside the
     programmes they are called courses, as the level block's are, or a
     chip saying "6 programmes" opens a page listing 15. */
  const noun = sampled ? 'course' : 'programme';
  const counted = (count: number) =>
    `${formatNumber(count)} ${count === 1 ? noun : `${noun}s`}`;

  const order: string[] = [];
  if (hasAbout) order.push('about');
  if (specializations.length) order.push('specializations');
  if (countries.length) order.push('destinations');
  if (sampled) order.push('courses');
  if (groups.length || courses.length || levelLinks.length) order.push('programs');
  if (tests.length) order.push('tests');
  /* Funding, then the consultants hand-off; with no awards recorded the
     hand-off stands alone, as on a specialization's page -- the reference
     shows consultants on every subject page, awards or not. */
  order.push(scholarships.length ? 'scholarship-funding' : 'consultants');
  if (related.length) order.push('related-subjects');

  const n = (id: string) => {
    const index = order.indexOf(id);
    return index < 0 ? null : String(index + 1).padStart(2, '0');
  };
  const band = (id: string) =>
    order.indexOf(id) % 2 === 0 ? 'sec sec--paper' : 'sec sec--white';

  return (
    <>
      <section className="hero hero--compact">
        <div className="wrap">
          <Crumbs
            trail={[
              { label: 'Home', href: '/' },
              { label: 'Subjects', href: '/subjects' },
              { label: subject.name },
            ]}
          />
          <div className="subjhero">
            <span className="subjhero__icon" aria-hidden="true">
              <SubjectGlyph media={subject.iconMedia} />
            </span>
            <div>
              <h1 className="hero__h1">Study {subject.name} abroad</h1>
              {subject.shortDescription ? (
                <p className="hero__sub">{subject.shortDescription}</p>
              ) : null}
              <div className="btn-row" style={{ marginTop: 22 }}>
                <Link
                  className="btn btn--lg"
                  href={`/courses?subject=${subject.slug}`}
                >
                  Find my programmes{' '}
                  <span className="btn__arrow" aria-hidden="true">
                    →
                  </span>
                </Link>
                {/* The directory reads `?subject=`, so the button opens the
                    universities that teach it rather than all of them. */}
                <Link
                  className="btn btn--lg btn--ghost"
                  href={`/universities?subject=${subject.slug}`}
                >
                  Browse universities
                </Link>
              </div>
            </div>
          </div>
          {/* The hero image an editor set on the subject, under its name
              and its two ways in; a subject without one keeps the hero as
              it was. */}
          {subject.heroMedia?.url ? (
            <figure className="subjhero__media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={subject.heroMedia.url} alt={subject.heroMedia.alt ?? ''} loading="eager" />
            </figure>
          ) : null}
        </div>
      </section>

      {hasAbout ? (
        <section className={band('about')} id="about">
          <div className="wrap">
            <SectionHead n={n('about')} eyebrow="Overview" title={`About ${subject.name}`}>
              {/* No facts line of courses, specializations and destinations
                  under the overview: the client had it taken off, with the
                  facts box under the hero. */}
              {opening ? (
                <>
                  <p className="ov__lead">{opening.first}</p>
                  {opening.rest ? <p className="ov__more">{opening.rest}</p> : null}
                </>
              ) : null}
            </SectionHead>
            {split?.rest ? (
              <Longform label={`More about ${subject.name}`}>
                <div className="prose">
                  <RichText value={split.rest} />
                </div>
              </Longform>
            ) : null}
          </div>
        </section>
      ) : null}

      {specializations.length ? (
        <section className={band('specializations')} id="specializations">
          <div className="wrap">
            <SectionHead
              n={n('specializations')}
              eyebrow="Specializations"
              title="Choose a specialization"
              lead={`The branches of ${subject.name} we cover. Each one has its own page.`}
            />
            <SubjectSpecializations
              subjectSlug={subject.slug}
              branches={specializations}
              levelOrder={levelOrder}
              noun={noun}
              levelLinks={{
                catalogue: (catalogue ?? []).map((level) => level.code),
                order: linkOrder,
              }}
            />
          </div>
        </section>
      ) : null}

      {countries.length ? (
        <section
          className={band('destinations') + sparseBandClass(countries.length)}
          id="destinations"
        >
          <div className="wrap">
            <SectionHead
              n={n('destinations')}
              eyebrow="Destinations"
              title={`Destinations for ${subject.name}`}
              lead={destinationsLead({
                name: subject.name,
                countries,
                open: `Open one to see ${subject.name} there: its specializations and the programmes taught in it.`,
                legacy: `Open a destination to see ${subject.name} there: its specializations and the programmes taught in it.`,
              })}
            >
              {/* The section's link, set as one: it was a second grey
                  paragraph with no gap, and read as the sentence's last
                  line. */}
              <p className="sec-head__cta">
                <Link className="linkcta" href="/study-abroad">
                  All destinations{' '}
                  <span className="linkcta__arrow" aria-hidden="true">
                    →
                  </span>
                </Link>
              </p>
            </SectionHead>
            <DestinationSwitcher
              countries={countries}
              label={subject.name}
              within={subject.slug}
              noun={noun}
            />
          </div>
        </section>
      ) : null}

      {/* The design's programmes band: the universities' programmes in
          the subject, each naming where it is taught, and the way to all
          of them. Its count is taken from the very list the link opens. */}
      {sampled ? (
        <section className={band('courses')} id="courses">
          <div className="wrap">
            <SectionHead
              n={n('courses')}
              eyebrow="Programmes"
              /* The design's specialization page's title for the same
                 band; its subject page's ("courses in the catalogue")
                 would read as the course guides below. */
              title={`Where to study ${subject.name}`}
              lead={`${formatNumber(sampled.total)} ${sampled.total === 1 ? 'programme' : 'programmes'}${
                sampled.universities
                  ? ` at ${formatNumber(sampled.universities)} ${sampled.universities === 1 ? 'university' : 'universities'}`
                  : ''
              }, each as the university teaches it. This is our catalogue, not the whole sector.`}
            />
            <ProgrammeSample
              cards={sampled.cards}
              link={{
                href: programmesHref({ subject: subject.slug }),
                label: allProgrammes('View', sampled.total),
              }}
            />
          </div>
        </section>
      ) : null}

      {groups.length || courses.length || levelLinks.length ? (
        <section className={band('programs')} id="programs">
          <div className="wrap">
            {/* Beside the programmes above, these are the catalogue's
                courses, and are called that; on their own they keep the
                name they always had. Either way their counts are of
                courses, so their links open the finder's course guides,
                which list that many. */}
            <SectionHead
              n={n('programs')}
              eyebrow={sampled ? 'Courses' : 'Programmes'}
              title={
                groups.length
                  ? `${subject.name} ${sampled ? 'courses' : 'programmes'} by level`
                  : `${subject.name} ${sampled ? 'courses' : 'programmes'}`
              }
              lead={
                groups.length
                  ? filed
                    ? `${formatNumber(filed)} ${
                        sampled
                          ? filed === 1 ? 'course' : 'courses'
                          : filed === 1 ? 'programme' : 'programmes'
                      }, each under the level it is taught at.${levelPickSentence(panels)}`
                    : sampled
                      ? `No ${subject.name} course is listed yet. Courses are filed under these study levels as they are added.${levelPickSentence(panels)}`
                      : `No ${subject.name} programme is listed yet. Programmes are filed under these study levels as they are added.${levelPickSentence(panels)}`
                  : levels.length
                    ? levels
                        .map((row) => `${row.level.name} (${row.count})`)
                        .join(' · ')
                    : undefined
              }
            >
              {/* A search with nothing in it is not a way on. */}
              {filed || courses.length ? (
                <p className="sec-head__cta">
                  <Link
                    className="linkcta"
                    href={levelCoursesHref({ subject: subject.slug })}
                  >
                    Every {subject.name} {sampled ? 'course' : 'programme'}{' '}
                    <span className="linkcta__arrow" aria-hidden="true">
                      →
                    </span>
                  </Link>
                </p>
              ) : null}
            </SectionHead>
            {groups.length ? (
              /* The levels as a toggle, as a subject in a destination draws
                 them: one level at a time, its specializations, its courses
                 and, last, its own page. */
              <StudyLevels
                panels={panels}
                /* A level's course guides, on its own page where the
                   subject has one; a level with courses but no page (an
                   offering filed at another level than its course) opens
                   the finder's guides. */
                allHref={(level) =>
                  levelPageHref(pages, { subject: subject.slug, level, guides: true }) ??
                  levelCoursesHref({ subject: subject.slug, level })
                }
                courseHref={(course) => `/courses/${course.slug}`}
                specializationHref={(slug, level) =>
                  branchPages.get(slug)?.get(level.toUpperCase()) ?? `/subjects/${subject.slug}/${slug}`
                }
                elsewhere={{
                  href: (level) => ownPage.get(level.toUpperCase()) ?? null,
                  label: (level) => `Explore ${level} in ${subject.name}`,
                  button: true,
                }}
                intro={levelIntro}
              />
            ) : courses.length ? (
              <CourseCards courses={courses} />
            ) : null}
            {/* Its level pages with no panel above, which only a failed read
                leaves: still linked, never lost. */}
            <LevelLinks
              variant="chips"
              label={groups.length ? 'Other levels' : 'Choose a level'}
              links={unpanelled}
              field={subject.name}
            />
          </div>
        </section>
      ) : null}

      {tests.length ? (
        <section className={band('tests')} id="tests">
          <div className="wrap">
            <SectionHead
              n={n('tests')}
              eyebrow="Requirements"
              title={`Tests you may need for ${subject.name}`}
              lead="Language tests accepted by the destinations that teach this subject. Requirements are set per programme, so confirm with the university before you book one."
            />
            <div className="examtests">
              <div className="examtests__group">
                <p className="path__h">English language tests</p>
                <ul className="examtests__list">
                  {tests.map((test) => (
                    <li className="examchip" key={test.code}>
                      <span className="examchip__main">
                        <span className="examchip__name">{test.name}</span>
                        <span className="examchip__cat">
                          English language test
                        </span>
                      </span>
                      {test.minScore ? (
                        <span className="examchip__meta">
                          <em>Highest published minimum: {test.minScore}</em>
                        </span>
                      ) : null}
                      <span className="examchip__side">
                        <span className="badge badge--neutral">
                          Accepted by {test.countries}{' '}
                          {test.countries === 1 ? 'destination' : 'destinations'}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="examtests__note">
                  A destination that lists a test as optional still accepts it;
                  many waive it when your earlier study was in English.
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {scholarships.length ? (
        <section className={band('scholarship-funding')} id="scholarship-funding">
          <div className="wrap">
            <SectionHead
              n={n('scholarship-funding')}
              eyebrow="Funding"
              title={`Scholarships for ${subject.name}`}
              lead={`Awards recorded against this subject. ${FUNDING_CAVEAT}`}
            />
            <div className="schgroup">
              <div className="schgroup__head">
                <p className="path__h">
                  Recorded against {subject.name}{' '}
                  <span className="schgroup__n datum">{scholarships.length}</span>
                </p>
              </div>
              <ScholarshipCards scholarships={scholarships} />
            </div>
            <ConsultantsCta field={subject.name} />
          </div>
        </section>
      ) : (
        <section className={`${band('consultants')} sec--tight`} id="consultants">
          <div className="wrap">
            <ConsultantsCta field={subject.name} />
          </div>
        </section>
      )}

      {/* The reference ends a subject with its neighbours, so a reader on the
          wrong page can step sideways rather than back to the full list. It
          is as long as the data makes it, and absent when nothing is shared. */}
      {related.length ? (
        <section
          className={`${band('related-subjects')} sec--tight`}
          id="related-subjects"
        >
          <div className="wrap">
            {/* The compact head the specialization page gives its own
                "Related" band: a secondary section, not a chapter. */}
            <div className="sec-head sec-head--compact">
              <div>
                <p className="eyebrow">
                  <span className="eyebrow__n">{n('related-subjects')}</span>{' '}
                  Related
                </p>
                <h2 className="sec-title sec-title--sm">Related subjects</h2>
                <p className="sec-lead">
                  Subjects that share specializations with {subject.name}.
                </p>
              </div>
            </div>
            <div className={switcherClass(related.length)}>
              {related.map((row) => (
                <Link
                  key={row.id}
                  className="switcher__item"
                  href={`/subjects/${row.slug}`}
                >
                  <span className="subjcard__icon subjrel__icon" aria-hidden="true">
                    <SubjectGlyph media={row.iconMedia} stroke="1.5" />
                  </span>
                  <span className="cchip__name">{row.name}</span>
                  <span className="switcher__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </Link>
              ))}
            </div>
            <p className="h-more">
              <Link className="linkcta" href="/subjects">
                All subjects{' '}
                <span className="linkcta__arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </p>
          </div>
        </section>
      ) : null}

      <MatchBand
        heading="Found your field?"
        href={`/courses?subject=${subject.slug}`}
        talkHref={counselling}
      />

      <PlanBand
        heading={`Thinking about ${subject.name}?`}
        body="Tell us your academic profile, goals and budget, and we'll show you which destinations run it and what you would need."
        secondary={{ href: '/subjects', label: 'Browse all subjects' }}
      />

      <ConnectBand
        actions={[
          { href: `/courses?subject=${subject.slug}`, label: 'Explore courses' },
          {
            href: `/scholarships?subject=${subject.slug}`,
            label: 'Find scholarships',
            ghost: true,
          },
          /* The enquiry arrives saying which subject it was about, rather
             than as a blank contact form. */
          { href: counselling, label: 'Talk to a Universta advisor', ghost: true },
        ]}
        groups={[
          {
            title: 'Specializations',
            items: specializations.map((row) => ({
              id: row.id,
              name: row.name,
              href: `/subjects/${subject.slug}/${row.slug}`,
            })),
          },
          /* The same places the band above opens on, each opening the subject
             there rather than the country's general guide. */
          {
            title: 'Destinations',
            items: (teaching.length ? teaching : countries).map((row) => ({
              id: row.id,
              name: row.name,
              href: `/study-abroad/${row.slug}/${subject.slug}`,
              note: row.courseCount ? counted(row.courseCount) : null,
            })),
            total: teaching.length || countries.length,
          },
          {
            title: 'Universities',
            items: universities.map((row) => ({
              id: row.id,
              name: row.name,
              href: universityHref(row.slug),
            })),
            total: universityCount,
          },
        ]}
      />
    </>
  );
}
