import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* The list pages read their state from the address. */
const address = vi.hoisted(() => ({ path: '/', search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
  usePathname: () => address.path,
  useSearchParams: () => new URLSearchParams(address.search),
}));

import type { Country } from '@/lib/countries';
import type { Destination, DestinationDirectory } from '@/lib/study-abroad';
import { toCountryScholarshipRows } from '@/lib/country-scholarship-list';
import { toConsultantRows } from '@/lib/country-consultant-list';
import { CountryConnect, CountryCourses, countryCourseGroups, CountryScholarships } from './CountryLinkSections';
import { CountryIntakes, CountryOtherDestinations, CountryWhy } from './CountryGuideSections';
import { CountrySectionJumps, sectionJumps } from './CountryTabs';
import { CountryScholarshipIndex } from './CountryScholarshipIndex';
import { ConsultantCard, CountryConsultantIndex } from './CountryConsultantIndex';
import { DirectoryView } from './DirectoryView';
import { FaqAccordion } from './CountrySections';

beforeEach(() => {
  address.path = '/';
  address.search = '';
});

const uk = {
  id: 'gb',
  name: 'United Kingdom',
  slug: 'united-kingdom',
  iso2Code: 'GB',
  subjects: [{ id: 's1', name: 'Engineering', slug: 'engineering' }],
  currency: { code: 'GBP', symbol: '£' },
  configuration: { features: [{ title: 'World-class degrees' }], intakeMonths: [9, 1] },
  derived: null,
} as unknown as Country;

/* Gap: about a dozen headings read "United Kingdom" without its article,
   beside others on the same page that said "the United Kingdom". */
describe('the guide names the destination as a sentence would', () => {
  it('puts the article in the headings', () => {
    const why = renderToStaticMarkup(<CountryWhy country={uk} n="01" alt={false} />);
    expect(why).toContain('Why study in the United Kingdom?');
    const faq = renderToStaticMarkup(
      <FaqAccordion
        faqs={[{ id: 'f1', question: 'Can I work?', answer: 'Yes.' }]}
        countryName="the United Kingdom"
        n="09"
        alt={false}
      />,
    );
    expect(faq).toContain('Straight answers about the United Kingdom.');
  });

  it('capitalises the article where it opens a sentence', () => {
    const html = renderToStaticMarkup(
      <CountryIntakes
        country={uk}
        profiles={{ intakes: [] } as never}
        n="05"
        alt={false}
      />,
    );
    expect(html).toContain('When can you apply to the United Kingdom?');
    expect(html).toContain('The United Kingdom runs 2 intakes a year.');
  });
});

const card = (slug: string, subject: { name: string; slug: string } | null, level = "Master's") => ({
  id: slug,
  name: slug,
  slug,
  courseLevel: { name: level },
  subject,
});

const engineering = { name: 'Engineering', slug: 'engineering' };
const computing = { name: 'Computer Science', slug: 'computer-science' };

describe('the guide\'s courses, filed under their subjects', () => {
  it('leads with the subjects that have the most courses here', () => {
    const groups = countryCourseGroups(
      'united-kingdom',
      [card('a', computing), card('b', engineering), card('c', null), card('d', engineering)],
      new Map([
        ['engineering', 35],
        ['computer-science', 6],
      ]),
    );
    expect(groups.map((group) => [group.name, group.count, group.href])).toEqual([
      ['Engineering', 35, '/study-abroad/united-kingdom/engineering'],
      ['Computer Science', 6, '/study-abroad/united-kingdom/computer-science'],
      /* Courses filed under no subject close the list, and claim no count. */
      ['More courses', null, null],
    ]);
    /* Within a subject, the order the courses came in: curated ones first. */
    expect(groups[0]?.courses.map((course) => course.slug)).toEqual(['b', 'd']);
  });

  it('never prints the size of the slice read as the subject\'s size', () => {
    const [group] = countryCourseGroups('germany', [card('a', engineering)]);
    expect(group?.count).toBeNull();
  });

  /* Gap: the courses button opened every course in every country. */
  it('opens the destination\'s own courses, with how many there are', () => {
    const html = renderToStaticMarkup(
      <CountryCourses
        country={uk}
        courses={[card('msc-robotics', engineering)]}
        total={53}
        subjectCounts={new Map([['engineering', 35]])}
        alt={false}
      />,
    );
    expect(html).toContain('href="/courses?country=united-kingdom"');
    expect(html).toContain('View all 53 courses');
    expect(html).not.toContain('href="/courses"');
    expect(html).toContain('href="/study-abroad/united-kingdom/engineering"');
    expect(html).toContain('35 courses');
    expect(html).toContain('href="/compare/courses"');
  });
});

