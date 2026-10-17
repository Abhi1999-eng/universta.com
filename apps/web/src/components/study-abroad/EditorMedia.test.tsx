import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Media, SubjectDetail } from '@/lib/catalog';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('./StudyAbroadShell', () => ({
  useStudyAbroadShell: () => ({ openAssessment: vi.fn(), openMatch: vi.fn() }),
}));

const { SubjectGuide } = await import('./SubjectGuide');
const { SpecializationGuide } = await import('./SpecializationGuide');
const { SubjectIndex } = await import('./SubjectIndex');
const { SubjectSpecializations } = await import('./SubjectSpecializations');
const { SpecializationsReference } = await import(
  '@/components/reference/SpecializationsReference'
);

/**
 * What editors set on a subject or a specialization and the site used to
 * ignore: the Featured tick, drawn as the design's "Popular" badge on the
 * record's cards; its listing image on those cards; a subject's hero image
 * on its page; and a specialization's own icon on its page. Each shows only
 * where it is set, and a record without them is drawn as before.
 */

const media = (name: string, alt: string | null = null): Media => ({
  id: name,
  url: `https://cdn.example/${name}.webp`,
  alt,
  title: null,
  width: null,
  height: null,
});

const branch = (over: Record<string, unknown>) => ({
  id: 'se',
  name: 'Software Engineering',
  slug: 'software-engineering',
  shortDescription: 'Building software that lasts.',
  overview: null,
  iconMedia: null,
  listingMedia: null,
  featured: false,
  displayOrder: 1,
  publishedCourseCount: 6,
  levels: [],
  ...over,
});

const subject = (over: Record<string, unknown> = {}) =>
  ({
    id: 'cs',
    name: 'Computer Science',
    slug: 'computer-science',
    shortDescription: 'Computation, in theory and practice.',
    overview: null,
    iconMedia: null,
    listingMedia: null,
    heroMedia: null,
    featured: false,
    displayOrder: 1,
    publishedCourseCount: 6,
    publishedSubSubjectCount: 2,
    availableCountryCount: 0,
    subSubjects: [
      branch({ featured: true, listingMedia: media('se-card') }),
      branch({ id: 'ai', name: 'Artificial Intelligence', slug: 'artificial-intelligence' }),
    ],
    countries: [],
    tests: [],
    courseCountsByLevel: [],
    featuredCourses: [],
    seo: null,
    ...over,
  }) as unknown as SubjectDetail;

/** The card that names a record, from its opening tag to the next card. */
const card = (html: string, name: string, tag = 'article') => {
  const at = html.indexOf(`>${name}<`);
  const start = html.lastIndexOf(`<${tag}`, at);
  return html.slice(start, html.indexOf(`</${tag}>`, at));
};

describe('the "Popular" badge for a featured record', () => {
  it('marks a featured subject’s card in the explorer, beside its name, and no other', () => {
    const html = renderToStaticMarkup(
      <SubjectIndex
        subjects={[
          subject({ featured: true }),
          subject({ id: 'law', name: 'Law', slug: 'law', subSubjects: [] }),
        ] as never}
      />,
    );
    expect(card(html, 'Computer Science')).toMatch(
      /<div class="subjcard__head">[\s\S]*<\/div><span class="badge badge--req">Popular<\/span><\/div>/,
    );
    expect(card(html, 'Law')).not.toContain('Popular');
  });

  it('marks a featured specialization’s card on its subject’s page, and no other', () => {
    const html = renderToStaticMarkup(<SubjectGuide subject={subject()} scholarships={[]} />);
    expect(card(html, 'Software Engineering')).toContain(
      '<span class="speccard__top"><span class="label">Specialization</span><span class="badge badge--req">Popular</span></span>',
    );
    expect(card(html, 'Artificial Intelligence')).not.toContain('Popular');
  });

  it('marks it on the subject’s list of specializations, and no other', () => {
    const html = renderToStaticMarkup(
      <SpecializationsReference
        subject={subject()}
        counts={{}}
        countries={[]}
        query="zzz"
        universities={[]}
        courses={[]}
        scholarships={[]}
      />,
    );
    /* Searching for nothing that matches leaves the list empty; searching
       for each shows its own card. */
    expect(html).not.toContain('badge--req');
    const listed = renderToStaticMarkup(
      <SpecializationsReference
        subject={subject()}
        counts={{}}
        countries={[]}
        query="e"
        universities={[]}
        courses={[]}
        scholarships={[]}
      />,
    );
    const all = listed.slice(listed.indexOf('id="all"'));
    expect(card(all, 'Software Engineering')).toContain('<span class="badge badge--req">Popular</span>');
    expect(card(all, 'Artificial Intelligence')).not.toContain('Popular');
  });

  /* The band at the top ranks by courses. Its cards used to say "Popular"
     too, so the same specialization was Popular in the band and not in the
     grid below it, and a featured one with few courses was Popular only
     below. The band now says what it ranks by. */
  it('keeps "Popular" for the featured mark alone; the band of most courses says so', () => {
    const html = renderToStaticMarkup(
      <SpecializationsReference
        subject={subject()}
        counts={{ 'software-engineering': 6, 'artificial-intelligence': 9 }}
        countries={[]}
        query=""
        universities={[]}
        courses={[]}
        scholarships={[]}
      />,
    );
    const band = html.slice(html.indexOf('id="popular"'), html.indexOf('id="all"'));
    const all = html.slice(html.indexOf('id="all"'));
    for (const name of ['Software Engineering', 'Artificial Intelligence']) {
      expect(card(band, name)).toContain('<span class="badge badge--req">Most courses</span>');
      expect(card(band, name)).not.toContain('Popular');
    }
    expect(card(all, 'Software Engineering')).toContain('<span class="badge badge--req">Popular</span>');
    expect(card(all, 'Software Engineering')).not.toContain('Most courses');
    expect(card(all, 'Artificial Intelligence')).not.toContain('badge');
  });

  it('draws no badge where nothing is featured', () => {
    const html = renderToStaticMarkup(
      <SubjectSpecializations
        subjectName="Computer Science"
        subjectSlug="computer-science"
        branches={[branch({}) as never]}
      />,
    );
    expect(html).not.toContain('badge');
  });
});

