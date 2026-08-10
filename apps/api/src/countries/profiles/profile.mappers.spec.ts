import { describe, expect, it } from '@jest/globals';
import { publicProfileSummary } from './profile.mappers';

const base = {
  id: 'x',
  countryId: 'country',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('public country profile policy', () => {
  it('omits optional facts when source-backed verification is missing', () => {
    const result = publicProfileSummary({
      costProfile: {
        ...base,
        currencyCode: 'CAD',
        currencySymbol: '$',
        tuitionMin: '1',
        tuitionMax: '2',
        tuitionPeriod: 'PER_YEAR',
        tuitionNotes: null,
        livingCostMin: null,
        livingCostMax: null,
        livingCostPeriod: 'PER_MONTH',
        livingCostNotes: null,
        accommodationMin: null,
        accommodationMax: null,
        foodCostMin: null,
        foodCostMax: null,
        transportCostMin: null,
        transportCostMax: null,
        healthInsuranceCost: null,
        applicationFeeMin: null,
        applicationFeeMax: null,
        budgetBand: 'MID_RANGE',
        applicableYear: 2026,
        sourceReference: null,
        disclaimer: null,
        verifiedAt: null,
      },
      workProfile: null,
      languageRequirements: null,
      intakes: [],
      statistics: {
        ...base,
        universitiesCount: 0,
        coursesCount: 0,
        topRankedUniversitiesCount: 0,
        publicUniversitiesCount: 0,
        privateUniversitiesCount: 0,
        ugCoursesCount: 0,
        pgCoursesCount: 0,
        pgdmCoursesCount: 0,
        mbaCoursesCount: 0,
        phdCoursesCount: 0,
        scholarshipsCount: 0,
        citiesCount: 0,
        internationalStudentsCount: null,
        studentSatisfactionPercentage: null,
        sourceMode: 'MANUAL',
        sourceReference: null,
        verifiedAt: null,
      },
    });
    expect(result.cost).toBeNull();
    expect(result.statistics).toBeNull();
  });

  it('preserves verified zero statistics and only publishes major active intakes', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const result = publicProfileSummary({
      costProfile: null,
      workProfile: null,
      languageRequirements: null,
      intakes: [
        {
          ...base,
          intakeId: 'jan',
          isMajor: false,
          availabilityStatus: 'AVAILABLE',
          applicationOpeningMonth: null,
          applicationDeadlineMonth: null,
          applicationOpeningNote: null,
          applicationDeadlineNote: null,
          notes: null,
          displayOrder: 0,
          intake: {
            id: 'jan',
            name: 'January',
            slug: 'january',
            startMonth: 1,
            endMonth: 1,
            seasonName: 'WINTER',
            shortLabel: 'Jan',
            status: 'ACTIVE',
          },
        },
        {
          ...base,
          intakeId: 'sep',
          isMajor: true,
          availabilityStatus: 'AVAILABLE',
          applicationOpeningMonth: null,
          applicationDeadlineMonth: null,
          applicationOpeningNote: null,
          applicationDeadlineNote: null,
          notes: null,
          displayOrder: 1,
          intake: {
            id: 'sep',
            name: 'September',
            slug: 'september',
            startMonth: 9,
            endMonth: 9,
            seasonName: 'FALL',
            shortLabel: 'Sep',
            status: 'ACTIVE',
          },
        },
      ],
      statistics: {
        ...base,
        universitiesCount: 0,
        coursesCount: 0,
        topRankedUniversitiesCount: 0,
        publicUniversitiesCount: 0,
        privateUniversitiesCount: 0,
        ugCoursesCount: 0,
        pgCoursesCount: 0,
        pgdmCoursesCount: 0,
        mbaCoursesCount: 0,
        phdCoursesCount: 0,
        scholarshipsCount: 0,
        citiesCount: 0,
        internationalStudentsCount: null,
        studentSatisfactionPercentage: null,
        sourceMode: 'MANUAL',
        sourceReference: 'https://example.com/source',
        verifiedAt: now,
      },
    });
    expect(result.intakes).toHaveLength(1);
    expect(result.statistics).toEqual({
      universitiesCount: 0,
      coursesCount: 0,
      topRankedUniversitiesCount: 0,
    });
  });
});
