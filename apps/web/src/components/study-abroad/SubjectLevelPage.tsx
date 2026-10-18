import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { getCourseFilterOptions, getCourseLevels, getCourses, getSpecialization, getSubject, getSubjectLevelPage } from '@/lib/catalog';
import { hasLevelPage, levelsOnBar, specializationLevelPages, subjectLevelPages } from '@/lib/course-levels';
import { checkGuideFilters, guideApiParams, guideListSearch, guidesAsProgrammes, isNarrowedCourses, PROGRAMME_MAX_PAGES, readGuideFilters, requestedView, withoutIgnored } from '@/lib/courses-params';
import { countryFaqJsonLd } from '@/lib/country-faq';
import { durationFigure, figuresHere, intakeFigure, listedIntakes, programmeCountsHere } from '@/lib/country-subject';
import { formatNumber } from '@/lib/format';
import { jsonLdString } from '@/lib/json-ld';
import { levelPageDescription, levelPageIndexable, specializationsAtLevel } from '@/lib/level-page';
import { phaseProgrammes } from '@/lib/phase1';
import { programmeList } from '@/lib/programme-sample';
import { resolvedMetadata, titleWithSuffix, writtenSeo } from '@/lib/seo-management';
import { findSubjectLevel, subjectLevelHref, subjectLevelSlug } from '@/lib/subject-levels';
import { courseApiParams, courseListSearch, readCourseFilters, toProgrammeList, withoutScope, type CourseScope } from '@/lib/university-courses';
import { breadcrumbJsonLd } from '@/lib/university-json-ld';
import { CourseGuidesResults } from '@/components/reference/CourseGuidesResults';
import { CompareTray } from './CourseCompare';
import { FiguresStrip, SpecializationChips } from './CountryFieldHero';
import { Crumbs } from './Crumbs';
import { LevelIntro, LevelWrittenSections, levelFaqs } from './LevelPageSections';
import { PlanBand } from './PlanBand';
import { ProgrammeResults } from './ProgrammeResults';

export type SubjectLevelParams = { slug: string; specializationSlug?: string; levelSlug: string };
type SearchParams = Record<string, string | string[] | undefined>;

const load = cache(async (slug: string, specializationSlug: string | undefined, levelSlug: string) => {
  const [subject, specialization, levels, levelPage] = await Promise.all([
    getSubject(slug).catch(() => null),
    specializationSlug ? getSpecialization(slug, specializationSlug).catch(() => null) : Promise.resolve(null),
    getCourseLevels(),
    /* What an editor wrote for the page, read beside the records rather
       than after them: the API takes the level as the address spells it.
       None, or a failed read, leaves the catalogue's list on its own. */
    getSubjectLevelPage({ subject: slug, specialization: specializationSlug, level: levelSlug }).catch(() => null),
  ]);
  const level = findSubjectLevel(levels, levelSlug);
  if (!subject || !level || (specializationSlug && !specialization)) return null;
  /* A field has a page only at the levels it is offered at (or, offered at
     none, the six named ones, unclaimed). Any other level is a 404, and
     decided here, before the alias redirect: /x/ug for a field with no
     Bachelor's is not found, rather than sent on to a page that is not. A
     specialization answers for its own levels, not its subject's. Only
     levels the catalogue still lists count: a field offered at switched-off
     levels alone is offered at nothing, and shows the six. */
  const pages = specialization ? specializationLevelPages(specialization, levels) : subjectLevelPages(subject, levels);
  if (!hasLevelPage(pages, level.code)) return null;
  const base = subjectLevelHref({ subject: subject.slug, specialization: specialization?.slug, level: level.code });
  const scope: CourseScope = {
    subject: [subject.slug],
    ...(specialization ? { specialization: [specialization.slug] } : {}),
    level: [level.code],
  };
  return {
    subject, specialization, level, levels, base, scope, pages,
    /* The subject's own level pages, for a specialization's way up to
       its subject at the same level. */
    subjectPages: subjectLevelPages(subject, levels),
    /* The page's own words, only for this very level: the API reads an
       alias the same way, and anything else is not this page's. */
    levelPage: levelPage?.level.code === level.code ? levelPage : null,
  };
});

/** The path owns these dimensions, even if a query asks for another field. */
function searchWithoutPath(raw: SearchParams, specialization: boolean): SearchParams {
  const next = { ...raw };
  delete next.subject;
  delete next.level;
  delete next.courseLevel;
  if (specialization) {
    delete next.specialization;
    delete next.subSubject;
  }
  return next;
}

function queryString(raw: SearchParams) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(raw))
    for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, entry);
  return query.size ? `?${query}` : '';
}

/** The programme filters an address asks for: the path's own taken out, and
 *  the run capped where the page stops drawing it. */