describe('a record’s listing image on its cards', () => {
  it('heads a subject’s card in the explorer with it', () => {
    const html = renderToStaticMarkup(
      <SubjectIndex
        subjects={[
          subject({ listingMedia: media('cs-card') }),
          subject({ id: 'law', name: 'Law', slug: 'law', subSubjects: [] }),
        ] as never}
      />,
    );
    expect(card(html, 'Computer Science')).toMatch(
      /^<article class="subjcard"><span class="subjcard__media"><img src="https:\/\/cdn.example\/cs-card.webp" alt="" loading="lazy"\/><\/span><div class="subjcard__head">/,
    );
    expect(card(html, 'Law')).not.toContain('subjcard__media');
  });

  it('heads a specialization’s card with it, on the subject’s page and its list of specializations', () => {
    const page = renderToStaticMarkup(<SubjectGuide subject={subject()} scholarships={[]} />);
    expect(card(page, 'Software Engineering')).toContain(
      '<span class="speccard__media"><img src="https://cdn.example/se-card.webp" alt="" loading="lazy"/></span><span class="speccard__top">',
    );
    expect(card(page, 'Artificial Intelligence')).not.toContain('speccard__media');
    const list = renderToStaticMarkup(
      <SpecializationsReference
        subject={subject()}
        counts={{ 'software-engineering': 6 }}
        countries={[]}
        query=""
        universities={[]}
        courses={[]}
        scholarships={[]}
      />,
    );
    const all = list.slice(list.indexOf('id="all"'));
    expect(card(all, 'Software Engineering')).toContain('src="https://cdn.example/se-card.webp"');
    expect(card(all, 'Artificial Intelligence')).not.toContain('speccard__media');
  });
});

describe('a subject’s hero image', () => {
  it('shows under the hero where one is set, with its alt text', () => {
    const html = renderToStaticMarkup(
      <SubjectGuide subject={subject({ heroMedia: media('cs-hero', 'Students at a whiteboard') })} scholarships={[]} />,
    );
    const hero = html.slice(html.indexOf('class="hero'), html.indexOf('</section>'));
    expect(hero).toContain(
      '<figure class="subjhero__media"><img src="https://cdn.example/cs-hero.webp" alt="Students at a whiteboard" loading="eager"/></figure>',
    );
  });

  it('leaves the hero as it was without one', () => {
    const html = renderToStaticMarkup(<SubjectGuide subject={subject()} scholarships={[]} />);
    expect(html).not.toContain('subjhero__media');
  });
});

describe('a specialization’s own icon on its page', () => {
  const specialization = (iconMedia: Media | null) => ({
    ...branch({ iconMedia }),
    subject: { id: 'cs', name: 'Computer Science', slug: 'computer-science', shortDescription: null },
    siblings: [],
    siblingTotal: 0,
    countries: [],
    courses: [],
  });
  const icon = (html: string) =>
    html.slice(html.indexOf('class="subjhero__icon"'), html.indexOf('</span>', html.indexOf('class="subjhero__icon"')));

  it('heads the hero with it where one is set', () => {
    const html = renderToStaticMarkup(
      <SpecializationGuide specialization={specialization(media('se-icon')) as never} scholarships={[]} />,
    );
    expect(icon(html)).toContain('<img src="https://cdn.example/se-icon.webp" alt=""/>');
    expect(icon(html)).not.toContain('<svg');
  });

  it('keeps the generic mark without one', () => {
    const html = renderToStaticMarkup(
      <SpecializationGuide specialization={specialization(null) as never} scholarships={[]} />,
    );
    expect(icon(html)).toContain('<path d="M4 5h16v14H4z M4 9h16"></path>');
    expect(icon(html)).not.toContain('<img');
  });
});
