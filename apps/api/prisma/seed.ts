import "dotenv/config";
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";

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
  return `scrypt$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

function databaseConfig() {
  const url = new URL(required("DATABASE_URL"));
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
  };
}

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(databaseConfig()) });

async function main() {
  const now = new Date();
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? process.env.SUPER_ADMIN_EMAIL ?? "admin@universta.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD
    ? required("SEED_ADMIN_PASSWORD")
    : required("SUPER_ADMIN_PASSWORD");

  const role = await prisma.role.upsert({
    where: { code: "SUPER_ADMIN" },
    update: { name: "Super Admin", description: "Local foundation administrator", isSystemRole: true, status: "ACTIVE" },
    create: {
      code: "SUPER_ADMIN",
      name: "Super Admin",
      description: "Local foundation administrator",
      isSystemRole: true,
      status: "ACTIVE",
    },
  });

  const passwordHash = hashPassword(adminPassword);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      firstName: process.env.SUPER_ADMIN_FIRST_NAME ?? "Local",
      lastName: process.env.SUPER_ADMIN_LAST_NAME ?? "Super Admin",
      status: "ACTIVE",
      passwordChangedAt: now,
    },
    create: {
      email: adminEmail,
      passwordHash,
      firstName: process.env.SUPER_ADMIN_FIRST_NAME ?? "Local",
      lastName: process.env.SUPER_ADMIN_LAST_NAME ?? "Super Admin",
      status: "ACTIVE",
      passwordChangedAt: now,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: role.id } },
    update: { assignedByUserId: admin.id, assignedAt: now },
    create: { userId: admin.id, roleId: role.id, assignedByUserId: admin.id, assignedAt: now },
  });

  const continents = [
    ["Europe", "europe", "EU"],
    ["North America", "north-america", "NA"],
    ["Asia", "asia", "AS"],
    ["Australia & New Zealand", "australia-new-zealand", "ANZ"],
    ["Middle East", "middle-east", "ME"],
    ["Africa", "africa", "AF"],
    ["South America", "south-america", "SA"],
  ] as const;
  for (const [name, slug, code] of continents) {
    await prisma.continent.upsert({
      where: { slug },
      update: { name, code, status: "ACTIVE", updatedByUserId: admin.id },
      create: { name, slug, code, status: "ACTIVE", createdByUserId: admin.id, updatedByUserId: admin.id },
    });
  }

  const intakes = [
    ["January", "january", 1, "WINTER", "Jan"],
    ["May", "may", 5, "SPRING", "May"],
    ["September", "september", 9, "FALL", "Sep"],
  ] as const;
  for (const [name, slug, monthNumber, seasonName, shortLabel] of intakes) {
    await prisma.intake.upsert({
      where: { slug },
      update: { name, monthNumber, seasonName, shortLabel, status: "ACTIVE" },
      create: { name, slug, monthNumber, seasonName, shortLabel, status: "ACTIVE" },
    });
  }

  const northAmerica = await prisma.continent.findUnique({ where: { slug: "north-america" } });
  if (northAmerica) {
    let canada = await prisma.country.findUnique({ where: { slug: "canada" } });
    if (!canada) {
      canada = await prisma.country.create({
        data: {
          continentId: northAmerica.id,
          name: "Canada",
          slug: "canada",
          iso2Code: "CA",
          iso3Code: "CAN",
          pageHeading: "Study in Canada",
          shortDescription: "Foundation country record for structured profile development.",
          status: "PUBLISHED",
          publishedAt: now,
          createdByUserId: admin.id,
          updatedByUserId: admin.id,
        },
      });
    }
    const sourceReference = "https://example.com/universta/seed/canada-profile";
    await prisma.countryCostProfile.upsert({
      where: { countryId: canada.id },
      update: {},
      create: {
        countryId: canada.id,
        currencyCode: "CAD",
        currencySymbol: "$",
        tuitionMin: new Prisma.Decimal("18000.00"),
        tuitionMax: new Prisma.Decimal("42000.00"),
        tuitionPeriod: "PER_YEAR",
        livingCostMin: new Prisma.Decimal("1200.00"),
        livingCostMax: new Prisma.Decimal("2200.00"),
        livingCostPeriod: "PER_MONTH",
        budgetBand: "MID_RANGE",
        applicableYear: now.getUTCFullYear(),
        sourceReference,
        disclaimer: "Fictional local foundation data for development and testing.",
        verifiedAt: now,
      },
    });
    await prisma.countryWorkProfile.upsert({
      where: { countryId: canada.id },
      update: {},
      create: {
        countryId: canada.id,
        partTimeAllowed: true,
        partTimeHoursPerWeek: new Prisma.Decimal("20.00"),
        postStudyWorkAvailable: true,
        postStudyWorkMinMonths: 12,
        postStudyWorkMaxMonths: 36,
        immigrationPathwayStrength: "MODERATE",
        visaSuccessBand: "MEDIUM",
        visaInformation: "Fictional local foundation data for development and testing.",
        sourceReference,
        disclaimer: "Fictional local foundation data for development and testing.",
        verifiedAt: now,
      },
    });
    await prisma.countryLanguageRequirement.upsert({
      where: { countryId: canada.id },
      update: {},
      create: {
        countryId: canada.id,
        ieltsRequirement: "OPTIONAL",
        ieltsMinScore: new Prisma.Decimal("6.5"),
        pteRequirement: "OPTIONAL",
        pteMinScore: new Prisma.Decimal("60.00"),
        toeflRequirement: "OPTIONAL",
        toeflMinScore: new Prisma.Decimal("88.00"),
        languageWaiverAvailable: true,
        sourceReference,
        disclaimer: "Fictional local foundation data for development and testing.",
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
        sourceMode: "MANUAL",
        sourceReference,
        verifiedAt: now,
      },
    });
    for (const [slug, isMajor] of [["january", false], ["may", false], ["september", true]] as const) {
      const intake = await prisma.intake.findUnique({ where: { slug } });
      if (intake) await prisma.countryIntake.upsert({
        where: { countryId_intakeId: { countryId: canada.id, intakeId: intake.id } },
        update: {},
        create: { countryId: canada.id, intakeId: intake.id, isMajor, availabilityStatus: "AVAILABLE" },
      });
    }
  }

  const courseLevels = [
    ["DIPLOMA", "Diploma", 1],
    ["UG", "Undergraduate", 2],
    ["PGDM", "Post Graduate Diploma in Management", 3],
    ["PG", "Postgraduate", 4],
    ["MBA", "Master of Business Administration", 5],
    ["PHD", "Doctor of Philosophy", 6],
    ["CERTIFICATE", "Certificate", 0],
  ] as const;
  for (const [code, name, educationOrder] of courseLevels) {
    await prisma.courseLevel.upsert({
      where: { code },
      update: { name, educationOrder, status: "ACTIVE" },
      create: { code, name, educationOrder, status: "ACTIVE" },
    });
  }

  const studyModes = [
    ["FULL_TIME", "Full time"],
    ["PART_TIME", "Part time"],
    ["ONLINE", "Online"],
    ["HYBRID", "Hybrid"],
  ] as const;
  for (const [code, name] of studyModes) {
    await prisma.studyMode.upsert({
      where: { code },
      update: { name, status: "ACTIVE" },
      create: { code, name, status: "ACTIVE" },
    });
  }

  const featureFlags = [
    ["PUBLIC_LOGIN", "Public login", false],
    ["COMPARE_COUNTRIES", "Compare countries", false],
    ["MATCHING_TOOL", "Matching tool", false],
    ["CONSULTANT_DIRECTORY", "Consultant directory", true],
    ["STUDENT_ACCOUNT", "Student account", false],
  ] as const;
  for (const [flagKey, name, isEnabled] of featureFlags) {
    await prisma.featureFlag.upsert({
      where: { flagKey },
      update: { name, isEnabled, environment: "ALL" },
      create: { flagKey, name, isEnabled, environment: "ALL" },
    });
  }

  const settings = [
    ["site.name", "branding", "STRING", "Universta", true],
    ["site.default_locale", "localization", "STRING", "en-IN", true],
    ["site.timezone", "localization", "STRING", "Asia/Kolkata", true],
    ["site.contact_email", "contact", "STRING", "", false],
  ] as const;
  for (const [settingKey, settingGroup, valueType, value, isPublic] of settings) {
    await prisma.siteSetting.upsert({
      where: { settingKey },
      update: { settingGroup, valueType, valueJson: value, isPublic, updatedByUserId: admin.id },
      create: { settingKey, settingGroup, valueType, valueJson: value, isPublic, updatedByUserId: admin.id },
    });
  }

  const metrics = [
    ["countries_count", "Countries", "—"],
    ["universities_count", "Universities", "—"],
    ["courses_count", "Courses", "—"],
  ] as const;
  for (const [metricKey, label, displayValue] of metrics) {
    await prisma.platformMetric.upsert({
      where: { metricKey },
      update: { label, displayValue, numericValue: null, verifiedAt: null, sourceReference: null, isVisible: true },
      create: { metricKey, label, displayValue, numericValue: null, verifiedAt: null, sourceReference: null, isVisible: true },
    });
  }

  console.log(`Seeded foundation data for ${admin.email}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
