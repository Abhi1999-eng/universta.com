import { CountriesService } from './countries.service';
import type { TaxonomySnapshot } from './country-taxonomy.service';

/**
 * The guide shows the country's ISO code in its eyebrow and on its flag mark.
 * The flag emoji was derived from the code on the server, but the code itself
 * was left out of the public shape, so every guide fell back to the first two
 * letters of its name -- "GE" for Germany.
 */
const taxonomy: TaxonomySnapshot = {
  features: [],
  englishTests: [],
  featureLabels: new Map(),
  testLabels: new Map(),
  featureCodes: new Set(),
  testCodes: new Set(),
};

const toPublic = (record: Record<string, unknown>) => {
  const service = Object.create(CountriesService.prototype) as {
    toPublic: (value: unknown, known: TaxonomySnapshot) => Record<string, unknown>;
  };
  return service.toPublic(record, taxonomy);
};

const germany = {
  id: 'c1',
  continentId: null,
  continent: null,
  name: 'Germany',
  pageHeading: 'Study in Germany',
  slug: 'germany',
  iso2Code: 'DE',
  iso3Code: 'DEU',
  externalUid: null,
  capitalCity: 'Berlin',
  officialLanguage: 'German',
  currencyName: 'Euro',
  currencyCode: 'EUR',
  currencySymbol: '€',
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
  displayOrder: 0,
  statistics: null,
  subjects: [],
  subjectMaps: [],
  tagMaps: [],
  documents: [],
  costProfile: null,
  workProfile: null,
  languageRequirements: null,
  intakes: [],
};

describe('public country shape', () => {
  it('carries the ISO code the guide shows', () => {
    expect(toPublic(germany).iso2Code).toBe('DE');
  });

  it('carries no code when the country has none', () => {
    expect(toPublic({ ...germany, iso2Code: null }).iso2Code).toBeNull();
  });
});
