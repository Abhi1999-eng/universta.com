import 'dotenv/config';
import { randomBytes, scryptSync } from 'node:crypto';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  describeRegistration,
  registerWebsiteBuilderRecords,
} from '../src/website-builder/register-website-pages';
import {
  describeNavigationRegistration,
  registerWebsiteNavigation,
} from '../src/website-builder/register-website-navigation';

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

  // Registration assigns this role, so it must exist before the first student
  // signs up. Seeded here rather than created on demand: a role appearing as a
  // side effect of a public request is a role nobody reviewed.
  await prisma.role.upsert({
    where: { code: 'STUDENT' },
    update: {
      name: 'Student',
      description: 'Student portal account',
      isSystemRole: true,
      status: 'ACTIVE',
    },
    create: {
      code: 'STUDENT',
      name: 'Student',
      description: 'Student portal account',
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
      update: {},
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
      update: {},
      create: {
        name,
        slug,
        startMonth: monthNumber,
        endMonth: monthNumber,
        seasonName,
        shortLabel,
        status: 'ACTIVE',
      },
    });
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
      update: {},
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
      update: {},
      create: { code, name, status: 'ACTIVE' },
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
      update: {},
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
      update: {},
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
      update: {},
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

  // Every approved Phase 1 route needs a backing Page or PageTemplate before
  // it is editable in the Website Builder. Structural only -- no catalogue
  // content -- so it belongs here rather than in the demo catalogue seed.
  console.log(
    describeRegistration(await registerWebsiteBuilderRecords(prisma, admin.id)),
  );

  // The public header and footer render Admin-owned menus. Without these
  // records the site ships with an empty navigation bar, so the seed creates
  // them once -- and leaves them alone forever after.
  console.log(
    describeNavigationRegistration(await registerWebsiteNavigation(prisma)),
  );

  console.log(`Seeded foundation data for ${admin.email}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
