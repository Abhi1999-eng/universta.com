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