describe('the guide\'s funding and closing bands', () => {
  it('sends "View all scholarships" to the destination\'s own page', () => {
    const html = renderToStaticMarkup(
      <CountryScholarships
        country={uk}
        scholarships={[
          {
            id: 's1',
            title: 'Chevening Scholarships',
            slug: 'chevening',
            summary: null,
            provider: 'FCDO',
            benefit: null,
            award: null,
            deadline: null,
            eligibility: null,
            countries: [],
            universities: [],
          },
        ]}
        alt={false}
      />,
    );
    expect(html).toContain('href="/study-abroad/united-kingdom/scholarships"');
    expect(html).not.toContain('/scholarships?country=');
  });

  /* Gap: the guide ended on four buttons where the design has "Related on
     Universta", the grid the rest of the family closes with. */
  it('closes on the destination\'s related grid, leaving out empty groups', () => {
    const html = renderToStaticMarkup(
      <CountryConnect
        country={uk}
        alt={false}
        scholarships
        consultants
        groups={[
          {
            title: 'Universities in the United Kingdom',
            total: 15,
            items: [{ id: 'u1', name: 'University of Oxford', href: '/universities/oxford', note: 'Oxford' }],
          },
          { title: 'Scholarships', items: [] },
        ]}
      />,
    );
    expect(html).toContain('Related on Universta');
    expect(html).toContain('Universities in the United Kingdom');
    expect(html).toContain('href="/universities/oxford"');
    expect(html).not.toContain('>Scholarships <');
    expect(html).toContain('href="/study-abroad/united-kingdom/scholarships"');
    expect(html).toContain('href="/study-abroad/united-kingdom/consultants"');
  });

  it('offers no scholarships or consultants button with nothing behind it', () => {
    const html = renderToStaticMarkup(
      <CountryConnect country={uk} alt={false} scholarships={false} consultants={false} />,
    );
    expect(html).not.toContain('Find scholarships');
    expect(html).not.toContain('Find consultants');
    expect(html).not.toContain('Related on Universta');
  });

  /* Gap: nothing inside the guide led back to the other destinations. */
  it('ends the switcher on every destination', () => {
    const other: Destination = {
      name: 'Ireland',
      slug: 'ireland',
      iso2Code: 'IE',
      isPopular: true,
      isAvailable: true,
      region: 'Europe',
      summary: null,
      bands: null,
      counts: { universities: 1, courses: 1, scholarships: 0, consultants: 0 },
    };
    const html = renderToStaticMarkup(
      <CountryOtherDestinations country={uk} others={[other]} total={206} alt={false} />,
    );
    expect(html).toContain('href="/study-abroad"');
    expect(html).toContain('Explore all 206 countries');
    expect(html).toContain('Not sure between the United Kingdom and Ireland?');
  });
});

describe('"On this page"', () => {
  it('offers a jump only to a section that renders, in the page\'s order', () => {
    expect(sectionJumps(['why', 'universities', 'editorial-x', 'faq'])).toEqual([
      { id: 'why', label: 'Why study here' },
      { id: 'universities', label: 'Universities' },
      { id: 'faq', label: 'FAQs' },
    ]);
  });

  it('renders anchors to the sections, and stands down for a short page', () => {
    const html = renderToStaticMarkup(
      <CountrySectionJumps rendered={['why', 'courses', 'cost', 'faq']} />,
    );
    expect(html).toContain('aria-label="On this page"');
    expect(html).toContain('href="#cost"');
    expect(renderToStaticMarkup(<CountrySectionJumps rendered={['why', 'faq']} />)).toBe('');
  });
});

