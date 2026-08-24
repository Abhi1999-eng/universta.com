import 'dotenv/config';
import { randomBytes, scryptSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * Explicit, manual-only acceptance data for the AWS DEMO environment.
 *
 * This deliberately builds on the established Phase 1 demo catalog instead
 * of creating a competing seed framework. The persisted SiteSetting manifest
 * is the ownership boundary: cleanup is refused without it, and cleanup
 * never searches by a broad text fragment.
 */
const MARKER = 'FORGE_E2E_2026';
const SETTING_KEY = 'qa.dataset.forge_e2e_2026';
const ADMIN_EMAIL = 'forge-e2e-admin-2026@example.invalid';
const STUDENT_EMAIL = 'forge-e2e-student-2026@example.invalid';
const REFERRED_EMAIL = 'forge-e2e-referred-2026@example.invalid';

const COUNTRY_SLUGS = [
  'canada',
  'united-states',
  'united-kingdom',
  'germany',
  'france',
  'netherlands',
  'australia',
  'new-zealand',
  'singapore',
  'japan',
  'united-arab-emirates',
  'south-africa',
  'brazil',
];
const SUBJECT_SLUGS = [
  'computer-science',
  'business-management',
  'engineering',
  'health-medicine',
  'creative-arts-design',
];
const UNIVERSITY_SLUGS = [
  'northstar-demonstration-university',
  'lakeside-demo-university',
  'ember-demo-institute',
];
const OFFERING_SLUGS = [
  'msc-computer-science-northstar-demo',
  'northstar-demo-data-analytics',
  'northstar-demo-business-insights',
  'lakeside-demo-digital-design',
  'lakeside-demo-software-systems',
  'lakeside-demo-health-innovation',
  'ember-demo-sustainable-business',
  'ember-demo-creative-technology',
];
const SCHOLARSHIP_SLUGS = [
  'northstar-local-demo-scholarship',
  'lakeside-demo-scholarship',
  'ember-demo-scholarship',
  'demo-access-grant',
  'demo-draft-scholarship',
];
const CONSULTANT_SLUGS = [
  'universta-demo-guidance',
  'lakeside-demo-consultant',
  'ember-demo-consultant',
  'demo-draft-consultant',
];
const JOB_SLUGS = [
  'local-demo-content-coordinator',
  'local-demo-student-support',
  'local-demo-expired-role',
];
const EVENT_SLUGS = [
  'local-demo-study-options-session',
  'local-demo-campus-session',
  'local-demo-past-session',
  'local-demo-adviser-workshop',
];
const STORY_SLUGS = [
  'local-demo-study-journey',
  'local-demo-story-lakeside',
  'local-demo-story-ember',
];
const TESTIMONIAL_ATTRIBUTIONS = [
  'Demo record — not a real student',
  'Fictional demo testimonial 2',
  'Fictional demo testimonial 3',
  'Fictional demo testimonial 4',
  'Fictional demo testimonial 5',
];

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function assertQaEnvironment() {
  if (
    process.env.QA_E2E_DATASET !== 'true' ||
    process.env.QA_DATASET_MARKER !== MARKER ||
    process.env.DEPLOYMENT_ENV?.trim().toLowerCase() !== 'demo'
  ) {
    throw new Error(
      'QA dataset commands require QA_E2E_DATASET=true, the expected marker, and DEPLOYMENT_ENV=demo.',
    );
  }
}

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${scryptSync(password, salt, 64).toString('hex')}`;
}

function databaseConfig() {
  const url = new URL(required('DATABASE_URL'));
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    // The temporary local validation account may use MySQL's caching SHA-2
    // authentication. This remains opt-in and is never required by the demo
    // host's loopback database connection.
    allowPublicKeyRetrieval:
      process.env.QA_ALLOW_PUBLIC_KEY_RETRIEVAL === 'true',
  };
}

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(databaseConfig()),
});

async function catalog() {
  const [
    countries,
    subjects,
    courses,
    universities,
    offerings,
    scholarships,
    consultants,
  ] = await Promise.all([
    prisma.country.findMany({
      where: { slug: { in: COUNTRY_SLUGS }, deletedAt: null },
      orderBy: { displayOrder: 'asc' },
    }),
    prisma.subject.findMany({
      where: { slug: { in: SUBJECT_SLUGS }, deletedAt: null },
      orderBy: { displayOrder: 'asc' },
    }),
    prisma.course.findMany({
      where: { courseCode: { startsWith: 'SEED-' }, deletedAt: null },
      orderBy: { displayOrder: 'asc' },
    }),
    prisma.university.findMany({
      where: { slug: { in: UNIVERSITY_SLUGS }, deletedAt: null },
      orderBy: { displayOrder: 'asc' },
    }),
    prisma.universityCourseOffering.findMany({
      where: { slug: { in: OFFERING_SLUGS }, deletedAt: null },
      orderBy: { displayOrder: 'asc' },
    }),
    prisma.scholarship.findMany({
      where: { slug: { in: SCHOLARSHIP_SLUGS }, deletedAt: null },
      orderBy: { displayOrder: 'asc' },
    }),
    prisma.consultant.findMany({
      where: { slug: { in: CONSULTANT_SLUGS }, deletedAt: null },
      orderBy: { displayOrder: 'asc' },
    }),
  ]);
  if (
    !countries.length ||
    !subjects.length ||
    !courses.length ||
    !universities.length ||
    !offerings.length ||
    !scholarships.length ||
    !consultants.length
  ) {
    throw new Error(
      'The Phase 1 demo catalog did not create every required QA relationship.',
    );
  }
  const [level, intake] = await Promise.all([
    prisma.courseLevel.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { educationOrder: 'asc' },
    }),
    prisma.intake.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { startMonth: 'asc' },
    }),
  ]);
  if (!level || !intake)
    throw new Error('Foundation course level or intake is missing.');
  return {
    countries,
    subjects,
    courses,
    universities,
    offerings,
    scholarships,
    consultants,
    level,
    intake,
  };
}

async function enrichCatalogForQa(data: Awaited<ReturnType<typeof catalog>>) {
  const countryConfiguration = [
    {
      slug: 'canada',
      featureCodes: [
        'PR_FRIENDLY',
        'PART_TIME_ALLOWED',
        'POST_STUDY_WORK_AVAILABLE',
      ],
      acceptedTests: ['IELTS', 'TOEFL', 'PTE'],
      intakeMonths: [1, 5, 9],
      postStudyWorkPermitMonths: 24,
    },
    {
      slug: 'united-kingdom',
      featureCodes: ['TOP_RANKED_UNIVERSITIES', 'POST_STUDY_WORK_AVAILABLE'],
      acceptedTests: ['IELTS', 'TOEFL', 'PTE'],
      intakeMonths: [1, 9],
      postStudyWorkPermitMonths: 24,
    },
    {
      slug: 'australia',
      featureCodes: ['PART_TIME_ALLOWED', 'POST_STUDY_WORK_AVAILABLE'],
      acceptedTests: ['IELTS', 'TOEFL', 'PTE'],
      intakeMonths: [2, 7, 11],
      postStudyWorkPermitMonths: 24,
    },
  ] as const;
  await Promise.all(
    countryConfiguration.map((country) =>
      prisma.country.update({
        where: { slug_deletedKey: { slug: country.slug, deletedKey: '' } },
        data: {
          featureCodes: [...country.featureCodes],
          acceptedTests: [...country.acceptedTests],
          intakeMonths: [...country.intakeMonths],
          postStudyWorkPermitMonths: country.postStudyWorkPermitMonths,
        },
      }),
    ),
  );

  const rankingBySlug: Record<string, number | null> = {
    'northstar-demonstration-university': 88,
    'lakeside-demo-university': 142,
    'ember-demo-institute': null,
  };
  await Promise.all(
    data.universities.map((university) =>
      prisma.university.update({
        where: { id: university.id },
        data: {
          qsRanking: rankingBySlug[university.slug],
          isFeatured: university.slug !== 'ember-demo-institute',
        },
      }),
    ),
  );

  const countryBySlug = new Map(
    data.countries.map((country) => [country.slug, country]),
  );
  const universityBySlug = new Map(
    data.universities.map((university) => [university.slug, university]),
  );
  const popularPairs = [
    ['canada', 'northstar-demonstration-university', 1],
    ['united-kingdom', 'lakeside-demo-university', 1],
    ['australia', 'ember-demo-institute', 1],
  ] as const;
  await Promise.all(
    popularPairs.map(([countrySlug, universitySlug, displayOrder]) => {
      const country = countryBySlug.get(countrySlug);
      const university = universityBySlug.get(universitySlug);
      if (!country || !university) {
        throw new Error('QA catalog is missing a required popular university.');
      }
      return prisma.countryPopularUniversity.upsert({
        where: {
          countryId_universityId: {
            countryId: country.id,
            universityId: university.id,
          },
        },
        update: { displayOrder },
        create: {
          countryId: country.id,
          universityId: university.id,
          displayOrder,
        },
      });
    }),
  );
  await Promise.all(
    data.countries.slice(0, 3).map((country, index) =>
      prisma.countryPopularCourse.upsert({
        where: {
          countryId_courseId: {
            countryId: country.id,
            courseId: data.courses[index].id,
          },
        },
        update: { displayOrder: 1 },
        create: {
          countryId: country.id,
          courseId: data.courses[index].id,
          displayOrder: 1,
        },
      }),
    ),
  );
}

async function resetStudentChildren(profileId: string) {
  const conversations = await prisma.studentConversation.findMany({
    where: { studentProfileId: profileId },
    select: { id: true },
  });
  const tickets = await prisma.studentSupportTicket.findMany({
    where: { studentProfileId: profileId },
    select: { id: true },
  });
  if (conversations.length) {
    await prisma.studentMessage.deleteMany({
      where: { conversationId: { in: conversations.map((item) => item.id) } },
    });
    await prisma.studentConversation.deleteMany({
      where: { id: { in: conversations.map((item) => item.id) } },
    });
  }
  if (tickets.length) {
    await prisma.studentSupportMessage.deleteMany({
      where: { ticketId: { in: tickets.map((item) => item.id) } },
    });
    await prisma.studentSupportTicket.deleteMany({
      where: { id: { in: tickets.map((item) => item.id) } },
    });
  }
  await prisma.studentReferral.deleteMany({
    where: {
      OR: [{ referrerProfileId: profileId }, { referredProfileId: profileId }],
    },
  });
  await Promise.all([
    prisma.studentNotification.deleteMany({
      where: { studentProfileId: profileId },
    }),
    prisma.studentConsultantAssignment.deleteMany({
      where: { studentProfileId: profileId },
    }),
    prisma.studentScholarshipApplication.deleteMany({
      where: { studentProfileId: profileId },
    }),
    prisma.studentApplication.deleteMany({
      where: { studentProfileId: profileId },
    }),
    prisma.studentSavedUniversity.deleteMany({
      where: { studentProfileId: profileId },
    }),
    prisma.studentSavedOffering.deleteMany({
      where: { studentProfileId: profileId },
    }),
    prisma.studentSavedScholarship.deleteMany({
      where: { studentProfileId: profileId },
    }),
    prisma.studentAcademicRecord.deleteMany({
      where: { studentProfileId: profileId },
    }),
    prisma.studentWorkExperience.deleteMany({
      where: { studentProfileId: profileId },
    }),
    prisma.studentEnglishTest.deleteMany({
      where: { studentProfileId: profileId },
    }),
    prisma.studentPassport.deleteMany({
      where: { studentProfileId: profileId },
    }),
    prisma.studentPreferredCountry.deleteMany({
      where: { studentProfileId: profileId },
    }),
  ]);
}

async function upsertQaStudent(
  email: string,
  password: string,
  catalogue: Awaited<ReturnType<typeof catalog>>,
  firstName: string,
) {
  const studentRole = await prisma.role.findUnique({
    where: { code: 'STUDENT' },
  });
  if (!studentRole) throw new Error('The foundation STUDENT role is missing.');
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      firstName,
      lastName: 'Forge QA',
      passwordHash: hashPassword(password),
      status: 'ACTIVE',
      passwordChangedAt: new Date(),
    },
    create: {
      email,
      firstName,
      lastName: 'Forge QA',
      passwordHash: hashPassword(password),
      status: 'ACTIVE',
      passwordChangedAt: new Date(),
    },
  });
  await prisma.userRole.deleteMany({ where: { userId: user.id } });
  await prisma.userRole.create({
    data: { userId: user.id, roleId: studentRole.id },
  });
  const profile = await prisma.studentProfile.upsert({
    where: { userId: user.id },
    update: {
      nationalityCountryId: catalogue.countries[0].id,
      currentCountryId: catalogue.countries[0].id,
      currentCityText: 'Demo City',
      preferredSubjectId: catalogue.subjects[0].id,
      preferredCourseLevelId: catalogue.level.id,
      preferredIntakeId: catalogue.intake.id,
      budgetMin: 18000,
      budgetMax: 32000,
      budgetCurrency: 'CAD',
      referralCode:
        email === STUDENT_EMAIL ? 'FORGE-E2E-2026' : 'FORGE-E2E-REFERRED',
    },
    create: {
      userId: user.id,
      nationalityCountryId: catalogue.countries[0].id,
      currentCountryId: catalogue.countries[0].id,
      currentCityText: 'Demo City',
      preferredSubjectId: catalogue.subjects[0].id,
      preferredCourseLevelId: catalogue.level.id,
      preferredIntakeId: catalogue.intake.id,
      budgetMin: 18000,
      budgetMax: 32000,
      budgetCurrency: 'CAD',
      referralCode:
        email === STUDENT_EMAIL ? 'FORGE-E2E-2026' : 'FORGE-E2E-REFERRED',
    },
  });
  return { user, profile };
}

async function upsertQaAdmin(password: string) {
  const superAdminRole = await prisma.role.findUnique({
    where: { code: 'SUPER_ADMIN' },
  });
  if (!superAdminRole)
    throw new Error('The foundation SUPER_ADMIN role is missing.');
  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      firstName: 'Forge',
      lastName: 'QA Admin',
      passwordHash: hashPassword(password),
      status: 'ACTIVE',
      passwordChangedAt: new Date(),
    },
    create: {
      email: ADMIN_EMAIL,
      firstName: 'Forge',
      lastName: 'QA Admin',
      passwordHash: hashPassword(password),
      status: 'ACTIVE',
      passwordChangedAt: new Date(),
    },
  });
  await prisma.userRole.deleteMany({ where: { userId: user.id } });
  await prisma.userRole.create({
    data: { userId: user.id, roleId: superAdminRole.id },
  });
  return user;
}

async function seedStudentState(password: string) {
  const data = await catalog();
  const primary = await upsertQaStudent(STUDENT_EMAIL, password, data, 'Avery');
  const referred = await upsertQaStudent(
    REFERRED_EMAIL,
    password,
    data,
    'Riley',
  );
  await resetStudentChildren(primary.profile.id);
  await resetStudentChildren(referred.profile.id);
  await prisma.studentPreferredCountry.createMany({
    data: data.countries.slice(0, 3).map((country, index) => ({
      studentProfileId: primary.profile.id,
      countryId: country.id,
      displayOrder: index + 1,
    })),
  });
  await prisma.studentAcademicRecord.create({
    data: {
      studentProfileId: primary.profile.id,
      qualificationName: 'Fictional Bachelor of Computing',
      qualificationLevel: 'UNDERGRADUATE',
      institutionName: 'Forge Demo College',
      countryId: data.countries[0].id,
      startDate: new Date('2021-09-01'),
      endDate: new Date('2025-06-01'),
      percentage: 82,
      notes: 'Synthetic QA academic record.',
    },
  });
  await prisma.studentWorkExperience.create({
    data: {
      studentProfileId: primary.profile.id,
      companyName: 'Forge Demo Labs',
      jobTitle: 'Synthetic QA Analyst',
      startDate: new Date('2025-07-01'),
      currentlyWorking: true,
      description: 'Synthetic QA work record.',
    },
  });
  await prisma.studentEnglishTest.create({
    data: {
      studentProfileId: primary.profile.id,
      testType: 'IELTS',
      testDate: new Date('2026-01-15'),
      overallScore: 7.5,
      componentScores: {
        listening: 8,
        reading: 7.5,
        writing: 7,
        speaking: 7.5,
      },
    },
  });
  await prisma.studentSavedUniversity.createMany({
    data: data.universities.slice(0, 3).map((university) => ({
      studentProfileId: primary.profile.id,
      universityId: university.id,
    })),
  });
  await prisma.studentSavedOffering.createMany({
    data: data.offerings.slice(0, 3).map((offering) => ({
      studentProfileId: primary.profile.id,
      offeringId: offering.id,
    })),
  });
  await prisma.studentSavedScholarship.createMany({
    data: data.scholarships.slice(0, 3).map((scholarship) => ({
      studentProfileId: primary.profile.id,
      scholarshipId: scholarship.id,
    })),
  });

  const applicationStates = [
    'APPLICATION_STARTED',
    'SUBMITTED',
    'UNDER_REVIEW',
    'ACCEPTED',
  ] as const;
  for (const [index, status] of applicationStates.entries()) {
    const offering = data.offerings[index % data.offerings.length];
    const university =
      data.universities.find((item) => item.id === offering.universityId) ??
      data.universities[0];
    await prisma.studentApplication.create({
      data: {
        studentProfileId: primary.profile.id,
        universityId: university.id,
        offeringId: offering.id,
        targetIntakeId: data.intake.id,
        status,
        universityNameSnapshot: university.name,
        offeringNameSnapshot: offering.name,
        submittedAt:
          status === 'APPLICATION_STARTED' ? null : new Date('2026-02-01'),
        timeline: {
          create: [
            {
              status: 'APPLICATION_STARTED',
              actorType: 'STUDENT',
              message: 'Synthetic QA application started.',
            },
            ...(status === 'APPLICATION_STARTED'
              ? []
              : [
                  {
                    status,
                    actorType: status === 'SUBMITTED' ? 'STUDENT' : 'ADMIN',
                    message: `Synthetic QA state: ${status}.`,
                  },
                ]),
          ],
        },
      },
    });
  }
  for (const [index, status] of [
    'STARTED',
    'SUBMITTED',
    'UNDER_REVIEW',
  ].entries()) {
    const scholarship = data.scholarships[index % data.scholarships.length];
    await prisma.studentScholarshipApplication.create({
      data: {
        studentProfileId: primary.profile.id,
        scholarshipId: scholarship.id,
        status,
        scholarshipTitleSnapshot: scholarship.title,
        submittedAt: status === 'STARTED' ? null : new Date('2026-02-02'),
        timeline: {
          create: {
            status,
            actorType: status === 'STARTED' ? 'STUDENT' : 'ADMIN',
            message: `Synthetic QA state: ${status}.`,
          },
        },
      },
    });
  }
  const assignment = await prisma.studentConsultantAssignment.create({
    data: {
      studentProfileId: primary.profile.id,
      consultantId: data.consultants[0].id,
      status: 'ACTIVE',
    },
  });
  const conversation = await prisma.studentConversation.create({
    data: {
      studentProfileId: primary.profile.id,
      consultantAssignmentId: assignment.id,
    },
  });
  await prisma.studentMessage.createMany({
    data: [
      {
        conversationId: conversation.id,
        senderType: 'STUDENT',
        studentSenderId: primary.user.id,
        body: 'Synthetic QA message from the student.',
      },
      {
        conversationId: conversation.id,
        senderType: 'ADMIN',
        body: 'Synthetic QA reply for the dashboard.',
      },
    ],
  });
  const ticket = await prisma.studentSupportTicket.create({
    data: {
      studentProfileId: primary.profile.id,
      category: 'APPLICATION',
      subject: 'Synthetic QA support request',
      status: 'OPEN',
    },
  });
  await prisma.studentSupportMessage.create({
    data: {
      ticketId: ticket.id,
      senderType: 'STUDENT',
      senderUserId: primary.user.id,
      body: 'Synthetic QA support detail.',
    },
  });
  await prisma.studentNotification.createMany({
    data: [
      {
        studentProfileId: primary.profile.id,
        type: 'APPLICATION_STATUS',
        title: 'Application ready for review',
        href: '/student/applications',
      },
      {
        studentProfileId: primary.profile.id,
        type: 'MESSAGE',
        title: 'New synthetic QA message',
        href: '/student/messages',
        readAt: new Date(),
      },
    ],
  });
  await prisma.studentReferral.create({
    data: {
      referrerProfileId: primary.profile.id,
      referredProfileId: referred.profile.id,
      referralCode: 'FORGE-E2E-REFERRAL',
      stage: 'APPLICATION_STARTED',
      rewardStatus: 'NOT_ELIGIBLE',
    },
  });
  return { primary, referred };
}

async function counts() {
  const [
    countries,
    subjects,
    courses,
    universities,
    offerings,
    scholarships,
    consultants,
    jobs,
    events,
    stories,
    testimonials,
    primary,
  ] = await Promise.all([
    prisma.country.count({
      where: { slug: { in: COUNTRY_SLUGS }, deletedAt: null },
    }),
    prisma.subject.count({
      where: { slug: { in: SUBJECT_SLUGS }, deletedAt: null },
    }),
    prisma.course.count({
      where: { courseCode: { startsWith: 'SEED-' }, deletedAt: null },
    }),
    prisma.university.count({
      where: { slug: { in: UNIVERSITY_SLUGS }, deletedAt: null },
    }),
    prisma.universityCourseOffering.count({
      where: { slug: { in: OFFERING_SLUGS }, deletedAt: null },
    }),
    prisma.scholarship.count({
      where: { slug: { in: SCHOLARSHIP_SLUGS }, deletedAt: null },
    }),
    prisma.consultant.count({
      where: { slug: { in: CONSULTANT_SLUGS }, deletedAt: null },
    }),
    prisma.job.count({ where: { slug: { in: JOB_SLUGS }, deletedAt: null } }),
    prisma.event.count({
      where: { slug: { in: EVENT_SLUGS }, deletedAt: null },
    }),
    prisma.successStory.count({
      where: { slug: { in: STORY_SLUGS }, deletedAt: null },
    }),
    prisma.testimonial.count({
      where: { attribution: { in: TESTIMONIAL_ATTRIBUTIONS }, deletedAt: null },
    }),
    prisma.user.findUnique({
      where: { email: STUDENT_EMAIL },
      include: { studentProfile: true },
    }),
  ]);
  const profileId = primary?.studentProfile?.id;
  return {
    countries,
    subjects,
    courses,
    universities,
    offerings,
    scholarships,
    consultants,
    jobs,
    events,
    successStories: stories,
    testimonials,
    student: profileId
      ? {
          applications: await prisma.studentApplication.count({
            where: { studentProfileId: profileId },
          }),
          scholarshipApplications:
            await prisma.studentScholarshipApplication.count({
              where: { studentProfileId: profileId },
            }),
          savedUniversities: await prisma.studentSavedUniversity.count({
            where: { studentProfileId: profileId },
          }),
          savedOfferings: await prisma.studentSavedOffering.count({
            where: { studentProfileId: profileId },
          }),
          savedScholarships: await prisma.studentSavedScholarship.count({
            where: { studentProfileId: profileId },
          }),
          notifications: await prisma.studentNotification.count({
            where: { studentProfileId: profileId },
          }),
          supportTickets: await prisma.studentSupportTicket.count({
            where: { studentProfileId: profileId },
          }),
          conversations: await prisma.studentConversation.count({
            where: { studentProfileId: profileId },
          }),
        }
      : null,
  };
}

function runCatalogSeed() {
  const result = spawnSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', 'db:seed:demo'],
    {
      // npm runs workspace scripts from apps/api; keeping that explicit avoids
      // making this operator depend on a particular release filesystem layout.
      cwd: process.cwd(),
      env: {
        ...process.env,
        SEED_DEMO_CATALOG: 'true',
        QA_E2E_DATASET: 'true',
        QA_DATASET_MARKER: MARKER,
      },
      stdio: 'inherit',
    },
  );
  if (result.status !== 0)
    throw new Error('The existing Phase 1 demo catalog seed failed.');
}

async function seed() {
  const existing = await prisma.siteSetting.findUnique({
    where: { settingKey: SETTING_KEY },
  });
  if (!existing) {
    const collisions = await Promise.all([
      prisma.country.count({ where: { slug: { in: COUNTRY_SLUGS } } }),
      prisma.subject.count({ where: { slug: { in: SUBJECT_SLUGS } } }),
      prisma.university.count({ where: { slug: { in: UNIVERSITY_SLUGS } } }),
    ]);
    if (collisions.some(Boolean))
      throw new Error(
        'Refusing to claim pre-existing catalog records without the QA dataset manifest.',
      );
  }
  runCatalogSeed();
  await enrichCatalogForQa(await catalog());
  const admin = await upsertQaAdmin(required('QA_ADMIN_PASSWORD'));
  const student = await seedStudentState(required('QA_STUDENT_PASSWORD'));
  const result = await counts();
  await prisma.siteSetting.upsert({
    where: { settingKey: SETTING_KEY },
    update: {
      settingGroup: 'qa',
      valueType: 'JSON',
      valueJson: {
        marker: MARKER,
        version: 1,
        ready: true,
        adminEmail: ADMIN_EMAIL,
        studentEmail: STUDENT_EMAIL,
        createdAt: new Date().toISOString(),
        counts: result,
      },
      isPublic: false,
    },
    create: {
      settingKey: SETTING_KEY,
      settingGroup: 'qa',
      valueType: 'JSON',
      valueJson: {
        marker: MARKER,
        version: 1,
        ready: true,
        adminEmail: ADMIN_EMAIL,
        studentEmail: STUDENT_EMAIL,
        createdAt: new Date().toISOString(),
        counts: result,
      },
      isPublic: false,
      updatedByUserId: null,
    },
  });
  console.log(
    JSON.stringify({
      marker: MARKER,
      ready: true,
      counts: result,
      adminId: admin.id,
      studentId: student.primary.user.id,
    }),
  );
}

async function report() {
  const manifest = await prisma.siteSetting.findUnique({
    where: { settingKey: SETTING_KEY },
  });
  console.log(
    JSON.stringify({
      marker: MARKER,
      ready: Boolean(manifest),
      counts: await counts(),
    }),
  );
}

async function assertNoUnownedDependents() {
  const [countries, subjects, universities, offerings] = await Promise.all([
    prisma.country.findMany({
      where: { slug: { in: COUNTRY_SLUGS } },
      select: { id: true },
    }),
    prisma.subject.findMany({
      where: { slug: { in: SUBJECT_SLUGS } },
      select: { id: true },
    }),
    prisma.university.findMany({
      where: { slug: { in: UNIVERSITY_SLUGS } },
      select: { id: true },
    }),
    prisma.universityCourseOffering.findMany({
      where: { slug: { in: OFFERING_SLUGS } },
      select: { id: true },
    }),
  ]);
  const [otherUniversities, otherCourses, otherOfferings, otherScholarships] =
    await Promise.all([
      prisma.university.count({
        where: {
          countryId: { in: countries.map((item) => item.id) },
          slug: { notIn: UNIVERSITY_SLUGS },
        },
      }),
      prisma.course.count({
        where: {
          subjectId: { in: subjects.map((item) => item.id) },
          courseCode: { not: { startsWith: 'SEED-' } },
        },
      }),
      prisma.universityCourseOffering.count({
        where: {
          universityId: { in: universities.map((item) => item.id) },
          slug: { notIn: OFFERING_SLUGS },
        },
      }),
      prisma.scholarship.count({
        where: {
          universities: {
            some: { universityId: { in: universities.map((item) => item.id) } },
          },
          slug: { notIn: SCHOLARSHIP_SLUGS },
        },
      }),
    ]);
  if (
    otherUniversities ||
    otherCourses ||
    otherOfferings ||
    otherScholarships
  ) {
    throw new Error(
      `Refusing QA cleanup because non-QA dependents exist (universities=${otherUniversities}, courses=${otherCourses}, offerings=${otherOfferings}, scholarships=${otherScholarships}).`,
    );
  }
  const externalStudentLinks = await prisma.studentSavedOffering.count({
    where: {
      offeringId: { in: offerings.map((item) => item.id) },
      studentProfile: {
        user: { email: { notIn: [STUDENT_EMAIL, REFERRED_EMAIL] } },
      },
    },
  });
  if (externalStudentLinks) {
    throw new Error(
      'Refusing QA cleanup because a non-QA student saved a QA offering.',
    );
  }
}

async function cleanup() {
  const manifest = await prisma.siteSetting.findUnique({
    where: { settingKey: SETTING_KEY },
  });
  if (!manifest) {
    console.log(
      JSON.stringify({
        marker: MARKER,
        cleaned: false,
        reason: 'manifest-absent',
      }),
    );
    return;
  }
  await assertNoUnownedDependents();
  const users = await prisma.user.findMany({
    where: { email: { in: [ADMIN_EMAIL, STUDENT_EMAIL, REFERRED_EMAIL] } },
    include: { studentProfile: true },
  });
  for (const user of users) {
    if (user.studentProfile) await resetStudentChildren(user.studentProfile.id);
    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  // These records were created only after a collision-free preflight and are
  // guarded by the persisted manifest. Children cascade from their owners.
  // Keep relationship writes ordered. MySQL can correctly reject concurrent
  // cascades as a transaction write conflict even when the final graph is
  // otherwise valid.
  await prisma.testimonial.deleteMany({
    where: { attribution: { in: TESTIMONIAL_ATTRIBUTIONS } },
  });
  await prisma.successStory.deleteMany({
    where: { slug: { in: STORY_SLUGS } },
  });
  await prisma.job.deleteMany({ where: { slug: { in: JOB_SLUGS } } });
  await prisma.event.deleteMany({ where: { slug: { in: EVENT_SLUGS } } });
  await prisma.consultant.deleteMany({
    where: { slug: { in: CONSULTANT_SLUGS } },
  });
  await prisma.consultantLocation.deleteMany({
    where: {
      slug: { in: ['demo-city', 'demo-harbour', 'demo-innovation-district'] },
    },
  });
  await prisma.scholarship.deleteMany({
    where: { slug: { in: SCHOLARSHIP_SLUGS } },
  });
  await prisma.universityCourseOffering.deleteMany({
    where: { slug: { in: OFFERING_SLUGS } },
  });
  await prisma.university.deleteMany({
    where: { slug: { in: UNIVERSITY_SLUGS } },
  });
  const qaCourses = await prisma.course.findMany({
    where: { courseCode: { startsWith: 'SEED-' } },
    select: { id: true },
  });
  const qaCourseIds = qaCourses.map((item) => item.id);
  const qaCountryCourses = await prisma.countryCourse.findMany({
    where: { courseId: { in: qaCourseIds } },
    select: { id: true },
  });
  await prisma.countryCourseIntake.deleteMany({
    where: { countryCourseId: { in: qaCountryCourses.map((item) => item.id) } },
  });
  await prisma.countryCourse.deleteMany({
    where: { id: { in: qaCountryCourses.map((item) => item.id) } },
  });
  await prisma.relatedCourse.deleteMany({
    where: {
      OR: [
        { courseId: { in: qaCourseIds } },
        { relatedCourseId: { in: qaCourseIds } },
      ],
    },
  });
  await prisma.course.deleteMany({ where: { id: { in: qaCourseIds } } });
  const subjects = await prisma.subject.findMany({
    where: { slug: { in: SUBJECT_SLUGS } },
    select: { id: true },
  });
  await prisma.subSubject.deleteMany({
    where: { subjectId: { in: subjects.map((item) => item.id) } },
  });
  await prisma.subject.deleteMany({
    where: { id: { in: subjects.map((item) => item.id) } },
  });
  await prisma.scholarshipProvider.deleteMany({
    where: { slug: 'universta-demo-provider' },
  });
  await prisma.country.deleteMany({ where: { slug: { in: COUNTRY_SLUGS } } });
  await prisma.siteSetting.delete({ where: { settingKey: SETTING_KEY } });
  console.log(JSON.stringify({ marker: MARKER, cleaned: true }));
}

async function main() {
  assertQaEnvironment();
  const operation = process.argv[2] ?? 'report';
  if (operation === 'seed') await seed();
  else if (operation === 'report') await report();
  else if (operation === 'cleanup') await cleanup();
  else throw new Error('Operation must be seed, report, or cleanup.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