function askedFilters(raw: SearchParams | URLSearchParams, scope: CourseScope) {
  const read = withoutScope(readCourseFilters(raw), scope);
  return { ...read, page: Math.min(read.page, PROGRAMME_MAX_PAGES) };
}

/* The programmes the page lists, read once a request. The metadata needs
   their count -- a level page with fewer than three is kept out of the
   index -- and the page draws them; `cache` keeps the two to one
   /programmes read, as `load` does for the records. Keyed by the address's
   own query, which both build the same way (`searchWithoutPath`), so they
   ask for the very same list. The summary it carries is counted over the
   path's scope, not the reader's filters, so a filtered address still
   reads the page's own figures. */
const programmesAt = cache(async (slug: string, specializationSlug: string | undefined, levelSlug: string, query: string) => {
  const data = await load(slug, specializationSlug, levelSlug);
  return data ? programmeList(askedFilters(new URLSearchParams(query), data.scope), data.scope) : null;
});

export async function subjectLevelMetadata(params: Promise<SubjectLevelParams>, searchParams: Promise<SearchParams>): Promise<Metadata> {
  const { slug, specializationSlug, levelSlug } = await params;
  const data = await load(slug, specializationSlug, levelSlug);
  if (!data) return { title: 'Study level not found', robots: { index: false, follow: true } };
  const field = data.specialization ?? data.subject;
  const raw = searchWithoutPath(await searchParams, Boolean(data.specialization));
  const narrowed = isNarrowedCourses(raw);
  /* An alias address only redirects, so its list is never drawn and not
     worth reading. */
  const list = levelSlug === subjectLevelSlug(data.level.code)
    ? await programmesAt(slug, specializationSlug, levelSlug, queryString(raw))
    : null;
  /* The page's own title and description where an editor or the Level
     pages template wrote one; otherwise the page says what it lists. */
  const own = writtenSeo(data.levelPage?.seo);
  const title = `${data.level.name} in ${field.name}`;
  const description = own?.metaDescription
    ?? levelPageDescription({ level: data.level.name, field: field.name, summary: list?.summary ?? null });
  const meta = resolvedMetadata(own, title, description, data.base);
  return {
    ...meta,
    title: { absolute: titleWithSuffix(own?.seoTitle ?? title, data.levelPage?.seo) },
    /* A narrowed address is a view of the page, not the page. */
    alternates: narrowed ? undefined : meta.alternates,
    robots: {
      index: levelPageIndexable({
        narrowed,
        claimed: data.pages.claimed,
        /* The level page's own setting (or its template's), and the
           field's: a specialization's robots=false keeps its level pages
           out as well as its own. */
        robots: [data.levelPage?.seo?.robotsIndex, data.subject.seo?.robotsIndex, data.specialization?.seo?.robotsIndex],
        programmes: list ? list.summary.programmes : null,
        ownContent: data.levelPage?.hasOwnContent === true,
      }),
      follow: data.levelPage?.seo?.robotsFollow ?? true,
    },
  };
}

const EMPTY_GUIDES = { data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } };

export async function SubjectLevelPage({ params, searchParams }: {
  params: Promise<SubjectLevelParams>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug, specializationSlug, levelSlug } = await params;
  const data = await load(slug, specializationSlug, levelSlug);
  if (!data) notFound();
  const { subject, specialization, level, levels, scope, base, pages, subjectPages, levelPage } = data;
  const raw = searchWithoutPath(await searchParams, Boolean(specialization));
  if (levelSlug !== subjectLevelSlug(level.code)) permanentRedirect(`${base}${queryString(raw)}`);
  const field = specialization ?? subject;
  const fieldHref = specialization ? `/subjects/${subject.slug}/${specialization.slug}` : `/subjects/${subject.slug}`;
  const view = requestedView(raw) === 'guides' ? 'guides' : 'programmes';
  const asked = askedFilters(raw, scope);
  const guideScope = {
    subject: [subject.slug],
    ...(specialization ? { subSubject: [specialization.slug] } : {}),
    level: [level.code],
  };
  const fixedGuideParams = {
    subject: subject.slug,
    ...(specialization ? { subSubject: specialization.slug } : {}),
    level: level.code,
  };
  const [list, catalogueOptions, guideCatalogue] = await Promise.all([
    programmesAt(slug, specializationSlug, levelSlug, queryString(raw)),
    getCourseFilterOptions().catch(() => null),
    getCourses({ ...fixedGuideParams, pageSize: '1' }).catch(() => null),
  ]);
  const programmeFilters = list ? withoutIgnored(asked, list.ignored) : asked;
  const checked = catalogueOptions ? checkGuideFilters(readGuideFilters(raw), catalogueOptions) : null;
  const guideFilters = checked?.filters ?? readGuideFilters(raw);
  const guideParams = checked ? { ...guideApiParams(checked.api), ...fixedGuideParams } : fixedGuideParams;
  const guideResults = view === 'guides' && checked
    ? await Promise.all([
        checked.nothing ? Promise.resolve(EMPTY_GUIDES) : getCourses(guideParams).catch(() => null),
        getCourseFilterOptions(guideParams).catch(() => null),
      ]) : null;
  let taught: string[] = [];
  const guideRows = guideResults?.[0]?.data ?? [];
  if (guideRows.length && list) {
    try {
      const offeringGuides = toProgrammeList(await phaseProgrammes({
        ...courseApiParams(readCourseFilters({}), 1, scope),
        course: guideRows.map((course) => course.slug).join(','),
        limit: '1',
      }), readCourseFilters({}));
      taught = offeringGuides.facets.course.filter((option) => option.count > 0).map((option) => option.value);
    } catch { /* Course-guide links remain available if programme counts cannot be read. */ }
  }
  const switchProgramme = `${base}${courseListSearch(programmeFilters, view === 'guides' ? guidesAsProgrammes(guideFilters) : {})}#discovery`;
  const switchGuides = `${base}${guideListSearch(guideFilters, { page: 1 }, { view: true })}#discovery`;
  const suggestions = new URLSearchParams({ with: 'programmes', ...fixedGuideParams });
  const trail = [
    { label: 'Home', href: '/' },
    { label: 'Subjects', href: '/subjects' },
    { label: subject.name, href: `/subjects/${subject.slug}` },
    ...(specialization ? [{ label: specialization.name, href: fieldHref }] : []),
    { label: level.name },
  ];
  /* The levels the field has pages for, and only those: every chip opens
     a page that exists. */
  const barLevels = levelsOnBar(levels, pages);
  const levelQuery = view === 'guides'
    ? guideListSearch(guideFilters, { page: 1 }, { view: true })
    : courseListSearch(programmeFilters);
  /* What the level is, as an editor describes it in Admin, Study levels;
     the fixed line where nothing is written. Plain text, so printed as
     text. */
  const lead = level.description?.trim() || 'Explore published programmes by destination, university, fees, intake and entry requirements.';
  /* The level's figures, from the programme read the list already made:
     counted over the path, not the filters, so they stay put while the
     reader narrows the list -- the finder's hero does the same. Each stands
     down at zero, and with none there is no strip. The Programmes figure is
     the switcher's "(n)", so the two always agree. */
  const figures = list ? figuresHere({
    programmes: list.summary.programmes,
    universities: list.summary.universities,
    countries: list.summary.countries,
    intakes: intakeFigure(listedIntakes(list.facets.intake)),
    duration: durationFigure(list.facets.duration),
  }) : [];
  /* The field's specializations at this level, each opening on its own
     page at it. On a subject's page they are counted from the programme
     read's specialization options -- over subject and level, as the chip's
     page counts them; on a specialization's the read is fixed to that one
     branch, so its siblings go uncounted rather than cost a second read. */
  const atLevel = specializationsAtLevel(subject.subSubjects, level.code, {
    counts: !specialization && list ? programmeCountsHere(list.facets.specialization) : null,
    except: specialization?.slug,
  });
  /* From a specialization, up to its subject at the same level -- where
     the subject has that page, which it normally does: a published
     specialization's levels are its subject's too. */
  const upHref = specialization && hasLevelPage(subjectPages, level.code)
    ? subjectLevelHref({ subject: subject.slug, level: level.code })
    : null;
  /* Where a reader goes from a level with nothing listed, or nothing left
     after their filters: the other view when it has something, the field
     at every level, and from a specialization its subject at this level. */
  const waysOn = (also: Array<{ href: string; label: string }>) => [
    ...also,
    { href: fieldHref, label: `${field.name} at every study level` },
    ...(upHref ? [{ href: upHref, label: `${level.name} in ${subject.name}` }] : []),
  ].map((link) => <p key={link.href}><Link className="linkcta" href={link.href}>{link.label}{' '}<span className="linkcta__arrow" aria-hidden="true">&rarr;</span></Link></p>);
  const content = levelPage?.content ?? null;
  const faqData = countryFaqJsonLd(levelFaqs(content));
  return <>
    {/* The crumbs the hero draws, as structured data: the same trail, with
        absolute addresses, and the page itself named by its canonical path
        whatever filters the address carries. */}
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd(trail, base)) }} />
    {/* The questions the page answers, as the page draws them. */}
    {faqData ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(faqData) }} /> : null}
    <section className="hero hero--compact">
      <div className="wrap">
        <Crumbs trail={trail} />
        <div className="hero__lead">
          <p className="hero__eyebrow">Study level <b>·</b> {level.name}</p>
          <h1 className="hero__h1">{level.name} in {field.name}</h1>
          <p className="hero__sub">{lead}</p>
        </div>
        <FiguresStrip figures={figures} />
        <nav className="levelbar levelbar--wide" aria-label="Study levels">
          {barLevels.map((row) => <Link
            className="chipbtn" key={row.id}
            href={`${subjectLevelHref({ subject: subject.slug, specialization: specialization?.slug, level: row.code })}${levelQuery}`}
            aria-current={row.code === level.code ? 'page' : undefined}
          >{row.name}</Link>)}
        </nav>
        <SpecializationChips
          label={specialization ? `Other ${subject.name} specializations at ${level.name}` : `Specializations at ${level.name}`}
          chips={atLevel.map((row) => ({
            id: row.id, name: row.name, count: row.count,
            href: subjectLevelHref({ subject: subject.slug, specialization: row.slug, level: level.code }),
          }))}
        />
        {upHref ? <p className="levelup"><Link className="linkcta" href={upHref}>{level.name} in {subject.name}{' '}<span className="linkcta__arrow" aria-hidden="true">&rarr;</span></Link></p> : null}
      </div>
    </section>
    <LevelIntro intro={content?.intro} heading={`About ${level.name} in ${field.name}`} />
    <section className="sec sec--white sec--tight coursefinder" id="discovery">
      <div className="wrap">
        <h2 className="sr-only">{view === 'guides' ? 'Course guides' : 'Published programmes'} for {field.name} at {level.name}</h2>
        <nav className="switcher switcher--few cf-switch" aria-label="What to list">
          <Link className="switcher__item" href={switchProgramme} aria-current={view === 'programmes' ? 'page' : undefined} data-testid="switch-programmes">
            <span className="cf-switch__name">Programmes</span>{list ? <em className="cf-switch__n">({formatNumber(list.summary.programmes)})</em> : null}
          </Link>
          <Link className="switcher__item" href={switchGuides} aria-current={view === 'guides' ? 'page' : undefined} data-testid="switch-guides">
            <span className="cf-switch__name">Course guides</span>{guideCatalogue ? <em className="cf-switch__n">({formatNumber(guideCatalogue.meta.total)})</em> : null}
          </Link>
        </nav>
        <div id="courses" className="cf-results">
          {view === 'programmes' ? list ? <ProgrammeResults
            base={base} scope={scope} filters={programmeFilters} facets={list.facets} cards={list.cards} meta={list.meta}
            catalogueTotal={list.summary.programmes} suggestions={`/api/courses/suggestions?${suggestions}`}
            where={`for ${field.name} at ${level.name}`} idPrefix="subject-level"
            /* Said only when the whole level is empty, not when the
               reader's filters emptied it: that is about the catalogue. */
            empty={<>
              {list.summary.programmes === 0 ? <p>Not in our catalogue yet: that reflects what Universta lists, not what universities teach.</p> : null}
              {waysOn(guideCatalogue?.meta.total ? [{ href: switchGuides, label: `Course guides for ${level.name} in ${field.name}` }] : [])}
            </>}
          /> : <p role="status">Programmes are temporarily unavailable. <Link href={base}>Try again</Link>.</p>
          : guideResults?.[0] && guideResults?.[1] ? <CourseGuidesResults
            base={base} scope={guideScope} courses={guideResults[0].data} meta={guideResults[0].meta}
            filterOptions={guideResults[1]} filters={guideFilters} unknown={checked?.unknown ?? {}}
            paged={Boolean(raw.page || raw.pg || raw.pageSize)} viewParam programmes={Boolean(list?.summary.programmes)} taught={taught}
            where={`for ${field.name} at ${level.name}`}
            empty={<>{waysOn(list?.summary.programmes ? [{ href: switchProgramme, label: `Programmes for ${level.name} in ${field.name}` }] : [])}</>}
          /> : <p role="status">Course guides are temporarily unavailable. <Link href={switchGuides}>Try again</Link>.</p>}
        </div>
        <p className="trust__note">Programmes show each university’s published offering. Course guides describe the course across universities.</p>
      </div>
    </section>
    <LevelWrittenSections content={content} levelName={level.name} fieldName={field.name} />
    <CompareTray />
    {/* The nearest parent first: a specialization's level page offers its
        specialization, then its subject. */}
    <PlanBand
      heading={`Planning ${level.name} in ${field.name}?`}
      body="Tell us about your academic profile, goals and budget to explore your options."
      secondary={specialization ? { href: fieldHref, label: 'View specialization' } : { href: `/subjects/${subject.slug}`, label: 'View subject' }}
      more={specialization ? [{ href: `/subjects/${subject.slug}`, label: 'View subject' }] : undefined}
    />
  </>;
}
