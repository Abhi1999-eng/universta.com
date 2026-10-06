import type { Metadata } from 'next';
import Link from 'next/link';
import {
  getCourse,
  getCourseFilterOptions,
  getCourses,
  getSubjects,
  type Course,
} from '@/lib/catalog';
import {
  checkGuideFilters,
  chooseView,
  guideApiParams,
  isNarrowedCourses,
  PROGRAMME_MAX_PAGES,
  readGuideFilters,
  requestedView,
  withoutIgnored,
} from '@/lib/courses-params';
import { CoursesReference } from '@/components/reference/CoursesReference';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { getListingPageContent } from '@/lib/listing-page-content';
import { phaseList, phaseProgrammes } from '@/lib/phase1';
import { staticPageMetadata } from '@/lib/static-page-seo';
import {
  courseApiParams,
  courseRunParams,
  readCourseFilters,
  toProgrammeList,
} from '@/lib/university-courses';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

/** Stored enums such as IN_PERSON are internal; a reader sees "In person". */
function humanise(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const raw = await searchParams;
  const resolved = await staticPageMetadata(
    'courses-listing',
    'Courses',
    'Search published courses by subject, level, study mode, intake, and country.',
    '/courses',
  );
  /* This route family's layout appends the site name through its title
     template, and `staticPageMetadata` appends it too. */
  const metadata: Metadata = { ...resolved, title: 'Courses' };
  if (!isNarrowedCourses(raw)) return metadata;
  /* A searched, filtered, sorted or paged state -- or the other view -- is a
     slice of a page that is indexed whole. As on the reference it stays out
     of the index while its links are followed, and like the university
     lists it names no canonical, so a crawler gets one instruction rather
     than two. */
  const { alternates: _canonical, ...rest } = metadata;
  void _canonical;
  return { ...rest, robots: { index: false, follow: true } };
}

/* Kept for a real outage of the course catalogue only. An address the page
   cannot use -- an unknown value, a stale link -- still renders the page. */
function unavailable() {
  return (
    <main className="error-page shell">
      <p className="eyebrow">Courses</p>
      <h1>Courses are temporarily unavailable</h1>
      <p>Please try again shortly.</p>
      <Link className="button" href="/courses">
        Retry
      </Link>
    </main>
  );
}

