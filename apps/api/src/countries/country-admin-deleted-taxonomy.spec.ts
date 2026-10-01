import { CountriesService } from './countries.service';
import type { TaxonomySnapshot } from './country-taxonomy.service';

/**
 * Deleting a subject does not unlink the countries that taught it -- the link
 * is kept so restoring the subject restores its destinations. The Admin was
 * showing those links anyway: the Countries list went on naming a subject an
 * editor had just deleted, and the country editor pre-selected an id its own
 * picker no longer offers, so the next save silently relinked it.
 *
 * The public shape already filtered them out. This is the same rule one
 * screen later.
 */
const taxonomy: TaxonomySnapshot = {
  features: [],
  englishTests: [],
  featureLabels: new Map(),
  testLabels: new Map(),
  featureCodes: new Set(),
  testCodes: new Set(),
};

const toAdmin = (record: Record<string, unknown>) => {
  const service = Object.create(CountriesService.prototype) as {
    toAdmin: (
      value: unknown,
      known: TaxonomySnapshot,
    ) => Record<string, unknown>;
  };
  return service.toAdmin(record, taxonomy);
};

const live = {
  id: 'subject-live',
  name: 'Computer Science',
  slug: 'computer-science',
  status: 'PUBLISHED',
  deletedAt: null,
};
const gone = {
  id: 'subject-gone',
  name: 'Aviation and Aerospace Studies',
  slug: 'aviation-and-aerospace-studies',
  status: 'PUBLISHED',
  deletedAt: new Date('2026-10-01T00:00:00.000Z'),
};

const country = {
  id: 'c1',
  continentId: null,
  continent: null,
  name: 'Manual Test Destination',
  pageHeading: null,
  slug: 'manual-test-destination',
  iso2Code: null,
  iso3Code: null,
  externalUid: null,
  capitalCity: null,
  officialLanguage: null,
  currencyName: null,
  currencyCode: null,
  currencySymbol: null,
  flagMediaId: null,
  listingMediaId: null,
  heroMediaId: null,
  flagMedia: null,
  listingMedia: null,
  heroMedia: null,
  featureCodes: [],
  acceptedTests: [],
  intakeMonths: [],
  postStudyWorkPermitMonths: null,
  shortDescription: null,
  overview: null,
  tagline: null,
  isFeatured: false,
  isPopular: false,
  status: 'PUBLISHED',
  displayOrder: 0,
  publishedAt: null,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  updatedAt: new Date('2026-10-01T00:00:00.000Z'),
  statistics: null,
  subjects: [],
  subjectMaps: [
    { subjectId: live.id, displayOrder: 0, subject: live },
    { subjectId: gone.id, displayOrder: 1, subject: gone },
  ],
  subSubjectMaps: [
    {
      subSubjectId: 'spec-live',
      displayOrder: 0,
      subSubject: { deletedAt: null },
    },
    {
      subSubjectId: 'spec-gone',
      displayOrder: 1,
      subSubject: { deletedAt: new Date('2026-10-01T00:00:00.000Z') },
    },
  ],
  tagMaps: [],
  documents: [],
  costProfile: null,
  workProfile: null,
  languageRequirements: null,
  intakes: [],
  popularUniversities: [],
  popularCourses: [],
  mapMediaId: null,
  mapMedia: null,
  primarySourceUrl: null,
  lastVerifiedAt: null,
  calculatorConfig: null,
  featuredLabel: null,
  shortName: null,
  nationalityName: null,
  dialCode: null,
  timezoneJson: null,
  _count: { universities: 0, cities: 0, states: 0, scholarships: 0 },
};

describe('a country that linked a subject since deleted', () => {
  it('does not name it in the Admin list', () => {
    const names = (toAdmin(country).subjects as Array<{ name: string }>).map(
      (row) => row.name,
    );
    expect(names).toEqual(['Computer Science']);
  });

  it('does not pre-select it in the country editor', () => {
    expect(toAdmin(country).subjectIds).toEqual(['subject-live']);
  });

  it('leaves out a deleted specialization too', () => {
    expect(toAdmin(country).subSubjectIds).toEqual(['spec-live']);
  });
});
