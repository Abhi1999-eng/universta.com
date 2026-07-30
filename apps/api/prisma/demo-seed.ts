import 'dotenv/config';
import { randomBytes, scryptSync } from 'node:crypto';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import {
  Prisma,
  PrismaClient,
  type Country,
  type Subject,
  type SubSubject,
} from '../src/generated/prisma/client';
import { assertDemoCatalogSeedAllowed } from '../src/prisma/demo-seed-policy';

assertDemoCatalogSeedAllowed();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

function databaseConfig() {
  const url = new URL(required('DATABASE_URL'));
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
  };
}

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(databaseConfig()),
});

async function main() {
  const now = new Date();
  const adminEmail =
    process.env.SEED_ADMIN_EMAIL ??
    process.env.SUPER_ADMIN_EMAIL ??
    'admin@universta.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD
    ? required('SEED_ADMIN_PASSWORD')
    : required('SUPER_ADMIN_PASSWORD');

  const role = await prisma.role.upsert({
    where: { code: 'SUPER_ADMIN' },
    update: {
      name: 'Super Admin',
      description: 'Local foundation administrator',
      isSystemRole: true,
      status: 'ACTIVE',
    },
    create: {
      code: 'SUPER_ADMIN',
      name: 'Super Admin',
      description: 'Local foundation administrator',
      isSystemRole: true,
      status: 'ACTIVE',
    },
  });

  const passwordHash = hashPassword(adminPassword);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      firstName: process.env.SUPER_ADMIN_FIRST_NAME ?? 'Local',
      lastName: process.env.SUPER_ADMIN_LAST_NAME ?? 'Super Admin',
      status: 'ACTIVE',
      passwordChangedAt: now,
    },
    create: {
      email: adminEmail,
      passwordHash,
      firstName: process.env.SUPER_ADMIN_FIRST_NAME ?? 'Local',
      lastName: process.env.SUPER_ADMIN_LAST_NAME ?? 'Super Admin',
      status: 'ACTIVE',
      passwordChangedAt: now,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: role.id } },
    update: { assignedByUserId: admin.id, assignedAt: now },
    create: {
      userId: admin.id,
      roleId: role.id,
      assignedByUserId: admin.id,
      assignedAt: now,
    },
  });

  const continents = [
    ['Europe', 'europe', 'EU'],
    ['North America', 'north-america', 'NA'],
    ['Asia', 'asia', 'AS'],
    ['Australia & New Zealand', 'australia-new-zealand', 'ANZ'],
    ['Middle East', 'middle-east', 'ME'],
    ['Africa', 'africa', 'AF'],
    ['South America', 'south-america', 'SA'],
  ] as const;
  for (const [name, slug, code] of continents) {
    await prisma.continent.upsert({
      where: { slug },
      update: { name, code, status: 'ACTIVE', updatedByUserId: admin.id },
      create: {
        name,
        slug,
        code,
        status: 'ACTIVE',
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
      },
    });
  }

  const intakes = [
    ['January', 'january', 1, 'WINTER', 'Jan'],
    ['May', 'may', 5, 'SPRING', 'May'],
    ['September', 'september', 9, 'FALL', 'Sep'],
  ] as const;
  for (const [name, slug, monthNumber, seasonName, shortLabel] of intakes) {
    await prisma.intake.upsert({
      where: { slug },
      update: { name, monthNumber, seasonName, shortLabel, status: 'ACTIVE' },
      create: {
        name,
        slug,
        monthNumber,
        seasonName,
        shortLabel,
        status: 'ACTIVE',
      },
    });
  }

  const northAmerica = await prisma.continent.findUnique({
    where: { slug: 'north-america' },
  });
  if (northAmerica) {
    let canada = await prisma.country.findUnique({ where: { slug: 'canada' } });
    if (!canada) {
      canada = await prisma.country.create({
        data: {
          continentId: northAmerica.id,
          name: 'Canada',
          slug: 'canada',
          iso2Code: 'CA',
          iso3Code: 'CAN',
          pageHeading: 'Study in Canada',
          shortDescription:
            'Foundation country record for structured profile development.',
          status: 'PUBLISHED',
          publishedAt: now,
          createdByUserId: admin.id,
          updatedByUserId: admin.id,
        },
      });
    }
    const sourceReference = 'https://example.com/universta/seed/canada-profile';
    await prisma.countryCostProfile.upsert({
      where: { countryId: canada.id },
      update: {},
      create: {
        countryId: canada.id,
        currencyCode: 'CAD',
        currencySymbol: '$',
        tuitionMin: new Prisma.Decimal('18000.00'),
        tuitionMax: new Prisma.Decimal('42000.00'),
        tuitionPeriod: 'PER_YEAR',
        livingCostMin: new Prisma.Decimal('1200.00'),
        livingCostMax: new Prisma.Decimal('2200.00'),
        livingCostPeriod: 'PER_MONTH',
        budgetBand: 'MID_RANGE',
        applicableYear: now.getUTCFullYear(),
        sourceReference,
        disclaimer:
          'Fictional local foundation data for development and testing.',
        verifiedAt: now,
      },
    });
    await prisma.countryWorkProfile.upsert({
      where: { countryId: canada.id },
      update: {},
      create: {
        countryId: canada.id,
        partTimeAllowed: true,
        partTimeHoursPerWeek: new Prisma.Decimal('20.00'),
        postStudyWorkAvailable: true,
        postStudyWorkMinMonths: 12,
        postStudyWorkMaxMonths: 36,
        immigrationPathwayStrength: 'MODERATE',
        visaSuccessBand: 'MEDIUM',
        visaInformation:
          'Fictional local foundation data for development and testing.',
        sourceReference,
        disclaimer:
          'Fictional local foundation data for development and testing.',
        verifiedAt: now,
      },
    });
    await prisma.countryLanguageRequirement.upsert({
      where: { countryId: canada.id },
      update: {},
      create: {
        countryId: canada.id,
        ieltsRequirement: 'OPTIONAL',
        ieltsMinScore: new Prisma.Decimal('6.5'),
        pteRequirement: 'OPTIONAL',
        pteMinScore: new Prisma.Decimal('60.00'),
        toeflRequirement: 'OPTIONAL',
        toeflMinScore: new Prisma.Decimal('88.00'),
        languageWaiverAvailable: true,
        sourceReference,
        disclaimer:
          'Fictional local foundation data for development and testing.',
        verifiedAt: now,
      },
    });
    await prisma.countryStatistic.upsert({
      where: { countryId: canada.id },
      update: {},
      create: {
        countryId: canada.id,
        universitiesCount: 120,
        publicUniversitiesCount: 40,
        privateUniversitiesCount: 80,
        coursesCount: 2400,
        ugCoursesCount: 900,
        pgCoursesCount: 1000,
        pgdmCoursesCount: 250,
        mbaCoursesCount: 150,
        topRankedUniversitiesCount: 12,
        citiesCount: 18,
        sourceMode: 'MANUAL',
        sourceReference,
        verifiedAt: now,
      },
    });
    for (const [slug, isMajor] of [
      ['january', false],
      ['may', false],
      ['september', true],
    ] as const) {
      const intake = await prisma.intake.findUnique({ where: { slug } });
      if (intake)
        await prisma.countryIntake.upsert({
          where: {
            countryId_intakeId: { countryId: canada.id, intakeId: intake.id },
          },
          update: {},
          create: {
            countryId: canada.id,
            intakeId: intake.id,
            isMajor,
            availabilityStatus: 'AVAILABLE',
          },
        });
    }
  }

  const courseLevels = [
    ['DIPLOMA', 'Diploma', 1],
    ['UG', 'Undergraduate', 2],
    ['PGDM', 'Post Graduate Diploma in Management', 3],
    ['PG', 'Postgraduate', 4],
    ['MBA', 'Master of Business Administration', 5],
    ['PHD', 'Doctor of Philosophy', 6],
    ['CERTIFICATE', 'Certificate', 0],
  ] as const;
  for (const [code, name, educationOrder] of courseLevels) {
    await prisma.courseLevel.upsert({
      where: { code },
      update: { name, educationOrder, status: 'ACTIVE' },
      create: { code, name, educationOrder, status: 'ACTIVE' },
    });
  }

  const studyModes = [
    ['FULL_TIME', 'Full time'],
    ['PART_TIME', 'Part time'],
    ['ONLINE', 'Online'],
    ['HYBRID', 'Hybrid'],
  ] as const;
  for (const [code, name] of studyModes) {
    await prisma.studyMode.upsert({
      where: { code },
      update: { name, status: 'ACTIVE' },
      create: { code, name, status: 'ACTIVE' },
    });
  }

  const countrySeeds = [
    {
      name: 'Canada',
      slug: 'canada',
      continent: 'north-america',
      iso2: 'CA',
      iso3: 'CAN',
      capital: 'Ottawa',
      currencyName: 'Canadian Dollar',
      currencyCode: 'CAD',
      currencySymbol: '$',
      budgetBand: 'MID_RANGE',
      tuitionMin: '18000',
      tuitionMax: '42000',
      livingMin: '1200',
      livingMax: '2200',
      pathwayStrength: 'MODERATE',
      visaSuccessBand: 'MEDIUM',
      ieltsRequirement: 'OPTIONAL',
      languageWaiverAvailable: true,
      topRankedUniversitiesCount: 12,
      intakes: ['january', 'may', 'september'],
      isFeatured: true,
    },
    {
      name: 'United States',
      slug: 'united-states',
      continent: 'north-america',
      iso2: 'US',
      iso3: 'USA',
      capital: 'Washington, D.C.',
      currencyName: 'US Dollar',
      currencyCode: 'USD',
      currencySymbol: '$',
      budgetBand: 'PREMIUM',
      tuitionMin: '25000',
      tuitionMax: '65000',
      livingMin: '1500',
      livingMax: '3000',
      pathwayStrength: 'LIMITED',
      visaSuccessBand: 'MEDIUM',
      ieltsRequirement: 'REQUIRED',
      languageWaiverAvailable: false,
      topRankedUniversitiesCount: 25,
      intakes: ['january', 'september'],
      isFeatured: true,
    },
    {
      name: 'United Kingdom',
      slug: 'united-kingdom',
      continent: 'europe',
      iso2: 'GB',
      iso3: 'GBR',
      capital: 'London',
      currencyName: 'Pound Sterling',
      currencyCode: 'GBP',
      currencySymbol: '£',
      budgetBand: 'PREMIUM',
      tuitionMin: '22000',
      tuitionMax: '52000',
      livingMin: '1300',
      livingMax: '2600',
      pathwayStrength: 'MODERATE',
      visaSuccessBand: 'HIGH',
      ieltsRequirement: 'REQUIRED',
      languageWaiverAvailable: true,
      topRankedUniversitiesCount: 18,
      intakes: ['january', 'september'],
      isFeatured: true,
    },
    {
      name: 'Germany',
      slug: 'germany',
      continent: 'europe',
      iso2: 'DE',
      iso3: 'DEU',
      capital: 'Berlin',
      currencyName: 'Euro',
      currencyCode: 'EUR',
      currencySymbol: '€',
      budgetBand: 'BUDGET_FRIENDLY',
      tuitionMin: '500',
      tuitionMax: '15000',
      livingMin: '950',
      livingMax: '1600',
      pathwayStrength: 'STRONG',
      visaSuccessBand: 'HIGH',
      ieltsRequirement: 'OPTIONAL',
      languageWaiverAvailable: true,
      topRankedUniversitiesCount: 9,
      intakes: ['may', 'september'],
      isFeatured: true,
    },
    {
      name: 'France',
      slug: 'france',
      continent: 'europe',
      iso2: 'FR',
      iso3: 'FRA',
      capital: 'Paris',
      currencyName: 'Euro',
      currencyCode: 'EUR',
      currencySymbol: '€',
      budgetBand: 'MID_RANGE',
      tuitionMin: '3500',
      tuitionMax: '24000',
      livingMin: '1000',
      livingMax: '1900',
      pathwayStrength: 'MODERATE',
      visaSuccessBand: 'MEDIUM',
      ieltsRequirement: 'VARIES',
      languageWaiverAvailable: false,
      topRankedUniversitiesCount: 6,
      intakes: ['january', 'september'],
      isFeatured: false,
    },
    {
      name: 'Netherlands',
      slug: 'netherlands',
      continent: 'europe',
      iso2: 'NL',
      iso3: 'NLD',
      capital: 'Amsterdam',
      currencyName: 'Euro',
      currencyCode: 'EUR',
      currencySymbol: '€',
      budgetBand: 'MID_RANGE',
      tuitionMin: '10000',
      tuitionMax: '28000',
      livingMin: '1100',
      livingMax: '2000',
      pathwayStrength: 'MODERATE',
      visaSuccessBand: 'HIGH',
      ieltsRequirement: 'REQUIRED',
      languageWaiverAvailable: false,
      topRankedUniversitiesCount: 8,
      intakes: ['january', 'september'],
      isFeatured: false,
    },
    {
      name: 'Australia',
      slug: 'australia',
      continent: 'australia-new-zealand',
      iso2: 'AU',
      iso3: 'AUS',
      capital: 'Canberra',
      currencyName: 'Australian Dollar',
      currencyCode: 'AUD',
      currencySymbol: '$',
      budgetBand: 'PREMIUM',
      tuitionMin: '24000',
      tuitionMax: '52000',
      livingMin: '1600',
      livingMax: '2900',
      pathwayStrength: 'STRONG',
      visaSuccessBand: 'HIGH',
      ieltsRequirement: 'REQUIRED',
      languageWaiverAvailable: false,
      topRankedUniversitiesCount: 10,
      intakes: ['january', 'may', 'september'],
      isFeatured: true,
    },
    {
      name: 'New Zealand',
      slug: 'new-zealand',
      continent: 'australia-new-zealand',
      iso2: 'NZ',
      iso3: 'NZL',
      capital: 'Wellington',
      currencyName: 'New Zealand Dollar',
      currencyCode: 'NZD',
      currencySymbol: '$',
      budgetBand: 'MID_RANGE',
      tuitionMin: '21000',
      tuitionMax: '39000',
      livingMin: '1300',
      livingMax: '2200',
      pathwayStrength: 'STRONG',
      visaSuccessBand: 'HIGH',
      ieltsRequirement: 'OPTIONAL',
      languageWaiverAvailable: true,
      topRankedUniversitiesCount: 2,
      intakes: ['january', 'may'],
      isFeatured: false,
    },
    {
      name: 'Singapore',
      slug: 'singapore',
      continent: 'asia',
      iso2: 'SG',
      iso3: 'SGP',
      capital: 'Singapore',
      currencyName: 'Singapore Dollar',
      currencyCode: 'SGD',
      currencySymbol: '$',
      budgetBand: 'PREMIUM',
      tuitionMin: '22000',
      tuitionMax: '50000',
      livingMin: '1400',
      livingMax: '2600',
      pathwayStrength: 'MODERATE',
      visaSuccessBand: 'HIGH',
      ieltsRequirement: 'REQUIRED',
      languageWaiverAvailable: false,
      topRankedUniversitiesCount: 4,
      intakes: ['january', 'may', 'september'],
      isFeatured: true,
    },
    {
      name: 'Japan',
      slug: 'japan',
      continent: 'asia',
      iso2: 'JP',
      iso3: 'JPN',
      capital: 'Tokyo',
      currencyName: 'Japanese Yen',
      currencyCode: 'JPY',
      currencySymbol: '¥',
      budgetBand: 'MID_RANGE',
      tuitionMin: '900000',
      tuitionMax: '2200000',
      livingMin: '110000',
      livingMax: '210000',
      pathwayStrength: 'LIMITED',
      visaSuccessBand: 'MEDIUM',
      ieltsRequirement: 'VARIES',
      languageWaiverAvailable: false,
      topRankedUniversitiesCount: 7,
      intakes: ['may', 'september'],
      isFeatured: false,
    },
    {
      name: 'United Arab Emirates',
      slug: 'united-arab-emirates',
      continent: 'middle-east',
      iso2: 'AE',
      iso3: 'ARE',
      capital: 'Abu Dhabi',
      currencyName: 'UAE Dirham',
      currencyCode: 'AED',
      currencySymbol: 'د.إ',
      budgetBand: 'PREMIUM',
      tuitionMin: '55000',
      tuitionMax: '120000',
      livingMin: '4500',
      livingMax: '9000',
      pathwayStrength: 'MODERATE',
      visaSuccessBand: 'HIGH',
      ieltsRequirement: 'OPTIONAL',
      languageWaiverAvailable: true,
      topRankedUniversitiesCount: 0,
      intakes: ['january', 'may', 'september'],
      isFeatured: false,
    },
    {
      name: 'South Africa',
      slug: 'south-africa',
      continent: 'africa',
      iso2: 'ZA',
      iso3: 'ZAF',
      capital: 'Pretoria',
      currencyName: 'South African Rand',
      currencyCode: 'ZAR',
      currencySymbol: 'R',
      budgetBand: 'BUDGET_FRIENDLY',
      tuitionMin: '55000',
      tuitionMax: '160000',
      livingMin: '8000',
      livingMax: '16000',
      pathwayStrength: 'LIMITED',
      visaSuccessBand: 'LOW',
      ieltsRequirement: 'NOT_REQUIRED',
      languageWaiverAvailable: true,
      topRankedUniversitiesCount: 0,
      intakes: ['january', 'may'],
      isFeatured: false,
    },
    {
      name: 'Brazil',
      slug: 'brazil',
      continent: 'south-america',
      iso2: 'BR',
      iso3: 'BRA',
      capital: 'Brasília',
      currencyName: 'Brazilian Real',
      currencyCode: 'BRL',
      currencySymbol: 'R$',
      budgetBand: 'BUDGET_FRIENDLY',
      tuitionMin: '12000',
      tuitionMax: '45000',
      livingMin: '2500',
      livingMax: '5500',
      pathwayStrength: 'LIMITED',
      visaSuccessBand: 'LOW',
      ieltsRequirement: 'NOT_REQUIRED',
      languageWaiverAvailable: true,
      topRankedUniversitiesCount: 3,
      intakes: ['january', 'may'],
      isFeatured: false,
    },
  ] as const;

  const continentRows = await prisma.continent.findMany();
  const continentBySlug = new Map(
    continentRows.map((item) => [item.slug, item]),
  );
  const intakeRows = await prisma.intake.findMany();
  const intakeBySlug = new Map(intakeRows.map((item) => [item.slug, item]));
  const countryBySlug = new Map<string, Country>();
  const seedDisclaimer =
    'Fictional local seed data for development and filter testing only.';

  for (const [index, item] of countrySeeds.entries()) {
    const continent = continentBySlug.get(item.continent);
    if (!continent)
      throw new Error(`Missing seeded continent: ${item.continent}`);
    const sourceReference = `https://example.com/universta/seed/countries/${item.slug}`;
    const countryCore = {
      continentId: continent.id,
      name: item.name,
      pageHeading: `Study in ${item.name}`,
      iso2Code: item.iso2,
      iso3Code: item.iso3,
      capitalCity: item.capital,
      currencyName: item.currencyName,
      currencyCode: item.currencyCode,
      currencySymbol: item.currencySymbol,
      shortDescription: `Explore fictional study options, costs, intakes and courses in ${item.name}.`,
      overview: `${item.name} is included as a complete local catalog fixture so every Phase 1 filter and detail state can be tested safely.`,
      featuredLabel: item.isFeatured ? 'Popular destination' : null,
      isFeatured: item.isFeatured,
      isPopular: item.isFeatured,
      status: 'PUBLISHED',
      displayOrder: index + 1,
      publishedAt: now,
      lastVerifiedAt: now,
      primarySourceUrl: sourceReference,
      updatedByUserId: admin.id,
      deletedAt: null,
    };
    const existingCountry =
      (await prisma.country.findUnique({ where: { slug: item.slug } })) ??
      (await prisma.country.findFirst({
        where: {
          OR: [{ iso2Code: item.iso2 }, { iso3Code: item.iso3 }],
        },
      }));
    const country = existingCountry
      ? await prisma.country.update({
          where: { id: existingCountry.id },
          data: { ...countryCore, slug: item.slug },
        })
      : await prisma.country.create({
          data: {
            ...countryCore,
            slug: item.slug,
            createdByUserId: admin.id,
          },
        });
    countryBySlug.set(item.slug, country);

    const costProfile = {
      currencyCode: item.currencyCode,
      currencySymbol: item.currencySymbol,
      tuitionMin: new Prisma.Decimal(item.tuitionMin),
      tuitionMax: new Prisma.Decimal(item.tuitionMax),
      tuitionPeriod: 'PER_YEAR',
      livingCostMin: new Prisma.Decimal(item.livingMin),
      livingCostMax: new Prisma.Decimal(item.livingMax),
      livingCostPeriod: 'PER_MONTH',
      budgetBand: item.budgetBand,
      applicableYear: now.getUTCFullYear(),
      sourceReference,
      disclaimer: seedDisclaimer,
      verifiedAt: now,
    };
    await prisma.countryCostProfile.upsert({
      where: { countryId: country.id },
      update: costProfile,
      create: { countryId: country.id, ...costProfile },
    });

    const workProfile = {
      partTimeAllowed: true,
      partTimeHoursPerWeek: new Prisma.Decimal('20'),
      partTimeSummary: 'Fictional work-rights fixture for local testing.',
      postStudyWorkAvailable: item.pathwayStrength !== 'LIMITED',
      postStudyWorkMinMonths: 12,
      postStudyWorkMaxMonths: item.pathwayStrength === 'STRONG' ? 36 : 24,
      immigrationPathwayStrength: item.pathwayStrength,
      immigrationPathwaySummary:
        'Fictional immigration-pathway fixture for local testing.',
      visaSuccessBand: item.visaSuccessBand,
      visaInformation: 'Fictional visa fixture for local testing.',
      sourceReference,
      disclaimer: seedDisclaimer,
      verifiedAt: now,
    };
    await prisma.countryWorkProfile.upsert({
      where: { countryId: country.id },
      update: workProfile,
      create: { countryId: country.id, ...workProfile },
    });

    const languageProfile = {
      ieltsRequirement: item.ieltsRequirement,
      ieltsMinScore: new Prisma.Decimal('6.5'),
      pteRequirement: item.ieltsRequirement,
      pteMinScore: new Prisma.Decimal('60'),
      toeflRequirement: item.ieltsRequirement,
      toeflMinScore: new Prisma.Decimal('88'),
      duolingoRequirement: 'VARIES',
      duolingoMinScore: new Prisma.Decimal('110'),
      languageWaiverAvailable: item.languageWaiverAvailable,
      generalNotes: 'Fictional language-requirement fixture for local testing.',
      sourceReference,
      disclaimer: seedDisclaimer,
      verifiedAt: now,
    };
    await prisma.countryLanguageRequirement.upsert({
      where: { countryId: country.id },
      update: languageProfile,
      create: { countryId: country.id, ...languageProfile },
    });

    const statistic = {
      universitiesCount: 40 + index * 7,
      publicUniversitiesCount: 15 + index,
      privateUniversitiesCount: 25 + index * 6,
      coursesCount: 600 + index * 175,
      ugCoursesCount: 250 + index * 50,
      pgCoursesCount: 200 + index * 45,
      pgdmCoursesCount: 50 + index * 10,
      mbaCoursesCount: 40 + index * 8,
      phdCoursesCount: 30 + index * 5,
      scholarshipsCount: 80 + index * 12,
      citiesCount: 8 + index,
      topRankedUniversitiesCount: item.topRankedUniversitiesCount,
      internationalStudentsCount: 25000 + index * 5000,
      sourceMode: 'MANUAL',
      sourceReference,
      verifiedAt: now,
    };
    await prisma.countryStatistic.upsert({
      where: { countryId: country.id },
      update: statistic,
      create: { countryId: country.id, ...statistic },
    });

    for (const [intakeIndex, intakeSlug] of item.intakes.entries()) {
      const intake = intakeBySlug.get(intakeSlug);
      if (!intake) throw new Error(`Missing seeded intake: ${intakeSlug}`);
      const intakeData = {
        isMajor: intakeIndex === item.intakes.length - 1,
        availabilityStatus: intakeIndex === 1 ? 'LIMITED' : 'AVAILABLE',
        displayOrder: intakeIndex,
        notes: 'Fictional intake fixture for local testing.',
      };
      await prisma.countryIntake.upsert({
        where: {
          countryId_intakeId: { countryId: country.id, intakeId: intake.id },
        },
        update: intakeData,
        create: { countryId: country.id, intakeId: intake.id, ...intakeData },
      });
    }

    await prisma.countryContentSection.upsert({
      where: {
        countryId_sectionKey: { countryId: country.id, sectionKey: 'overview' },
      },
      update: {
        sectionType: 'RICH_TEXT',
        eyebrow: 'Country overview',
        heading: `Why study in ${item.name}?`,
        bodyJson: {
          paragraphs: [
            `Fictional overview content for testing the ${item.name} country detail page.`,
          ],
        },
        displayOrder: 1,
        status: 'ACTIVE',
        deletedAt: null,
      },
      create: {
        countryId: country.id,
        sectionKey: 'overview',
        sectionType: 'RICH_TEXT',
        eyebrow: 'Country overview',
        heading: `Why study in ${item.name}?`,
        bodyJson: {
          paragraphs: [
            `Fictional overview content for testing the ${item.name} country detail page.`,
          ],
        },
        displayOrder: 1,
        status: 'ACTIVE',
      },
    });
    const faqQuestion = `Is ${item.name} available in the local test catalog?`;
    const existingFaq = await prisma.countryFaq.findFirst({
      where: { countryId: country.id, question: faqQuestion },
    });
    const faqData = {
      question: faqQuestion,
      answer: `Yes. ${item.name} is a fictional seeded destination intended only for local UI and filter testing.`,
      category: 'Seed data',
      isFeatured: true,
      status: 'ACTIVE',
      displayOrder: 1,
      updatedByUserId: admin.id,
      deletedAt: null,
    };
    if (existingFaq) {
      await prisma.countryFaq.update({
        where: { id: existingFaq.id },
        data: faqData,
      });
    } else {
      await prisma.countryFaq.create({
        data: { countryId: country.id, ...faqData, createdByUserId: admin.id },
      });
    }
  }

  const subjectSeeds = [
    {
      name: 'Computer Science',
      slug: 'computer-science',
      description: 'Computing, software, data and intelligent systems.',
      featured: true,
      specializations: [
        ['Artificial Intelligence', 'artificial-intelligence'],
        ['Cybersecurity', 'cybersecurity'],
        ['Data Science', 'data-science'],
        ['Software Engineering', 'software-engineering'],
      ],
    },
    {
      name: 'Business & Management',
      slug: 'business-management',
      description: 'Business leadership, finance and global management.',
      featured: true,
      specializations: [
        ['Finance', 'finance'],
        ['International Business', 'international-business'],
        ['Marketing', 'marketing'],
      ],
    },
    {
      name: 'Engineering',
      slug: 'engineering',
      description: 'Applied engineering and sustainable technologies.',
      featured: true,
      specializations: [
        ['Civil Engineering', 'civil-engineering'],
        ['Electrical Engineering', 'electrical-engineering'],
        ['Mechanical Engineering', 'mechanical-engineering'],
      ],
    },
    {
      name: 'Health & Medicine',
      slug: 'health-medicine',
      description: 'Health systems, nursing and public health.',
      featured: false,
      specializations: [
        ['Nursing', 'nursing'],
        ['Public Health', 'public-health'],
      ],
    },
    {
      name: 'Creative Arts & Design',
      slug: 'creative-arts-design',
      description: 'Design, creativity and digital experiences.',
      featured: false,
      specializations: [
        ['Graphic Design', 'graphic-design'],
        ['User Experience Design', 'user-experience-design'],
      ],
    },
  ] as const;
  const subjectBySlug = new Map<string, Subject>();
  const subSubjectBySlug = new Map<string, SubSubject>();
  for (const [subjectIndex, item] of subjectSeeds.entries()) {
    const subjectData = {
      name: item.name,
      shortDescription: item.description,
      overview: `${item.description} Fictional subject data for local discovery testing.`,
      status: 'PUBLISHED',
      isFeatured: item.featured,
      displayOrder: subjectIndex + 1,
      publishedAt: now,
      updatedByUserId: admin.id,
      deletedAt: null,
    };
    const subject = await prisma.subject.upsert({
      where: { slug: item.slug },
      update: subjectData,
      create: { ...subjectData, slug: item.slug, createdByUserId: admin.id },
    });
    subjectBySlug.set(item.slug, subject);
    for (const [
      specializationIndex,
      [name, slug],
    ] of item.specializations.entries()) {
      const specializationData = {
        subjectId: subject.id,
        name,
        shortDescription: `Explore fictional ${name} courses and study options.`,
        overview: `Seeded ${name} specialization content for local interaction testing.`,
        status: 'PUBLISHED',
        isFeatured: specializationIndex < 3,
        displayOrder: specializationIndex + 1,
        publishedAt: now,
        updatedByUserId: admin.id,
        deletedAt: null,
      };
      const specialization = await prisma.subSubject.upsert({
        where: { slug },
        update: specializationData,
        create: { ...specializationData, slug, createdByUserId: admin.id },
      });
      subSubjectBySlug.set(slug, specialization);
    }
  }

  const levelRows = await prisma.courseLevel.findMany();
  const levelByCode = new Map(levelRows.map((item) => [item.code, item]));
  const modeRows = await prisma.studyMode.findMany();
  const modeByCode = new Map(modeRows.map((item) => [item.code, item]));
  const courseSeeds = [
    {
      name: 'Certificate in Cloud Computing',
      slug: 'certificate-cloud-computing',
      subject: 'computer-science',
      specialization: 'software-engineering',
      level: 'CERTIFICATE',
      modes: ['ONLINE'],
      duration: '6',
      durationUnit: 'MONTHS',
      featured: false,
      popularity: '62',
      mappings: [['canada', '7500', '9500', false, ['january', 'may']]],
    },
    {
      name: 'Diploma in Cybersecurity',
      slug: 'diploma-cybersecurity',
      subject: 'computer-science',
      specialization: 'cybersecurity',
      level: 'DIPLOMA',
      modes: ['PART_TIME', 'HYBRID'],
      duration: '18',
      durationUnit: 'MONTHS',
      featured: true,
      popularity: '88',
      mappings: [
        ['canada', '14000', '19000', true, ['may', 'september']],
        ['united-arab-emirates', '42000', '60000', false, ['january']],
      ],
    },
    {
      name: 'Bachelor of Computer Science',
      slug: 'bachelor-computer-science',
      subject: 'computer-science',
      specialization: 'software-engineering',
      level: 'UG',
      modes: ['FULL_TIME', 'HYBRID'],
      duration: '4',
      durationUnit: 'YEARS',
      featured: true,
      popularity: '97',
      mappings: [
        ['canada', '22000', '34000', true, ['january', 'september']],
        ['united-kingdom', '24000', '39000', true, ['september']],
      ],
    },
    {
      name: 'Master of Data Science',
      slug: 'master-data-science',
      subject: 'computer-science',
      specialization: 'data-science',
      level: 'PG',
      modes: ['FULL_TIME', 'ONLINE'],
      duration: '2',
      durationUnit: 'YEARS',
      featured: true,
      popularity: '95',
      mappings: [
        ['germany', '8000', '14000', true, ['may', 'september']],
        ['netherlands', '16000', '26000', false, ['january', 'september']],
      ],
    },
    {
      name: 'Postgraduate Diploma in Digital Business',
      slug: 'pgdm-digital-business',
      subject: 'business-management',
      specialization: 'marketing',
      level: 'PGDM',
      modes: ['HYBRID', 'PART_TIME'],
      duration: '1',
      durationUnit: 'YEARS',
      featured: false,
      popularity: '76',
      mappings: [
        ['singapore', '28000', '38000', false, ['january', 'may']],
        ['canada', '19000', '26000', true, ['september']],
      ],
    },
    {
      name: 'MBA in Global Management',
      slug: 'mba-global-management',
      subject: 'business-management',
      specialization: 'international-business',
      level: 'MBA',
      modes: ['FULL_TIME', 'PART_TIME'],
      duration: '2',
      durationUnit: 'YEARS',
      featured: true,
      popularity: '93',
      mappings: [
        ['united-states', '45000', '62000', true, ['january', 'september']],
        ['united-kingdom', '36000', '49000', false, ['september']],
      ],
    },
    {
      name: 'PhD in Artificial Intelligence',
      slug: 'phd-artificial-intelligence',
      subject: 'computer-science',
      specialization: 'artificial-intelligence',
      level: 'PHD',
      modes: ['FULL_TIME'],
      duration: '4',
      durationUnit: 'YEARS',
      featured: false,
      popularity: '84',
      mappings: [
        ['united-states', '32000', '48000', true, ['september']],
        ['japan', '1200000', '1800000', true, ['may']],
      ],
    },
    {
      name: 'Bachelor of Mechanical Engineering',
      slug: 'bachelor-mechanical-engineering',
      subject: 'engineering',
      specialization: 'mechanical-engineering',
      level: 'UG',
      modes: ['FULL_TIME'],
      duration: '4',
      durationUnit: 'YEARS',
      featured: true,
      popularity: '89',
      mappings: [
        ['australia', '33000', '47000', true, ['january', 'may']],
        ['germany', '3000', '9000', false, ['september']],
      ],
    },
    {
      name: 'Master of Public Health',
      slug: 'master-public-health',
      subject: 'health-medicine',
      specialization: 'public-health',
      level: 'PG',
      modes: ['FULL_TIME', 'ONLINE'],
      duration: '2',
      durationUnit: 'YEARS',
      featured: false,
      popularity: '81',
      mappings: [
        ['united-kingdom', '23000', '35000', true, ['january', 'september']],
        ['south-africa', '85000', '130000', false, ['january']],
      ],
    },
    {
      name: 'Diploma in User Experience Design',
      slug: 'diploma-user-experience-design',
      subject: 'creative-arts-design',
      specialization: 'user-experience-design',
      level: 'DIPLOMA',
      modes: ['HYBRID'],
      duration: '1',
      durationUnit: 'YEARS',
      featured: false,
      popularity: '71',
      mappings: [
        ['new-zealand', '19000', '28000', true, ['january', 'may']],
        ['france', '11000', '18000', false, ['september']],
      ],
    },
    {
      name: 'Bachelor of Finance',
      slug: 'bachelor-finance',
      subject: 'business-management',
      specialization: 'finance',
      level: 'UG',
      modes: ['FULL_TIME'],
      duration: '3',
      durationUnit: 'YEARS',
      featured: false,
      popularity: '79',
      mappings: [
        ['singapore', '30000', '44000', true, ['january', 'september']],
        ['united-arab-emirates', '62000', '88000', false, ['may']],
      ],
    },
    {
      name: 'Certificate in Sustainable Engineering',
      slug: 'certificate-sustainable-engineering',
      subject: 'engineering',
      specialization: 'civil-engineering',
      level: 'CERTIFICATE',
      modes: ['ONLINE', 'PART_TIME'],
      duration: '9',
      durationUnit: 'MONTHS',
      featured: false,
      popularity: '66',
      mappings: [
        ['brazil', '15000', '24000', false, ['january']],
        ['south-africa', '60000', '90000', true, ['may']],
      ],
    },
  ] as const;

  for (const [courseIndex, item] of courseSeeds.entries()) {
    const subject = subjectBySlug.get(item.subject);
    const specialization = subSubjectBySlug.get(item.specialization);
    const level = levelByCode.get(item.level);
    if (!subject || !specialization || !level)
      throw new Error(`Missing seeded course dependency for ${item.slug}`);
    const courseData = {
      subjectId: subject.id,
      subSubjectId: specialization.id,
      courseLevelId: level.id,
      name: item.name,
      shortName: item.name,
      qualificationName: item.name,
      courseCode: `SEED-${String(courseIndex + 1).padStart(3, '0')}`,
      shortDescription: `Fictional ${item.name} record for local course discovery and filter testing.`,
      overview: `This seeded ${item.name} course provides complete local detail, availability, intake and tuition states.`,
      durationMin: new Prisma.Decimal(item.duration),
      durationMax: new Prisma.Decimal(item.duration),
      durationUnit: item.durationUnit,
      careerSummary:
        'Fictional career information for local detail-page testing.',
      status: 'PUBLISHED',
      isFeatured: item.featured,
      popularityScore: new Prisma.Decimal(item.popularity),
      displayOrder: courseIndex + 1,
      publishedAt: now,
      updatedByUserId: admin.id,
      deletedAt: null,
    };
    const course = await prisma.course.upsert({
      where: { slug: item.slug },
      update: courseData,
      create: { ...courseData, slug: item.slug, createdByUserId: admin.id },
    });
    for (const modeCode of item.modes) {
      const mode = modeByCode.get(modeCode);
      if (!mode) throw new Error(`Missing seeded study mode: ${modeCode}`);
      await prisma.courseStudyMode.upsert({
        where: {
          courseId_studyModeId: { courseId: course.id, studyModeId: mode.id },
        },
        update: {},
        create: { courseId: course.id, studyModeId: mode.id },
      });
    }
    for (const [
      mappingIndex,
      [countrySlug, tuitionMin, tuitionMax, scholarshipAvailable, intakeSlugs],
    ] of item.mappings.entries()) {
      const country = countryBySlug.get(countrySlug);
      if (!country) throw new Error(`Missing seeded country: ${countrySlug}`);
      const sourceReference = `https://example.com/universta/seed/courses/${item.slug}/${countrySlug}`;
      const mappingData = {
        availabilityStatus: mappingIndex === 0 ? 'AVAILABLE' : 'LIMITED',
        indicativeTuitionMin: new Prisma.Decimal(tuitionMin),
        indicativeTuitionMax: new Prisma.Decimal(tuitionMax),
        currencyCode: country.currencyCode,
        tuitionPeriod: 'PER_YEAR',
        academicMinPercentage: new Prisma.Decimal('60'),
        ieltsMinScore: new Prisma.Decimal('6.5'),
        scholarshipAvailable,
        admissionRequirements:
          'Fictional academic requirements for local testing.',
        englishRequirements:
          'Fictional English-language requirements for local testing.',
        careerOpportunities: 'Fictional career pathways for local testing.',
        sourceReference,
        verifiedAt: now,
        status: 'ACTIVE',
        isFeatured: item.featured && mappingIndex === 0,
        displayOrder: mappingIndex + 1,
        deletedAt: null,
      };
      const mapping = await prisma.countryCourse.upsert({
        where: {
          countryId_courseId: { countryId: country.id, courseId: course.id },
        },
        update: mappingData,
        create: { countryId: country.id, courseId: course.id, ...mappingData },
      });
      for (const intakeSlug of intakeSlugs) {
        const intake = intakeBySlug.get(intakeSlug);
        if (!intake) throw new Error(`Missing seeded intake: ${intakeSlug}`);
        await prisma.countryCourseIntake.upsert({
          where: {
            countryCourseId_intakeId: {
              countryCourseId: mapping.id,
              intakeId: intake.id,
            },
          },
          update: {
            status: 'ACTIVE',
            deadlineNotes: 'Fictional application deadline fixture.',
          },
          create: {
            countryCourseId: mapping.id,
            intakeId: intake.id,
            status: 'ACTIVE',
            deadlineNotes: 'Fictional application deadline fixture.',
          },
        });
      }
    }
    await prisma.courseContentSection.upsert({
      where: {
        courseId_sectionKey: { courseId: course.id, sectionKey: 'overview' },
      },
      update: {
        heading: `${item.name} overview`,
        bodyJson: {
          paragraphs: [
            `Fictional content for testing the ${item.name} detail page.`,
          ],
        },
        displayOrder: 1,
        status: 'ACTIVE',
        deletedAt: null,
      },
      create: {
        courseId: course.id,
        sectionKey: 'overview',
        heading: `${item.name} overview`,
        bodyJson: {
          paragraphs: [
            `Fictional content for testing the ${item.name} detail page.`,
          ],
        },
        displayOrder: 1,
        status: 'ACTIVE',
      },
    });
    const faqQuestion = `Is ${item.name} a real course offering?`;
    const existingFaq = await prisma.courseFaq.findFirst({
      where: { courseId: course.id, question: faqQuestion },
    });
    const faqData = {
      question: faqQuestion,
      answer:
        'No. This is clearly labeled fictional seed data for local development and test coverage.',
      status: 'ACTIVE',
      displayOrder: 1,
      deletedAt: null,
    };
    if (existingFaq) {
      await prisma.courseFaq.update({
        where: { id: existingFaq.id },
        data: faqData,
      });
    } else {
      await prisma.courseFaq.create({
        data: { courseId: course.id, ...faqData },
      });
    }
  }

  // Expanded Phase 1 records are deliberately fictional, local-only fixtures.
  // They are not part of the normal foundation seed or any deployment path.
  const demoCountry =
    countryBySlug.get('canada') ??
    (await prisma.country.findFirst({
      where: { status: 'PUBLISHED', deletedAt: null },
    }));
  const demoCourse = await prisma.course.findFirst({
    where: { status: 'PUBLISHED', deletedAt: null },
    orderBy: { displayOrder: 'asc' },
  });
  const demoLevel = await prisma.courseLevel.findFirst({
    where: { status: 'ACTIVE' },
  });

  // Structured location demo fixtures: gives City Listing/City Detail real
  // content after a clean seed (previously zero State/City rows existed no
  // matter how many times the seed ran), and lets Campus/ConsultantLocation/
  // Job records below link to a real City/State via FK, not only free text.
  // Idempotent by (countryId, slug); reruns update rather than duplicate.
  let demoState: Awaited<ReturnType<typeof prisma.state.upsert>> | null = null;
  let demoCity: Awaited<ReturnType<typeof prisma.city.upsert>> | null = null;
  let demoCityHarbour: Awaited<ReturnType<typeof prisma.city.upsert>> | null =
    null;
  if (demoCountry) {
    demoState = await prisma.state.upsert({
      where: {
        countryId_slug: { countryId: demoCountry.id, slug: 'demo-province' },
      },
      update: { name: 'Demo Province', status: 'PUBLISHED', deletedAt: null },
      create: {
        countryId: demoCountry.id,
        name: 'Demo Province',
        slug: 'demo-province',
        status: 'PUBLISHED',
      },
    });
    demoCity = await prisma.city.upsert({
      where: {
        countryId_slug: { countryId: demoCountry.id, slug: 'demo-city' },
      },
      update: {
        stateId: demoState.id,
        name: 'Demo City',
        shortDescription:
          'Clearly fictional demo city fixture for local filtering and comparison.',
        status: 'PUBLISHED',
        publishedAt: now,
        deletedAt: null,
      },
      create: {
        countryId: demoCountry.id,
        stateId: demoState.id,
        name: 'Demo City',
        slug: 'demo-city',
        shortDescription:
          'Clearly fictional demo city fixture for local filtering and comparison.',
        status: 'PUBLISHED',
        publishedAt: now,
      },
    });
    demoCityHarbour = await prisma.city.upsert({
      where: {
        countryId_slug: { countryId: demoCountry.id, slug: 'demo-harbour' },
      },
      update: {
        stateId: demoState.id,
        name: 'Demo Harbour',
        shortDescription:
          'Clearly fictional demo city fixture for local filtering and comparison.',
        status: 'PUBLISHED',
        publishedAt: now,
        deletedAt: null,
      },
      create: {
        countryId: demoCountry.id,
        stateId: demoState.id,
        name: 'Demo Harbour',
        slug: 'demo-harbour',
        shortDescription:
          'Clearly fictional demo city fixture for local filtering and comparison.',
        status: 'PUBLISHED',
        publishedAt: now,
      },
    });
  }

  if (demoCountry) {
    const university = await prisma.university.upsert({
      where: { slug: 'northstar-demonstration-university' },
      update: {
        countryId: demoCountry.id,
        name: 'Northstar Demonstration University',
        institutionType: 'DEMONSTRATION',
        shortDescription:
          'Clearly fictional local university fixture for Phase 1 testing.',
        overview:
          'Northstar Demonstration University is fictional seed data. It must never be presented as a real institution.',
        sourceReference:
          'https://example.com/universta/local-demo/universities/northstar',
        verifiedAt: now,
        status: 'PUBLISHED',
        publishedAt: now,
        deletedAt: null,
      },
      create: {
        countryId: demoCountry.id,
        name: 'Northstar Demonstration University',
        slug: 'northstar-demonstration-university',
        institutionType: 'DEMONSTRATION',
        shortDescription:
          'Clearly fictional local university fixture for Phase 1 testing.',
        overview:
          'Northstar Demonstration University is fictional seed data. It must never be presented as a real institution.',
        sourceReference:
          'https://example.com/universta/local-demo/universities/northstar',
        verifiedAt: now,
        status: 'PUBLISHED',
        publishedAt: now,
      },
    });
    const campus = await prisma.universityCampus.upsert({
      where: {
        universityId_slug: {
          universityId: university.id,
          slug: 'demo-city-campus',
        },
      },
      update: {
        name: 'Demo City Campus',
        city: 'Demo City',
        cityId: demoCity?.id,
        stateId: demoState?.id,
        overview: 'Fictional local campus fixture.',
        status: 'ACTIVE',
        deletedAt: null,
      },
      create: {
        universityId: university.id,
        name: 'Demo City Campus',
        slug: 'demo-city-campus',
        city: 'Demo City',
        cityId: demoCity?.id,
        stateId: demoState?.id,
        overview: 'Fictional local campus fixture.',
        status: 'ACTIVE',
      },
    });
    const accreditation = await prisma.universityAccreditation.findFirst({
      where: {
        universityId: university.id,
        name: 'Local demonstration record',
      },
    });
    if (accreditation)
      await prisma.universityAccreditation.update({
        where: { id: accreditation.id },
        data: { status: 'ACTIVE', deletedAt: null, verifiedAt: now },
      });
    else
      await prisma.universityAccreditation.create({
        data: {
          universityId: university.id,
          name: 'Local demonstration record',
          accreditor: 'Not a real accreditor',
          referenceUrl: 'https://example.com/universta/local-demo',
          verifiedAt: now,
          status: 'ACTIVE',
        },
      });
    if (demoCourse) {
      const offering = await prisma.universityCourseOffering.upsert({
        where: { slug: 'msc-computer-science-northstar-demo' },
        update: {
          universityId: university.id,
          genericCourseId: demoCourse.id,
          campusId: campus.id,
          courseLevelId: demoLevel?.id ?? null,
          name: 'MSc Computer Science — local demo offering',
          shortDescription:
            'Clearly fictional university-owned offering for local testing.',
          overview:
            'This is a fictional local development fixture, not a real university program.',
          studyMode: 'FULL_TIME',
          durationMin: new Prisma.Decimal('2'),
          durationMax: new Prisma.Decimal('2'),
          durationUnit: 'YEARS',
          tuitionMin: new Prisma.Decimal('24000'),
          tuitionMax: new Prisma.Decimal('26000'),
          currencyCode: 'CAD',
          tuitionPeriod: 'PER_YEAR',
          sourceReference:
            'https://example.com/universta/local-demo/offerings/msc-computer-science',
          verifiedAt: now,
          status: 'PUBLISHED',
          publishedAt: now,
          deletedAt: null,
        },
        create: {
          universityId: university.id,
          genericCourseId: demoCourse.id,
          campusId: campus.id,
          courseLevelId: demoLevel?.id ?? null,
          name: 'MSc Computer Science — local demo offering',
          slug: 'msc-computer-science-northstar-demo',
          shortDescription:
            'Clearly fictional university-owned offering for local testing.',
          overview:
            'This is a fictional local development fixture, not a real university program.',
          studyMode: 'FULL_TIME',
          durationMin: new Prisma.Decimal('2'),
          durationMax: new Prisma.Decimal('2'),
          durationUnit: 'YEARS',
          tuitionMin: new Prisma.Decimal('24000'),
          tuitionMax: new Prisma.Decimal('26000'),
          currencyCode: 'CAD',
          tuitionPeriod: 'PER_YEAR',
          sourceReference:
            'https://example.com/universta/local-demo/offerings/msc-computer-science',
          verifiedAt: now,
          status: 'PUBLISHED',
          publishedAt: now,
        },
      });
      for (const intake of intakeRows.slice(0, 2))
        await prisma.universityCourseIntake.upsert({
          where: {
            offeringId_intakeId: {
              offeringId: offering.id,
              intakeId: intake.id,
            },
          },
          update: { status: 'ACTIVE', deadline: new Date('2026-11-15') },
          create: {
            offeringId: offering.id,
            intakeId: intake.id,
            deadline: new Date('2026-11-15'),
            status: 'ACTIVE',
          },
        });
      const requirement = await prisma.universityCourseRequirement.findFirst({
        where: { offeringId: offering.id, title: 'Local academic requirement' },
      });
      if (requirement)
        await prisma.universityCourseRequirement.update({
          where: { id: requirement.id },
          data: {
            status: 'ACTIVE',
            description: 'Fictional local requirement for interface testing.',
            deletedAt: null,
          },
        });
      else
        await prisma.universityCourseRequirement.create({
          data: {
            offeringId: offering.id,
            category: 'ACADEMIC',
            title: 'Local academic requirement',
            description: 'Fictional local requirement for interface testing.',
            status: 'ACTIVE',
          },
        });

      const provider = await prisma.scholarshipProvider.upsert({
        where: { slug: 'universta-demo-provider' },
        update: {
          name: 'Universta Demonstration Provider',
          status: 'ACTIVE',
          deletedAt: null,
        },
        create: {
          name: 'Universta Demonstration Provider',
          slug: 'universta-demo-provider',
          websiteUrl: 'https://example.com/universta/local-demo/scholarships',
          status: 'ACTIVE',
        },
      });
      const scholarship = await prisma.scholarship.upsert({
        where: { slug: 'northstar-local-demo-scholarship' },
        update: {
          providerId: provider.id,
          title: 'Northstar local demo scholarship',
          summary:
            'Clearly fictional scholarship record for local filter and detail testing.',
          description:
            'This is a fictional local development fixture. It is not an award or an endorsement.',
          benefitType: 'TUITION_REDUCTION',
          amount: new Prisma.Decimal('2000'),
          currencyCode: 'CAD',
          eligibility: 'Fictional local eligibility text.',
          deadline: new Date('2026-12-01'),
          applicationUrl:
            'https://example.com/universta/local-demo/scholarships/apply',
          sourceReference:
            'https://example.com/universta/local-demo/scholarships/northstar',
          verifiedAt: now,
          status: 'PUBLISHED',
          publishedAt: now,
          deletedAt: null,
        },
        create: {
          providerId: provider.id,
          title: 'Northstar local demo scholarship',
          slug: 'northstar-local-demo-scholarship',
          summary:
            'Clearly fictional scholarship record for local filter and detail testing.',
          description:
            'This is a fictional local development fixture. It is not an award or an endorsement.',
          benefitType: 'TUITION_REDUCTION',
          amount: new Prisma.Decimal('2000'),
          currencyCode: 'CAD',
          eligibility: 'Fictional local eligibility text.',
          deadline: new Date('2026-12-01'),
          applicationUrl:
            'https://example.com/universta/local-demo/scholarships/apply',
          sourceReference:
            'https://example.com/universta/local-demo/scholarships/northstar',
          verifiedAt: now,
          status: 'PUBLISHED',
          publishedAt: now,
        },
      });
      await prisma.scholarshipCountry.upsert({
        where: {
          scholarshipId_countryId: {
            scholarshipId: scholarship.id,
            countryId: demoCountry.id,
          },
        },
        update: {},
        create: { scholarshipId: scholarship.id, countryId: demoCountry.id },
      });
      await prisma.scholarshipUniversity.upsert({
        where: {
          scholarshipId_universityId: {
            scholarshipId: scholarship.id,
            universityId: university.id,
          },
        },
        update: {},
        create: { scholarshipId: scholarship.id, universityId: university.id },
      });
      await prisma.scholarshipUniversityCourseOffering.upsert({
        where: {
          scholarshipId_offeringId: {
            scholarshipId: scholarship.id,
            offeringId: offering.id,
          },
        },
        update: {},
        create: { scholarshipId: scholarship.id, offeringId: offering.id },
      });
      await prisma.successStory.upsert({
        where: { slug: 'local-demo-study-journey' },
        update: {
          countryId: demoCountry.id,
          universityId: university.id,
          offeringId: offering.id,
          title: 'Local demo study journey',
          journey:
            'Clearly fictional local demo content. It does not represent a real student, outcome or endorsement.',
          attribution: 'Demo record — not a real student',
          status: 'PUBLISHED',
          publishedAt: now,
          deletedAt: null,
        },
        create: {
          countryId: demoCountry.id,
          universityId: university.id,
          offeringId: offering.id,
          title: 'Local demo study journey',
          slug: 'local-demo-study-journey',
          journey:
            'Clearly fictional local demo content. It does not represent a real student, outcome or endorsement.',
          attribution: 'Demo record — not a real student',
          status: 'PUBLISHED',
          publishedAt: now,
        },
      });
      const testimonial = await prisma.testimonial.findFirst({
        where: { attribution: 'Demo record — not a real student' },
      });
      if (testimonial)
        await prisma.testimonial.update({
          where: { id: testimonial.id },
          data: {
            universityId: university.id,
            offeringId: offering.id,
            quote:
              'Clearly fictional local demo content for layout testing only.',
            status: 'PUBLISHED',
            publishedAt: now,
            deletedAt: null,
          },
        });
      else
        await prisma.testimonial.create({
          data: {
            universityId: university.id,
            offeringId: offering.id,
            quote:
              'Clearly fictional local demo content for layout testing only.',
            attribution: 'Demo record — not a real student',
            status: 'PUBLISHED',
            publishedAt: now,
          },
        });
    }
  }

  if (demoCountry) {
    const location = await prisma.consultantLocation.upsert({
      where: { slug: 'demo-city' },
      update: {
        countryId: demoCountry.id,
        name: 'Demo City',
        city: 'Demo City',
        cityId: demoCity?.id,
        stateId: demoState?.id,
        overview: 'Fictional local location fixture.',
        status: 'ACTIVE',
        deletedAt: null,
      },
      create: {
        countryId: demoCountry.id,
        name: 'Demo City',
        slug: 'demo-city',
        city: 'Demo City',
        cityId: demoCity?.id,
        stateId: demoState?.id,
        overview: 'Fictional local location fixture.',
        status: 'ACTIVE',
      },
    });
    const consultant = await prisma.consultant.upsert({
      where: { slug: 'universta-demo-guidance' },
      update: {
        name: 'Universta Demo Guidance',
        shortDescription: 'Clearly fictional local consultant fixture.',
        description:
          'This local record is not a real consultancy or endorsement.',
        email: 'demo-consultant@example.test',
        phone: '+10000000000',
        verificationStatus: 'UNVERIFIED',
        sourceReference: 'https://example.com/universta/local-demo/consultants',
        status: 'PUBLISHED',
        publishedAt: now,
        deletedAt: null,
      },
      create: {
        name: 'Universta Demo Guidance',
        slug: 'universta-demo-guidance',
        shortDescription: 'Clearly fictional local consultant fixture.',
        description:
          'This local record is not a real consultancy or endorsement.',
        email: 'demo-consultant@example.test',
        phone: '+10000000000',
        verificationStatus: 'UNVERIFIED',
        sourceReference: 'https://example.com/universta/local-demo/consultants',
        status: 'PUBLISHED',
        publishedAt: now,
      },
    });
    await prisma.consultantLocationMap.upsert({
      where: {
        consultantId_locationId: {
          consultantId: consultant.id,
          locationId: location.id,
        },
      },
      update: { address: 'Fictional local address' },
      create: {
        consultantId: consultant.id,
        locationId: location.id,
        address: 'Fictional local address',
      },
    });
    await prisma.consultantCountry.upsert({
      where: {
        consultantId_countryId: {
          consultantId: consultant.id,
          countryId: demoCountry.id,
        },
      },
      update: {},
      create: { consultantId: consultant.id, countryId: demoCountry.id },
    });
    const service = await prisma.consultantService.findFirst({
      where: { consultantId: consultant.id, slug: 'course-guidance' },
    });
    if (service)
      await prisma.consultantService.update({
        where: { id: service.id },
        data: { name: 'Course guidance' },
      });
    else
      await prisma.consultantService.create({
        data: {
          consultantId: consultant.id,
          name: 'Course guidance',
          slug: 'course-guidance',
        },
      });
    const language = await prisma.consultantLanguage.findFirst({
      where: { consultantId: consultant.id, name: 'English' },
    });
    if (!language)
      await prisma.consultantLanguage.create({
        data: { consultantId: consultant.id, name: 'English', code: 'en' },
      });
  }

  await prisma.job.upsert({
    where: { slug: 'local-demo-content-coordinator' },
    update: {
      title: 'Local demo content coordinator',
      summary: 'Clearly fictional local job listing fixture.',
      description: 'This is a local development record only.',
      department: 'Demonstration',
      employmentType: 'FULL_TIME',
      location: 'Demo City',
      cityId: demoCity?.id,
      stateId: demoState?.id,
      countryId: demoCountry?.id,
      remoteStatus: 'HYBRID',
      applicationUrl: 'https://example.com/universta/local-demo/jobs/apply',
      publishedDate: new Date('2026-07-01'),
      expiryDate: new Date('2027-01-01'),
      status: 'PUBLISHED',
      publishedAt: now,
      deletedAt: null,
    },
    create: {
      title: 'Local demo content coordinator',
      slug: 'local-demo-content-coordinator',
      summary: 'Clearly fictional local job listing fixture.',
      description: 'This is a local development record only.',
      department: 'Demonstration',
      employmentType: 'FULL_TIME',
      location: 'Demo City',
      cityId: demoCity?.id,
      stateId: demoState?.id,
      countryId: demoCountry?.id,
      remoteStatus: 'HYBRID',
      applicationUrl: 'https://example.com/universta/local-demo/jobs/apply',
      publishedDate: new Date('2026-07-01'),
      expiryDate: new Date('2027-01-01'),
      status: 'PUBLISHED',
      publishedAt: now,
    },
  });
  await prisma.event.upsert({
    where: { slug: 'local-demo-study-options-session' },
    update: {
      title: 'Local demo study options session',
      summary: 'Clearly fictional local event fixture.',
      description: 'This local event record is for interface testing only.',
      startsAt: new Date('2026-12-10T10:00:00.000Z'),
      endsAt: new Date('2026-12-10T11:00:00.000Z'),
      timezone: 'Asia/Kolkata',
      eventType: 'ONLINE',
      onlineUrl: 'https://example.com/universta/local-demo/events/session',
      registrationUrl:
        'https://example.com/universta/local-demo/events/register',
      status: 'PUBLISHED',
      publishedAt: now,
      deletedAt: null,
    },
    create: {
      title: 'Local demo study options session',
      slug: 'local-demo-study-options-session',
      summary: 'Clearly fictional local event fixture.',
      description: 'This local event record is for interface testing only.',
      startsAt: new Date('2026-12-10T10:00:00.000Z'),
      endsAt: new Date('2026-12-10T11:00:00.000Z'),
      timezone: 'Asia/Kolkata',
      eventType: 'ONLINE',
      onlineUrl: 'https://example.com/universta/local-demo/events/session',
      registrationUrl:
        'https://example.com/universta/local-demo/events/register',
      status: 'PUBLISHED',
      publishedAt: now,
    },
  });

  // Additional fictional fixtures make every expanded Phase 1 listing, filter and
  // three-item comparison useful in local development. Every slug below is owned
  // by this seed, so reruns update the fixture rather than create duplicates.
  const demoCountries = await prisma.country.findMany({
    where: { status: 'PUBLISHED', deletedAt: null },
    orderBy: { displayOrder: 'asc' },
    take: 3,
  });
  const demoCourses = await prisma.course.findMany({
    where: { status: 'PUBLISHED', deletedAt: null },
    orderBy: { displayOrder: 'asc' },
    take: 7,
  });
  const demoLevels = await prisma.courseLevel.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { educationOrder: 'asc' },
  });
  if (demoCountries.length >= 2 && demoCourses.length >= 1) {
    const universitySpecs = [
      [
        'lakeside-demo-university',
        'Lakeside Demo University',
        1,
        'Demo Harbour Campus',
      ],
      [
        'ember-demo-institute',
        'Ember Demo Institute',
        2,
        'Demo Innovation Campus',
      ],
    ] as const;
    const universities = [];
    for (const [slug, name, countryIndex, campusName] of universitySpecs) {
      const country = demoCountries[countryIndex] ?? demoCountries[0];
      const university = await prisma.university.upsert({
        where: { slug },
        update: {
          countryId: country.id,
          name,
          institutionType: 'DEMONSTRATION',
          shortDescription: `Clearly fictional ${name} fixture for local filtering and comparison.`,
          overview: `${name} is fictional demo content and must never be presented as a real institution.`,
          sourceReference: `https://example.test/universta/demo/${slug}`,
          status: 'PUBLISHED',
          publishedAt: now,
          deletedAt: null,
        },
        create: {
          countryId: country.id,
          name,
          slug,
          institutionType: 'DEMONSTRATION',
          shortDescription: `Clearly fictional ${name} fixture for local filtering and comparison.`,
          overview: `${name} is fictional demo content and must never be presented as a real institution.`,
          sourceReference: `https://example.test/universta/demo/${slug}`,
          status: 'PUBLISHED',
          publishedAt: now,
        },
      });
      // Structured cityId/stateId only apply when this university's country
      // matches demoState/demoCity's owning country (demoCountry) -- the two
      // are independent lookups (demoCountries[] vs. demoCountry) and are not
      // guaranteed to resolve to the same country.
      const inDemoCountry = demoCountry ? country.id === demoCountry.id : false;
      const campusCity = campusName.includes('Harbour')
        ? demoCityHarbour
        : demoCity;
      const campus = await prisma.universityCampus.upsert({
        where: {
          universityId_slug: {
            universityId: university.id,
            slug: `${slug}-campus`,
          },
        },
        update: {
          name: campusName,
          city: 'Demo City',
          cityId: inDemoCountry ? campusCity?.id : null,
          stateId: inDemoCountry ? demoState?.id : null,
          overview: 'Fictional demo campus.',
          status: 'ACTIVE',
          deletedAt: null,
        },
        create: {
          universityId: university.id,
          name: campusName,
          slug: `${slug}-campus`,
          city: 'Demo City',
          cityId: inDemoCountry ? campusCity?.id : undefined,
          stateId: inDemoCountry ? demoState?.id : undefined,
          overview: 'Fictional demo campus.',
          status: 'ACTIVE',
        },
      });
      universities.push({ university, campus });
    }
    const northstar = await prisma.university.findUniqueOrThrow({
      where: { slug: 'northstar-demonstration-university' },
    });
    const northstarCampus = await prisma.universityCampus.findFirstOrThrow({
      where: { universityId: northstar.id, deletedAt: null },
    });
    await prisma.universityCampus.upsert({
      where: {
        universityId_slug: {
          universityId: northstar.id,
          slug: 'northstar-demo-research-campus',
        },
      },
      update: {
        name: 'Northstar Demo Research Campus',
        city: 'Demo City',
        cityId: demoCity?.id,
        stateId: demoState?.id,
        overview: 'Fictional additional local demo campus.',
        status: 'ACTIVE',
        deletedAt: null,
      },
      create: {
        universityId: northstar.id,
        name: 'Northstar Demo Research Campus',
        slug: 'northstar-demo-research-campus',
        city: 'Demo City',
        cityId: demoCity?.id,
        stateId: demoState?.id,
        overview: 'Fictional additional local demo campus.',
        status: 'ACTIVE',
      },
    });
    const offeringTargets = [
      {
        university: northstar,
        campus: northstarCampus,
        slug: 'northstar-demo-data-analytics',
        name: 'Demo Data Analytics at Northstar',
        course: demoCourses[0],
        mode: 'FULL_TIME',
      },
      {
        university: northstar,
        campus: northstarCampus,
        slug: 'northstar-demo-business-insights',
        name: 'Demo Business Insights at Northstar',
        course: demoCourses[1] ?? demoCourses[0],
        mode: 'PART_TIME',
      },
      {
        university: universities[0].university,
        campus: universities[0].campus,
        slug: 'lakeside-demo-digital-design',
        name: 'Demo Digital Design at Lakeside',
        course: demoCourses[2] ?? demoCourses[0],
        mode: 'FULL_TIME',
      },
      {
        university: universities[0].university,
        campus: universities[0].campus,
        slug: 'lakeside-demo-software-systems',
        name: 'Demo Software Systems at Lakeside',
        course: demoCourses[3] ?? demoCourses[0],
        mode: 'ONLINE',
      },
      {
        university: universities[0].university,
        campus: universities[0].campus,
        slug: 'lakeside-demo-health-innovation',
        name: 'Demo Health Innovation at Lakeside',
        course: demoCourses[4] ?? demoCourses[0],
        mode: 'FULL_TIME',
      },
      {
        university: universities[1].university,
        campus: universities[1].campus,
        slug: 'ember-demo-sustainable-business',
        name: 'Demo Sustainable Business at Ember',
        course: demoCourses[5] ?? demoCourses[0],
        mode: 'PART_TIME',
      },
      {
        university: universities[1].university,
        campus: universities[1].campus,
        slug: 'ember-demo-creative-technology',
        name: 'Demo Creative Technology at Ember',
        course: demoCourses[6] ?? demoCourses[0],
        mode: 'FULL_TIME',
      },
    ];
    const expandedOfferings = [];
    for (const [index, target] of offeringTargets.entries()) {
      const level =
        demoLevels[index % Math.max(demoLevels.length, 1)] ?? demoLevel;
      const offering = await prisma.universityCourseOffering.upsert({
        where: { slug: target.slug },
        update: {
          universityId: target.university.id,
          campusId: target.campus.id,
          genericCourseId: target.course.id,
          name: target.name,
          shortDescription:
            'Clearly fictional local university course offering for filters and comparison.',
          overview:
            'Fictional demo content; not a real programme or tuition claim.',
          courseLevelId: level?.id ?? null,
          studyMode: target.mode,
          durationMin: new Prisma.Decimal(index % 2 ? '1' : '2'),
          durationMax: new Prisma.Decimal(index % 2 ? '1.5' : '2'),
          durationUnit: 'YEARS',
          tuitionMin: new Prisma.Decimal(String(18000 + index * 1500)),
          tuitionMax: new Prisma.Decimal(String(21000 + index * 1500)),
          currencyCode: index % 2 ? 'AUD' : 'CAD',
          tuitionPeriod: 'PER_YEAR',
          applicationUrl: `https://example.test/universta/demo/${target.slug}/apply`,
          sourceReference: `https://example.test/universta/demo/${target.slug}`,
          status: index === 6 ? 'DRAFT' : 'PUBLISHED',
          publishedAt: index === 6 ? null : now,
          deletedAt: null,
        },
        create: {
          universityId: target.university.id,
          campusId: target.campus.id,
          genericCourseId: target.course.id,
          name: target.name,
          slug: target.slug,
          shortDescription:
            'Clearly fictional local university course offering for filters and comparison.',
          overview:
            'Fictional demo content; not a real programme or tuition claim.',
          courseLevelId: level?.id ?? null,
          studyMode: target.mode,
          durationMin: new Prisma.Decimal(index % 2 ? '1' : '2'),
          durationMax: new Prisma.Decimal(index % 2 ? '1.5' : '2'),
          durationUnit: 'YEARS',
          tuitionMin: new Prisma.Decimal(String(18000 + index * 1500)),
          tuitionMax: new Prisma.Decimal(String(21000 + index * 1500)),
          currencyCode: index % 2 ? 'AUD' : 'CAD',
          tuitionPeriod: 'PER_YEAR',
          applicationUrl: `https://example.test/universta/demo/${target.slug}/apply`,
          sourceReference: `https://example.test/universta/demo/${target.slug}`,
          status: index === 6 ? 'DRAFT' : 'PUBLISHED',
          publishedAt: index === 6 ? null : now,
        },
      });
      expandedOfferings.push(offering);
      for (const intake of intakeRows.slice(0, 2))
        await prisma.universityCourseIntake.upsert({
          where: {
            offeringId_intakeId: {
              offeringId: offering.id,
              intakeId: intake.id,
            },
          },
          update: {
            deadline: new Date(
              `2026-${String(9 + (index % 3)).padStart(2, '0')}-15`,
            ),
            status: 'ACTIVE',
          },
          create: {
            offeringId: offering.id,
            intakeId: intake.id,
            deadline: new Date(
              `2026-${String(9 + (index % 3)).padStart(2, '0')}-15`,
            ),
            status: 'ACTIVE',
          },
        });
      const requirement = await prisma.universityCourseRequirement.findFirst({
        where: {
          offeringId: offering.id,
          title: 'Fictional academic requirement',
        },
      });
      const requirementData = {
        category: index % 2 ? 'ENGLISH_TEST' : 'ACADEMIC',
        title: 'Fictional academic requirement',
        description: 'Fictional local requirement for interface testing only.',
        minimumScore: new Prisma.Decimal('6.5'),
        status: 'ACTIVE',
        displayOrder: 1,
        deletedAt: null,
      };
      if (requirement)
        await prisma.universityCourseRequirement.update({
          where: { id: requirement.id },
          data: requirementData,
        });
      else
        await prisma.universityCourseRequirement.create({
          data: { offeringId: offering.id, ...requirementData },
        });
    }
    const provider = await prisma.scholarshipProvider.upsert({
      where: { slug: 'universta-demo-provider' },
      update: {
        name: 'Universta Demo Provider',
        status: 'ACTIVE',
        deletedAt: null,
      },
      create: {
        name: 'Universta Demo Provider',
        slug: 'universta-demo-provider',
        websiteUrl: 'https://example.test/universta/demo/provider',
        status: 'ACTIVE',
      },
    });
    const scholarshipSpecs = [
      'lakeside-demo-scholarship',
      'ember-demo-scholarship',
      'demo-access-grant',
      'demo-draft-scholarship',
    ];
    for (const [index, slug] of scholarshipSpecs.entries()) {
      const targetUniversity =
        index < 2 ? universities[index].university : northstar;
      const targetOffering = expandedOfferings[index] ?? expandedOfferings[0];
      const status = index === 3 ? 'DRAFT' : 'PUBLISHED';
      const scholarship = await prisma.scholarship.upsert({
        where: { slug },
        update: {
          providerId: provider.id,
          title: `Fictional ${slug.replaceAll('-', ' ')}`,
          summary: 'Fictional demo scholarship; no real award or endorsement.',
          description:
            'Fictional demo content for local relationship, filtering and detail testing.',
          benefitType: index % 2 ? 'TUITION_REDUCTION' : 'FIXED_GRANT',
          amount: new Prisma.Decimal(String(1000 + index * 500)),
          currencyCode: 'CAD',
          eligibility: 'Fictional local eligibility text.',
          deadline: new Date(`2026-12-${10 + index}`),
          applicationUrl: `https://example.test/universta/demo/${slug}`,
          sourceReference: `https://example.test/universta/demo/${slug}`,
          status,
          publishedAt: status === 'PUBLISHED' ? now : null,
          deletedAt: null,
        },
        create: {
          providerId: provider.id,
          title: `Fictional ${slug.replaceAll('-', ' ')}`,
          slug,
          summary: 'Fictional demo scholarship; no real award or endorsement.',
          description:
            'Fictional demo content for local relationship, filtering and detail testing.',
          benefitType: index % 2 ? 'TUITION_REDUCTION' : 'FIXED_GRANT',
          amount: new Prisma.Decimal(String(1000 + index * 500)),
          currencyCode: 'CAD',
          eligibility: 'Fictional local eligibility text.',
          deadline: new Date(`2026-12-${10 + index}`),
          applicationUrl: `https://example.test/universta/demo/${slug}`,
          sourceReference: `https://example.test/universta/demo/${slug}`,
          status,
          publishedAt: status === 'PUBLISHED' ? now : null,
        },
      });
      const country = demoCountries[index % demoCountries.length];
      await prisma.scholarshipCountry.upsert({
        where: {
          scholarshipId_countryId: {
            scholarshipId: scholarship.id,
            countryId: country.id,
          },
        },
        update: {},
        create: { scholarshipId: scholarship.id, countryId: country.id },
      });
      await prisma.scholarshipUniversity.upsert({
        where: {
          scholarshipId_universityId: {
            scholarshipId: scholarship.id,
            universityId: targetUniversity.id,
          },
        },
        update: {},
        create: {
          scholarshipId: scholarship.id,
          universityId: targetUniversity.id,
        },
      });
      await prisma.scholarshipUniversityCourseOffering.upsert({
        where: {
          scholarshipId_offeringId: {
            scholarshipId: scholarship.id,
            offeringId: targetOffering.id,
          },
        },
        update: {},
        create: {
          scholarshipId: scholarship.id,
          offeringId: targetOffering.id,
        },
      });
    }
    const locationSpecs = [
      ['demo-harbour', 'Demo Harbour', 0],
      ['demo-innovation-district', 'Demo Innovation District', 1],
    ] as const;
    const locations = [];
    for (const [slug, name, countryIndex] of locationSpecs) {
      const locationCountry = demoCountries[countryIndex];
      const inDemoCountry = demoCountry
        ? locationCountry.id === demoCountry.id
        : false;
      const locationCity = slug === 'demo-harbour' ? demoCityHarbour : demoCity;
      locations.push(
        await prisma.consultantLocation.upsert({
          where: { slug },
          update: {
            countryId: locationCountry.id,
            name,
            city: name,
            cityId: inDemoCountry ? locationCity?.id : null,
            stateId: inDemoCountry ? demoState?.id : null,
            overview: 'Fictional demo consultant location.',
            status: 'ACTIVE',
            deletedAt: null,
          },
          create: {
            countryId: locationCountry.id,
            name,
            slug,
            city: name,
            cityId: inDemoCountry ? locationCity?.id : undefined,
            stateId: inDemoCountry ? demoState?.id : undefined,
            overview: 'Fictional demo consultant location.',
            status: 'ACTIVE',
          },
        }),
      );
    }
    const consultantSpecs = [
      'lakeside-demo-consultant',
      'ember-demo-consultant',
      'demo-draft-consultant',
    ];
    for (const [index, slug] of consultantSpecs.entries()) {
      const status = index === 2 ? 'DRAFT' : 'PUBLISHED';
      const consultant = await prisma.consultant.upsert({
        where: { slug },
        update: {
          name: `Demo Consultant ${index + 2}`,
          shortDescription: 'Clearly fictional demo consultant fixture.',
          description:
            'Fictional demo content; no real credentials or endorsements.',
          email: `demo-consultant-${index + 2}@example.test`,
          phone: '+10000000000',
          verificationStatus: 'UNVERIFIED',
          sourceReference: `https://example.test/universta/demo/${slug}`,
          status,
          publishedAt: status === 'PUBLISHED' ? now : null,
          deletedAt: null,
        },
        create: {
          name: `Demo Consultant ${index + 2}`,
          slug,
          shortDescription: 'Clearly fictional demo consultant fixture.',
          description:
            'Fictional demo content; no real credentials or endorsements.',
          email: `demo-consultant-${index + 2}@example.test`,
          phone: '+10000000000',
          verificationStatus: 'UNVERIFIED',
          sourceReference: `https://example.test/universta/demo/${slug}`,
          status,
          publishedAt: status === 'PUBLISHED' ? now : null,
        },
      });
      const location = locations[index % locations.length];
      const country = demoCountries[index % demoCountries.length];
      await prisma.consultantLocationMap.upsert({
        where: {
          consultantId_locationId: {
            consultantId: consultant.id,
            locationId: location.id,
          },
        },
        update: { address: 'Fictional demo address' },
        create: {
          consultantId: consultant.id,
          locationId: location.id,
          address: 'Fictional demo address',
        },
      });
      await prisma.consultantCountry.upsert({
        where: {
          consultantId_countryId: {
            consultantId: consultant.id,
            countryId: country.id,
          },
        },
        update: {},
        create: { consultantId: consultant.id, countryId: country.id },
      });
      for (const [name, slugValue] of [
        ['Course guidance', 'course-guidance'],
        ['Visa planning', 'visa-planning'],
      ].slice(0, index + 1)) {
        const existing = await prisma.consultantService.findFirst({
          where: { consultantId: consultant.id, slug: slugValue },
        });
        if (existing)
          await prisma.consultantService.update({
            where: { id: existing.id },
            data: { name },
          });
        else
          await prisma.consultantService.create({
            data: { consultantId: consultant.id, name, slug: slugValue },
          });
      }
      for (const [name, code] of [
        ['English', 'en'],
        ['Hindi', 'hi'],
      ].slice(0, index + 1)) {
        const existing = await prisma.consultantLanguage.findFirst({
          where: { consultantId: consultant.id, name },
        });
        if (!existing)
          await prisma.consultantLanguage.create({
            data: { consultantId: consultant.id, name, code },
          });
      }
    }
    for (const [index, slug] of [
      'local-demo-student-support',
      'local-demo-expired-role',
    ].entries()) {
      const expired = index === 1;
      await prisma.job.upsert({
        where: { slug },
        update: {
          title: expired
            ? 'Fictional expired demo role'
            : 'Fictional demo student support role',
          summary: 'Clearly fictional local job fixture.',
          description: 'Fictional demo content only.',
          department: 'Demonstration',
          employmentType: 'FULL_TIME',
          location: 'Demo City',
          cityId: demoCity?.id,
          stateId: demoState?.id,
          countryId: demoCountry?.id,
          remoteStatus: 'HYBRID',
          expiryDate: expired ? new Date('2025-01-01') : new Date('2027-01-01'),
          applicationUrl: `https://example.test/universta/demo/${slug}`,
          status: 'PUBLISHED',
          publishedAt: now,
          deletedAt: null,
        },
        create: {
          title: expired
            ? 'Fictional expired demo role'
            : 'Fictional demo student support role',
          slug,
          summary: 'Clearly fictional local job fixture.',
          description: 'Fictional demo content only.',
          department: 'Demonstration',
          employmentType: 'FULL_TIME',
          location: 'Demo City',
          cityId: demoCity?.id,
          stateId: demoState?.id,
          countryId: demoCountry?.id,
          remoteStatus: 'HYBRID',
          expiryDate: expired ? new Date('2025-01-01') : new Date('2027-01-01'),
          applicationUrl: `https://example.test/universta/demo/${slug}`,
          status: 'PUBLISHED',
          publishedAt: now,
        },
      });
    }
    for (const [index, slug] of [
      'local-demo-campus-session',
      'local-demo-past-session',
      'local-demo-adviser-workshop',
    ].entries()) {
      const past = index === 1;
      await prisma.event.upsert({
        where: { slug },
        update: {
          title: `Fictional demo event ${index + 2}`,
          summary: 'Clearly fictional local event fixture.',
          description: 'Fictional demo content for event states.',
          startsAt: past
            ? new Date('2025-06-10T10:00:00.000Z')
            : new Date(`2026-1${index}-10T10:00:00.000Z`),
          endsAt: past
            ? new Date('2025-06-10T11:00:00.000Z')
            : new Date(`2026-1${index}-10T11:00:00.000Z`),
          timezone: 'Asia/Kolkata',
          eventType: index === 0 ? 'OFFLINE' : 'ONLINE',
          venue: index === 0 ? 'Fictional Demo Venue' : null,
          cityId: index === 0 ? demoCity?.id : null,
          stateId: index === 0 ? demoState?.id : null,
          countryId: index === 0 ? demoCountry?.id : null,
          onlineUrl:
            index === 0 ? null : `https://example.test/universta/demo/${slug}`,
          registrationUrl: `https://example.test/universta/demo/${slug}/register`,
          status: 'PUBLISHED',
          publishedAt: now,
          deletedAt: null,
        },
        create: {
          title: `Fictional demo event ${index + 2}`,
          slug,
          summary: 'Clearly fictional local event fixture.',
          description: 'Fictional demo content for event states.',
          startsAt: past
            ? new Date('2025-06-10T10:00:00.000Z')
            : new Date(`2026-1${index}-10T10:00:00.000Z`),
          endsAt: past
            ? new Date('2025-06-10T11:00:00.000Z')
            : new Date(`2026-1${index}-10T11:00:00.000Z`),
          timezone: 'Asia/Kolkata',
          eventType: index === 0 ? 'OFFLINE' : 'ONLINE',
          venue: index === 0 ? 'Fictional Demo Venue' : null,
          cityId: index === 0 ? demoCity?.id : undefined,
          stateId: index === 0 ? demoState?.id : undefined,
          countryId: index === 0 ? demoCountry?.id : undefined,
          onlineUrl:
            index === 0 ? null : `https://example.test/universta/demo/${slug}`,
          registrationUrl: `https://example.test/universta/demo/${slug}/register`,
          status: 'PUBLISHED',
          publishedAt: now,
        },
      });
    }
    for (const [index, slug] of [
      'local-demo-story-lakeside',
      'local-demo-story-ember',
    ].entries()) {
      const university = universities[index].university;
      const offering = expandedOfferings[index + 2];
      await prisma.successStory.upsert({
        where: { slug },
        update: {
          countryId: university.countryId,
          universityId: university.id,
          offeringId: offering.id,
          title: `Fictional demo study journey ${index + 2}`,
          journey:
            'Fictional demo content. It does not represent a real student or outcome.',
          attribution: 'Fictional demo student — not a real person',
          status: 'PUBLISHED',
          publishedAt: now,
          deletedAt: null,
        },
        create: {
          countryId: university.countryId,
          universityId: university.id,
          offeringId: offering.id,
          title: `Fictional demo study journey ${index + 2}`,
          slug,
          journey:
            'Fictional demo content. It does not represent a real student or outcome.',
          attribution: 'Fictional demo student — not a real person',
          status: 'PUBLISHED',
          publishedAt: now,
        },
      });
    }
    for (const [index, attribution] of [
      'Fictional demo testimonial 2',
      'Fictional demo testimonial 3',
      'Fictional demo testimonial 4',
      'Fictional demo testimonial 5',
    ].entries()) {
      const existing = await prisma.testimonial.findFirst({
        where: { attribution },
      });
      const data = {
        universityId: universities[index % universities.length].university.id,
        offeringId: expandedOfferings[index].id,
        quote:
          'Fictional demo testimonial for local layout and relationship testing only.',
        attribution,
        attributionNote: 'Not a real testimonial.',
        status: 'PUBLISHED',
        publishedAt: now,
        displayOrder: index + 2,
        deletedAt: null,
      };
      if (existing)
        await prisma.testimonial.update({ where: { id: existing.id }, data });
      else await prisma.testimonial.create({ data });
    }
  }

  const editorialPages = [
    [
      'home',
      'HOME',
      'Home',
      'Explore local published study-abroad information without invented claims.',
      'Start with countries, subjects, generic courses, university offerings and scholarships.',
    ],
    [
      'about',
      'EDITORIAL',
      'About Universta',
      'A local Phase 1 study-abroad information experience.',
      'This local page is managed through the Page and PageSection foundation.',
    ],
    [
      'faq',
      'FAQ',
      'Frequently asked questions',
      'Answers about using the local Universta catalog.',
      'Information is source-aware and should be verified with official providers.',
    ],
  ] as const;
  for (const [
    slug,
    pageType,
    title,
    shortDescription,
    text,
  ] of editorialPages) {
    const page = await prisma.page.upsert({
      where: { slug },
      update: {
        pageType,
        title,
        shortDescription,
        status: 'PUBLISHED',
        isHomepage: slug === 'home',
        publishedAt: now,
        deletedAt: null,
        updatedByUserId: admin.id,
      },
      create: {
        pageType,
        title,
        slug,
        shortDescription,
        status: 'PUBLISHED',
        isHomepage: slug === 'home',
        publishedAt: now,
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
      },
    });
    await prisma.pageSection.upsert({
      where: { pageId_sectionKey: { pageId: page.id, sectionKey: 'intro' } },
      update: {
        heading: title,
        subheading: text,
        status: 'ACTIVE',
        deletedAt: null,
      },
      create: {
        pageId: page.id,
        sectionKey: 'intro',
        sectionType: 'RICH_TEXT',
        heading: title,
        subheading: text,
        status: 'ACTIVE',
      },
    });
  }
  const menu = await prisma.navigationMenu.upsert({
    where: { menuKey: 'primary' },
    update: {
      name: 'Primary navigation',
      location: 'HEADER',
      status: 'ACTIVE',
    },
    create: {
      name: 'Primary navigation',
      menuKey: 'primary',
      location: 'HEADER',
      status: 'ACTIVE',
    },
  });
  for (const [order, label, customUrl] of [
    ['Countries', '/countries'],
    ['Universities', '/universities'],
    ['Scholarships', '/scholarships'],
    ['Consultants', '/study-abroad-consultants'],
    ['Counselling', '/counselling'],
  ].map(([label, url], index) => [index + 1, label, url] as const)) {
    const existingItem = await prisma.navigationItem.findFirst({
      where: { menuId: menu.id, label },
    });
    const data = {
      linkType: 'CUSTOM',
      customUrl,
      displayOrder: order,
      status: 'ACTIVE',
    };
    if (existingItem)
      await prisma.navigationItem.update({
        where: { id: existingItem.id },
        data,
      });
    else
      await prisma.navigationItem.create({
        data: { menuId: menu.id, label, ...data },
      });
  }

  const featureFlags = [
    ['PUBLIC_LOGIN', 'Public login', false],
    ['COMPARE_COUNTRIES', 'Compare countries', false],
    ['MATCHING_TOOL', 'Matching tool', false],
    ['CONSULTANT_DIRECTORY', 'Consultant directory', true],
    ['STUDENT_ACCOUNT', 'Student account', false],
  ] as const;
  for (const [flagKey, name, isEnabled] of featureFlags) {
    await prisma.featureFlag.upsert({
      where: { flagKey },
      update: { name, isEnabled, environment: 'ALL' },
      create: { flagKey, name, isEnabled, environment: 'ALL' },
    });
  }

  const settings = [
    ['site.name', 'branding', 'STRING', 'Universta', true],
    ['site.default_locale', 'localization', 'STRING', 'en-IN', true],
    ['site.timezone', 'localization', 'STRING', 'Asia/Kolkata', true],
    ['site.contact_email', 'contact', 'STRING', '', false],
  ] as const;
  for (const [
    settingKey,
    settingGroup,
    valueType,
    value,
    isPublic,
  ] of settings) {
    await prisma.siteSetting.upsert({
      where: { settingKey },
      update: {
        settingGroup,
        valueType,
        valueJson: value,
        isPublic,
        updatedByUserId: admin.id,
      },
      create: {
        settingKey,
        settingGroup,
        valueType,
        valueJson: value,
        isPublic,
        updatedByUserId: admin.id,
      },
    });
  }

  const metrics = [
    ['countries_count', 'Countries', '—'],
    ['universities_count', 'Universities', '—'],
    ['courses_count', 'Courses', '—'],
  ] as const;
  for (const [metricKey, label, displayValue] of metrics) {
    await prisma.platformMetric.upsert({
      where: { metricKey },
      update: {
        label,
        displayValue,
        numericValue: null,
        verifiedAt: null,
        sourceReference: null,
        isVisible: true,
      },
      create: {
        metricKey,
        label,
        displayValue,
        numericValue: null,
        verifiedAt: null,
        sourceReference: null,
        isVisible: true,
      },
    });
  }

  console.log(`Seeded demo catalog data for ${admin.email}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
