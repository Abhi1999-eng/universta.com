import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { getCourseFilterOptions, getCourseLevels, getCourses, getSpecialization, getSubject } from '@/lib/catalog';
import { LEVELS_ALWAYS_SHOWN } from '@/lib/course-levels';
import { checkGuideFilters, guideApiParams, guideListSearch, guidesAsProgrammes, isNarrowedCourses, PROGRAMME_MAX_PAGES, readGuideFilters, requestedView, withoutIgnored } from '@/lib/courses-params';
import { formatNumber } from '@/lib/format';
import { phaseProgrammes } from '@/lib/phase1';
import { programmeList } from '@/lib/programme-sample';
import { findSubjectLevel, subjectLevelHref, subjectLevelSlug } from '@/lib/subject-levels';
import { courseApiParams, courseListSearch, readCourseFilters, toProgrammeList, withoutScope, type CourseScope } from '@/lib/university-courses';
import { CourseGuidesResults } from '@/components/reference/CourseGuidesResults';
import { CompareTray } from './CourseCompare';
import { Crumbs } from './Crumbs';
import { PlanBand } from './PlanBand';
import { ProgrammeResults } from './ProgrammeResults';

export type SubjectLevelParams = { slug: string; specializationSlug?: string; levelSlug: string };
type SearchParams = Record<string, string | string[] | undefined>;

const load = cache(async (slug: string, specializationSlug: string | undefined, levelSlug: string) => {
  const [subject, specialization, levels] = await Promise.all([
    getSubject(slug).catch(() => null),
    specializationSlug ? getSpecialization(slug, specializationSlug).catch(() => null) : Promise.resolve(null),
    getCourseLevels(),
  ]);
  const level = findSubjectLevel(levels, levelSlug);
  if (!subject || !level || (specializationSlug && !specialization)) return null;
  const base = subjectLevelHref({ subject: subject.slug, specialization: specialization?.slug, level: level.code });
  const scope: CourseScope = {
    subject: [subject.slug],
    ...(specialization ? { specialization: [specialization.slug] } : {}),
    level: [level.code],
  };
  return { subject, specialization, level, levels, base, scope };
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

export async function subjectLevelMetadata(params: Promise<SubjectLevelParams>, searchParams: Promise<SearchParams>): Promise<Metadata> {
  const { slug, specializationSlug, levelSlug } = await params;
  const data = await load(slug, specializationSlug, levelSlug);
  if (!data) return { title: 'Study level not found', robots: { index: false, follow: true } };
  const field = data.specialization ?? data.subject;
  const narrowed = isNarrowedCourses(searchWithoutPath(await searchParams, Boolean(data.specialization)));
  return {
    title: { absolute: `${data.level.name} in ${field.name} | Universta` },
    description: `Explore published ${data.level.name} programmes in ${field.name}, with universities, destinations, fees, intakes and entry requirements.`,
    alternates: narrowed ? undefined : { canonical: data.base },
    robots: { index: !narrowed && data.subject.seo?.robotsIndex !== false, follow: true },
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
  const { subject, specialization, level, levels, scope, base } = data;
  const raw = searchWithoutPath(await searchParams, Boolean(specialization));
  if (levelSlug !== subjectLevelSlug(level.code)) permanentRedirect(`${base}${queryString(raw)}`);
  const field = specialization ?? subject;
  const view = requestedView(raw) === 'guides' ? 'guides' : 'programmes';
  const read = withoutScope(readCourseFilters(raw), scope);
  const asked = { ...read, page: Math.min(read.page, PROGRAMME_MAX_PAGES) };
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
    programmeList(asked, scope),
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
    ...(specialization ? [{ label: specialization.name, href: `/subjects/${subject.slug}/${specialization.slug}` }] : []),
    { label: level.name },
  ];
  const levelQuery = view === 'guides'
    ? guideListSearch(guideFilters, { page: 1 }, { view: true })
    : courseListSearch(programmeFilters);
  return <>
    <section className="hero hero--compact">
      <div className="wrap">
        <Crumbs trail={trail} />
        <div className="hero__lead">
          <p className="hero__eyebrow">Study level <b>·</b> {level.name}</p>
          <h1 className="hero__h1">{level.name} in {field.name}</h1>
          <p className="hero__sub">Explore published programmes by destination, university, fees, intake and entry requirements.</p>
        </div>
        <nav className="levelbar levelbar--wide" aria-label="Study levels">
          {levels.filter((row) => LEVELS_ALWAYS_SHOWN.includes(row.code) || row.code === level.code).map((row) => <Link
            className="chipbtn" key={row.id}
            href={`${subjectLevelHref({ subject: subject.slug, specialization: specialization?.slug, level: row.code })}${levelQuery}`}
            aria-current={row.code === level.code ? 'page' : undefined}
          >{row.name}</Link>)}
        </nav>
      </div>
    </section>
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
          /> : <p role="status">Programmes are temporarily unavailable. <Link href={base}>Try again</Link>.</p>
          : guideResults?.[0] && guideResults?.[1] ? <CourseGuidesResults
            base={base} scope={guideScope} courses={guideResults[0].data} meta={guideResults[0].meta}
            filterOptions={guideResults[1]} filters={guideFilters} unknown={checked?.unknown ?? {}}
            paged={Boolean(raw.page || raw.pg || raw.pageSize)} viewParam programmes={Boolean(list?.summary.programmes)} taught={taught}
          /> : <p role="status">Course guides are temporarily unavailable. <Link href={switchGuides}>Try again</Link>.</p>}
        </div>
        <p className="trust__note">Programmes show each university’s published offering. Course guides describe the course across universities.</p>
      </div>
    </section>
    <CompareTray />
    <PlanBand heading={`Planning ${level.name} in ${field.name}?`} body="Tell us about your academic profile, goals and budget to explore your options." secondary={{ href: `/subjects/${subject.slug}`, label: 'View subject' }} />
  </>;
}