const destination = (over: Partial<Destination> = {}): Destination => ({
  name: 'United Kingdom',
  slug: 'united-kingdom',
  iso2Code: 'GB',
  isPopular: true,
  isAvailable: true,
  region: 'Europe',
  summary: null,
  bands: null,
  counts: { universities: 15, courses: 65, scholarships: 7, consultants: 4 },
  ...over,
});

const directory: DestinationDirectory = {
  available: [
    destination({ name: 'Albania', slug: 'albania', iso2Code: 'AL', isPopular: false, counts: { universities: 0, courses: 0, scholarships: 0, consultants: 0 } }),
    destination(),
    destination({ name: 'Japan', slug: 'japan', iso2Code: 'JP', region: 'Asia' }),
  ],
  comingSoon: [],
  regions: ['Europe', 'Asia'],
  counts: { available: 3, popular: 2, total: 3 },
};

describe('the destination directory', () => {
  it('opens on the popular destinations, above the regions', () => {
    const html = renderToStaticMarkup(<DirectoryView directory={directory} asPage />);
    expect(html).toContain('Popular destinations');
    expect(html.indexOf('data-testid="directory-popular"')).toBeLessThan(
      html.indexOf('data-group="Europe"'),
    );
    const popular = html.slice(
      html.indexOf('data-testid="directory-popular"'),
      html.indexOf('data-testid="directory-groups"'),
    );
    expect(popular).toContain('href="/study-abroad/united-kingdom"');
    expect(popular).not.toContain('Albania');
  });

  it('offers the design\'s Popular chip beside Published', () => {
    const html = renderToStaticMarkup(<DirectoryView directory={directory} asPage />);
    expect(html).toMatch(/>Published<\/button><button[^>]*>Popular</);
  });

  it('opens on the region the address names, without the popular row', () => {
    const html = renderToStaticMarkup(
      <DirectoryView directory={directory} asPage initialRegion="Asia" />,
    );
    expect(html).toContain('1 country');
    expect(html).toContain('data-group="Asia"');
    expect(html).not.toContain('data-group="Europe"');
    expect(html).not.toContain('Popular destinations');
  });

  it('finds the United Kingdom by "uk" from the address', () => {
    const html = renderToStaticMarkup(
      <DirectoryView directory={directory} asPage initialQuery="uk" />,
    );
    expect(html).toContain('1 country');
    expect(html).toContain('href="/study-abroad/united-kingdom"');
  });

  it('leaves the heading to the page\'s hero, and searches in a form', () => {
    const html = renderToStaticMarkup(<DirectoryView directory={directory} asPage />);
    expect(html).not.toContain('<h1');
    expect(html).toContain('role="search"');
    expect(html).toContain('name="q"');
  });
});

const scholarshipRows = toCountryScholarshipRows(
  Array.from({ length: 20 }, (_, index) => ({
    id: `s${index}`,
    slug: `award-${index}`,
    title: `Award ${String(index).padStart(2, '0')}`,
    provider: { name: index % 2 ? 'Trust' : 'Government' },
    benefitType: index < 15 ? 'FULL_FUNDING' : 'FIXED_GRANT',
    deadline: '2030-01-01',
  })),
  new Map([['PG', new Set(['s1', 's2'])]]),
  new Date('2026-10-05T00:00:00Z'),
);

describe('a destination\'s scholarships list', () => {
  const render = (search = '') => {
    address.path = '/study-abroad/united-kingdom/scholarships';
    address.search = search;
    return renderToStaticMarkup(
      <CountryScholarshipIndex
        rows={scholarshipRows}
        levels={[{ code: 'PG', name: "Master's" }]}
        where="the United Kingdom"
      />,
    );
  };

  it('shows the first eighteen, with the way to load more', () => {
    const html = render();
    expect(html).toContain('20 scholarships');
    expect(html).toContain('Showing 18 of 20');
    expect(html).toContain('Load more scholarships');
    expect(html).toContain('Award 17');
    expect(html).not.toContain('Award 18');
  });

  it('offers the filters the awards here can narrow by', () => {
    const html = render();
    expect(html).toContain('Study level');
    expect(html).toContain('Funding type');
    expect(html).toContain('Full funding');
    expect(html).toContain('Fixed grant');
  });

  it('reads its search, filters and page from the address', () => {
    expect(render('type=FIXED_GRANT')).toContain('5 scholarships');
    expect(render('q=trust')).toContain('10 scholarships');
    expect(render('page=2')).toContain('reached the end of the list');
  });

  it('says plainly when nothing matches, with the way back', () => {
    const html = render('q=nothing-like-this');
    expect(html).toContain('No scholarship matches that.');
    expect(html).toContain('Clear filters');
  });

  it('says plainly when the destination has none', () => {
    address.path = '/study-abroad/united-kingdom/scholarships';
    const html = renderToStaticMarkup(
      <CountryScholarshipIndex rows={[]} levels={[]} where="the United Kingdom" />,
    );
    expect(html).toContain('No scholarship for the United Kingdom is published yet.');
  });
});