const NO_COURSES = {
  data: [] as Course[],
  meta: { page: 1, limit: 12, total: 0, totalPages: 0 },
};

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = await searchParams;
  const requested = requestedView(raw);
  const read = readCourseFilters(raw);
  const asked = { ...read, page: Math.min(read.page, PROGRAMME_MAX_PAGES) };

  /* The programmes come first: whether the catalogue has any decides which
     view opens. On the guides view only their count and figures are needed,
     so one row is asked for. The guides' options over the whole catalogue
     are what their filters are checked against, and what their browse
     blocks count. Either failing is read as "none", so an outage of one
     list leaves the other. */
  const [programmeAnswer, catalogueOptions, subjects, universities, consultants, events, managed] =
    await Promise.all([
      phaseProgrammes(
        requested === 'guides'
          ? { ...courseApiParams(asked, 1), limit: '1' }
          : courseRunParams(asked),
      ).catch(() => null),
      getCourseFilterOptions().catch(() => null),
      getSubjects({ limit: '100' })
        .then((result) => result.data)
        .catch(() => []),
      // Link clusters and the events strip are decoration around the listing,
      // so a failure there must not take the route down with it.
      phaseList<AnyRecord>('universities', { limit: '8' })
        .then((result) => result.data)
        .catch(() => []),
      phaseList<AnyRecord>('consultants', { limit: '8' })
        .then((result) => result.data)
        .catch(() => []),
      // `when=upcoming` matters: the strip is headed "Upcoming events", so a
      // past record must not appear in it.
      phaseList<AnyRecord>('events', { limit: '4', when: 'upcoming' })
        .then((result) => result.data)
        .catch(() => []),
      getListingPageContent('courses-listing'),
    ]);

  const list = programmeAnswer ? toProgrammeList(programmeAnswer, asked) : null;
  const view = chooseView(requested, list?.summary.programmes ?? 0);
  const programmes =
    list && list.summary.programmes > 0
      ? { ...list, filters: withoutIgnored(asked, list.ignored) }
      : null;

  /* A chosen course is named by the programmes that teach it. One that no
     live programme teaches is named from its own guide instead, so its chip
     reads as a course rather than a slug and the empty list can point at
     that guide; a slug that is no guide stays as it is. */
  if (view === 'programmes' && programmes) {
    const unnamed = programmes.filters.course
      .filter((slug) => !programmes.facets.course.some((option) => option.value === slug))
      .slice(0, 3);
    if (unnamed.length) {
      const named = await Promise.all(
        unnamed.map((slug) =>
          getCourse(slug)
            .then((guide) => [{ value: slug, label: guide.name, count: 0 }])
            .catch(() => []),
        ),
      );
      programmes.facets = {
        ...programmes.facets,
        course: [...programmes.facets.course, ...named.flat()],
      };
    }
  }

  const checked = catalogueOptions
    ? checkGuideFilters(readGuideFilters(raw), catalogueOptions)
    : null;
  const guideParams = checked ? guideApiParams(checked.api) : {};
  const asks = (keys: string[]) =>
    Object.keys(guideParams).some((key) => !keys.includes(key));
  /* Whether the guides asked for are fewer than all of them: then the
     hero's count of every course guide is a request of its own. */
  const narrowedGuides = Boolean(checked?.nothing) || asks(['page', 'pageSize', 'sort']);

  let guides: Parameters<typeof CoursesReference>[0]['guides'] = null;
  let guideTotal: number | null = null;
  let guideCatalogueTotal: number | null = null;
  if (view === 'guides') {
    if (!checked) return unavailable();
    try {
      const [courses, filterOptions, catalogue] = await Promise.all([
        checked.nothing ? NO_COURSES : getCourses(guideParams),
        /* Unfiltered, the options already read are the ones this list
           counts, so they are not asked for twice. */
        asks(['page', 'pageSize'])
          ? getCourseFilterOptions(guideParams)
          : catalogueOptions!,
        narrowedGuides
          ? getCourses({ pageSize: '1' }).then((result) => result.meta.total)
          : null,
      ]);
      /* A guide's card links to the programmes that teach it only when a
         live programme does. The programmes are asked about exactly the
         guides on the page, and name each one they teach with its count;
         if they cannot be asked, no card offers the link. */
      const taught =
        programmes && courses.data.length
          ? await phaseProgrammes({
              course: courses.data.map((course) => course.slug).join(','),
              limit: '1',
            })
              .then((answer) =>
                toProgrammeList(answer, asked)
                  .facets.course.filter((option) => option.count > 0)
                  .map((option) => option.value),
              )
              .catch(() => [])
          : [];
      guides = {
        courses: courses.data,
        meta: courses.meta,
        filterOptions,
        /* Whether the reader chose a page or a page size themselves. The
           listing reveals twelve at a time on its own; an explicit choice
           means they are navigating the result set, and the pager has to
           appear for them. */
        paged: Boolean(raw.page || raw.pg || raw.pageSize),
        taught,
      };
      guideTotal = courses.meta.total;
      guideCatalogueTotal = catalogue ?? courses.meta.total;
    } catch {
      return unavailable();
    }
  } else if (checked) {
    /* The switcher's count, and the empty list's way to the guides: how many
       course guides the same choice opens. */
    guideTotal = checked.nothing
      ? 0
      : await getCourses({ ...guideApiParams({ ...checked.api, page: 1 }), pageSize: '1' })
          .then((result) => result.meta.total)
          .catch(() => null);
  }

  return (
    <CoursesReference
      view={view}
      programmes={programmes}
      guides={guides}
      guideFilters={checked?.filters ?? readGuideFilters(raw)}
      guideUnknown={checked?.unknown ?? {}}
      guideTotal={guideTotal}
      guideCatalogue={
        /* The total is only read where the guides are the page, which is
           the one view that counts it. */
        catalogueOptions
          ? { options: catalogueOptions, total: guideCatalogueTotal ?? 0 }
          : null
      }
      subjects={subjects}
      universities={universities.map((row) => ({
        name: String(row.name),
        slug: String(row.slug),
      }))}
      consultants={consultants.map((row) => ({
        name: String(row.name),
        slug: String(row.slug),
      }))}
      events={events.map((row) => ({
        name: String(row.title ?? row.name),
        slug: String(row.slug),
        mode: typeof row.eventType === 'string' ? humanise(row.eventType) : null,
        startAt: typeof row.startsAt === 'string' ? row.startsAt : null,
      }))}
      heading={managed.heading ?? 'Find your perfect course'}
      lede={
        managed.lede ??
        'Search by course, subject, specialization, university or country — then check whether it fits your profile.'
      }
      ctaHeading={managed.ctaHeading ?? 'Discover the right course for your future'}
      ctaBody={
        managed.ctaBody ??
        'Filter the published catalogue, shortlist the programmes that fit, and compare them side by side before you apply.'
      }
    />
  );
}