const consultantRows = toConsultantRows([
  {
    id: 'c1',
    name: 'Lindenhall Global Admissions',
    slug: 'lindenhall',
    verificationStatus: 'VERIFIED',
    locations: [{ location: { city: 'Pune' } }],
    services: [
      { name: 'Visa guidance', slug: 'visa' },
      { name: 'Course selection', slug: 'course' },
      { name: 'Loans', slug: 'loans' },
      { name: 'SOP review', slug: 'sop' },
      { name: 'Interview preparation', slug: 'interview' },
    ],
    languages: [{ name: 'Hindi', code: 'HI' }],
    countries: [
      { country: { name: 'Belize', slug: 'belize' } },
      { country: { name: 'Canada', slug: 'canada' } },
      { country: { name: 'United Kingdom', slug: 'united-kingdom' } },
    ],
  },
  {
    id: 'c2',
    name: 'Ashgrove Advisers',
    slug: 'ashgrove',
    verificationStatus: 'PENDING',
    locations: [{ location: { city: 'Delhi' } }],
    services: [],
    languages: [],
    countries: [{ country: { name: 'United Kingdom', slug: 'united-kingdom' } }],
  },
]);

describe('a destination\'s consultants list', () => {
  it('draws the design\'s card, naming this destination first', () => {
    const html = renderToStaticMarkup(
      <ConsultantCard consultant={consultantRows[0]!} countrySlug="united-kingdom" guides={['canada']} />,
    );
    expect(html).toContain('consultcard');
    expect(html).toContain('✓ Verified');
    expect(html).toMatch(/destbadges[^>]*><span class="destbadge destbadge--here">United Kingdom</);
    /* Another destination links to its consultants only when it has a guide. */
    expect(html).toContain('href="/study-abroad/canada/consultants"');
    expect(html).not.toContain('href="/study-abroad/belize/consultants"');
    expect(html).toContain('>Belize<');
    expect(html).toContain('+1 more');
    expect(html).toContain('href="/study-abroad-consultants/lindenhall"');
  });

  it('says a profile is not yet verified rather than leaving it out', () => {
    const html = renderToStaticMarkup(
      <ConsultantCard consultant={consultantRows[1]!} countrySlug="united-kingdom" />,
    );
    expect(html).toContain('Not yet verified');
    expect(html).not.toContain('Services');
  });

  it('ticks the city a guide\'s chip carried, by name or by key', () => {
    address.path = '/study-abroad/united-kingdom/consultants';
    address.search = 'city=Pune';
    const html = renderToStaticMarkup(
      <CountryConsultantIndex rows={consultantRows} countrySlug="united-kingdom" where="the United Kingdom" />,
    );
    expect(html).toContain('1 consultant<');
    expect(html).toContain('Lindenhall Global Admissions');
    expect(html).not.toContain('Ashgrove Advisers');
    expect(html).toContain('Clear all');
  });

  it('sets aside a city no consultant here is in, rather than emptying the list', () => {
    address.path = '/study-abroad/united-kingdom/consultants';
    address.search = 'city=atlantis';
    const html = renderToStaticMarkup(
      <CountryConsultantIndex rows={consultantRows} countrySlug="united-kingdom" where="the United Kingdom" />,
    );
    expect(html).toContain('2 consultants');
  });
});
