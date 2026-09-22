/**
 * One-off, idempotent population of the production catalogue.
 *
 * This is deliberately NOT part of the deployment seed (`prisma/seed.ts`). It
 * exists so the public site can be exercised against a realistic, connected
 * catalogue: destinations that link to cities, cities to universities,
 * universities to the generic courses they offer.
 *
 * Rules it holds to:
 *
 *  - Every write is an upsert against a stable identifier, so re-running it
 *    updates rather than duplicates. Country is keyed on slug among live rows
 *    (a soft-deleted row may legitimately hold the same slug), city on
 *    (country, slug), university/subject/course/offering on slug, campus on
 *    (university, slug).
 *  - Nothing is deleted, truncated, soft-deleted or re-parented. Rows that
 *    exist and are not described here are left exactly as they are.
 *  - A country marked `preserveAuthored` was written by a person. For those the
 *    seed only ever ADDS what is missing -- it never rewrites prose, features,
 *    documents or editorial sections, and never replaces an existing FAQ.
 *
 * Run:  npm run db:seed:catalogue         (add --dry-run to report without writing)
 */
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';
import { COUNTRIES } from './catalogue/countries';
import {
  type CountryFacts,
  countryDocuments,
  countryFaqs,
  countryOverview,
  countrySections,
  countryShortDescription,
  html,
} from './catalogue/content';
import { CITIES, cityOverview, cityShortDescription, statesFor } from './catalogue/places';
import {
  UNIVERSITIES,
  universityOverview,
  universityShortDescription,
} from './catalogue/universities';
import {
  COURSES,
  SPECIALIZATIONS,
  SUBJECTS,
  courseOverview,
  subjectOverview,
} from './catalogue/academics';
import {
  OFFERINGS,
  offeringOverview,
  offeringShortDescription,
} from './catalogue/offerings';
import {
  SCHOLARSHIPS,
  SCHOLARSHIP_PROVIDERS,
  scholarshipDescription,
  scholarshipEligibility,
} from './catalogue/scholarships';

const DRY_RUN = process.argv.includes('--dry-run');
const PUBLISHED = 'PUBLISHED';

// ---------------------------------------------------------------- reporting

type Tally = { created: number; updated: number; reused: number };
const tallies = new Map<string, Tally>();

function tally(entity: string): Tally {
  let t = tallies.get(entity);
  if (!t) {
    t = { created: 0, updated: 0, reused: 0 };
    tallies.set(entity, t);
  }
  return t;
}

const note = (entity: string, kind: keyof Tally) => {
  tally(entity)[kind] += 1;
};

const warnings: string[] = [];

function databaseConfig() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error('DATABASE_URL is required for the catalogue seed');
  const url = new URL(value);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    allowPublicKeyRetrieval: true,
  };
}

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(databaseConfig()) });

/** Live rows only: a soft-deleted row may hold the slug we want to use. */
const live = { deletedAt: null };

async function main() {
  console.log(
    DRY_RUN
      ? '=== catalogue seed: DRY RUN (no writes) ===\n'
      : '=== catalogue seed: WRITING ===\n',
  );

  const continents = await loadContinents();
  await seedTaxonomy();
  const { subjectIds, specIds } = await seedAcademics();
  const levelIds = await loadLookup('courseLevel');
  const modeIds = await loadLookup('studyMode');
  const courseIds = await seedCourses(subjectIds, specIds, levelIds, modeIds);

  const countryIds = new Map<string, string>();
  const cityIds = new Map<string, Map<string, string>>();

  for (const facts of COUNTRIES) {
    const { id: countryId, preserve } = await seedCountry(facts, continents);
    countryIds.set(facts.slug, countryId);
    cityIds.set(facts.slug, await seedPlaces(facts, countryId));
    await seedCountryProfiles(facts, countryId, preserve);
    await seedCountryEditorial(facts, countryId, preserve);
    await seedCountryIntakes(facts, countryId);
  }

  const universityIds = await seedUniversities(countryIds, cityIds);
  await seedOfferings(universityIds, courseIds, levelIds);
  await seedCountryCourses(countryIds, courseIds);
  await seedCountrySubjects(countryIds, subjectIds);
  await seedScholarships(countryIds);
  await refreshStatistics(countryIds);

  report();
}


/**
 * Upsert, and report truthfully whether the row was created or updated.
 *
 * Comparing createdAt to updatedAt is not reliable -- `@default(now())` and
 * `@updatedAt` are evaluated separately and can differ by a millisecond on
 * create -- so existence is checked explicitly first.
 */
async function upsertCounted<T extends { id: string }>(
  entity: string,
  delegate: {
    findUnique: (args: { where: any }) => Promise<T | null>;
    create: (args: { data: any }) => Promise<T>;
    update: (args: { where: any; data: any }) => Promise<T>;
  },
  where: any,
  create: any,
  update: any,
): Promise<T> {
  const existing = await delegate.findUnique({ where });
  if (existing) {
    note(entity, 'updated');
    return delegate.update({ where, data: update });
  }
  note(entity, 'created');
  return delegate.create({ data: create });
}

// ------------------------------------------------------------------ lookups

async function loadContinents() {
  const rows = await prisma.continent.findMany({ where: live });
  const bySlug = new Map(rows.map((r) => [r.slug, r.id]));
  return bySlug;
}

async function loadLookup(model: 'courseLevel' | 'studyMode') {
  const rows = await (prisma[model] as any).findMany();
  return new Map<string, string>(rows.map((r: any) => [r.code, r.id]));
}


/**
 * The Country page resolves `featureCodes` and `acceptedTests` against lookup
 * tables and silently drops codes it cannot find, so make sure every code the
 * catalogue references exists. Labels match the rows production already has, so
 * an existing row is matched on its code and left alone.
 */
const FEATURE_LABELS: Record<string, string> = {
  TOP_RANKED_UNIVERSITIES: 'Top ranked universities',
  ONE_YEAR_MASTER_S_DEGREES: "One-year master's degrees",
  ENGLISH_TAUGHT_DEGREES: 'English-taught degrees',
  POST_STUDY_WORK_AVAILABLE: 'Post-study work available',
  PART_TIME_ALLOWED: 'Part-time allowed',
  JANUARY_INTAKE_AVAILABLE: 'January intake available',
  STRONG_RESEARCH_FUNDING: 'Strong research funding',
  LARGE_GRADUATE_JOB_MARKET: 'Large graduate job market',
  WIDE_SUBJECT_CHOICE: 'Wide subject choice',
  SCHOLARSHIP_FRIENDLY: 'Scholarship friendly',
  PR_FRIENDLY: 'PR friendly',
  LOW_TUITION_FEES: 'Low tuition fees',
  BUDGET_FRIENDLY: 'Budget friendly',
  EU_MEMBER_STATE: 'EU member state',
  SCHENGEN_VISA: 'Schengen Visa',
  STRONG_ENGINEERING_AND_TECHNOLOGY: 'Strong engineering and technology',
  GOVERNMENT_SCHOLARSHIPS_AVAILABLE: 'Government scholarships available',
  SETTLEMENT_PATHWAY_TO_STAMP_4: 'Settlement pathway to Stamp 4',
  STRONG_STEM_INSTITUTIONS: 'Strong STEM institutions',
  IELTS_OPTIONAL: 'IELTS optional',
  HIGH_VISA_SUCCESS: 'High visa success',
  LANGUAGE_WAIVER: 'Language waiver',
  FIVE_YEAR_STUDENT_VISA: 'Five-year student visa',
  STUDY_IN_INDIA_PROGRAMME: 'Study in India programme',
  RESIDENTIAL_CAMPUSES: 'Residential campuses',
  FEE_WAIVERS_AVAILABLE: 'Fee waivers available',
};

const TEST_LABELS: Record<string, string> = {
  IELTS: 'IELTS',
  TOEFL: 'TOEFL',
  PTE: 'PTE',
  DUOLINGO: 'Duolingo',
};

async function seedTaxonomy() {
  if (DRY_RUN) return;
  const codes = new Set<string>();
  const tests = new Set<string>();
  for (const c of COUNTRIES) {
    for (const f of c.features) codes.add(f);
    for (const t of c.tests) tests.add(t);
  }
  let order = 100;
  for (const code of codes) {
    const existing = await prisma.countryFeature.findUnique({ where: { code } });
    if (existing) {
      note('CountryFeature', 'reused');
      continue;
    }
    await prisma.countryFeature.create({
      data: { code, name: FEATURE_LABELS[code] ?? code, status: 'ACTIVE', displayOrder: order++ },
    });
    note('CountryFeature', 'created');
  }
  for (const code of tests) {
    const existing = await prisma.countryEnglishTest.findUnique({ where: { code } });
    if (existing) {
      note('CountryEnglishTest', 'reused');
      continue;
    }
    await prisma.countryEnglishTest.create({
      data: { code, name: TEST_LABELS[code] ?? code, status: 'ACTIVE', displayOrder: order++ },
    });
    note('CountryEnglishTest', 'created');
  }
}

// ------------------------------------------------------------------ country

async function seedCountry(
  facts: CountryFacts,
  continents: Map<string, string>,
): Promise<{ id: string; preserve: boolean }> {
  // Countries are unique on slug, ISO2, ISO3 and name (each paired with the
  // soft-delete discriminator), so a live row may already hold this country
  // under a different slug -- production has stubs like "UK" sitting on GB.
  // Match on any of those keys so the seed reuses the record rather than
  // colliding with it.
  const existing =
    (await prisma.country.findFirst({ where: { slug: facts.slug, ...live } })) ??
    (await prisma.country.findFirst({ where: { iso2Code: facts.iso2, ...live } })) ??
    (await prisma.country.findFirst({ where: { iso3Code: facts.iso3, ...live } })) ??
    (await prisma.country.findFirst({ where: { name: facts.name, ...live } }));

  if (existing && existing.slug !== facts.slug) {
    // Keep whatever slug is already public: renaming it would break every link
    // that points at the existing page.
    warnings.push(
      `${facts.name}: reused the existing record '${existing.name}' (/countries/${existing.slug}); its slug was left unchanged rather than moved to '${facts.slug}'.`,
    );
  }

  const continentId = continents.get(facts.continentSlug) ?? null;
  if (!continentId) {
    warnings.push(`No continent '${facts.continentSlug}' for ${facts.name}; left unlinked.`);
  }

  // Facts that identify the place, and are safe to keep correct even on a
  // country an editor owns.
  const identity = {
    iso2Code: facts.iso2,
    iso3Code: facts.iso3,
    capitalCity: facts.capital,
    officialLanguage: facts.language,
    nationalityName: facts.nationality,
    currencyName: facts.currencyName,
    currencyCode: facts.currencyCode,
    currencySymbol: facts.currencySymbol,
    ...(continentId ? { continentId } : {}),
  };

  // Authored content. Only ever written for countries the seed owns.
  const authored = {
    pageHeading: facts.heading,
    tagline: facts.tagline,
    shortDescription: countryShortDescription(facts),
    overview: html(countryOverview(facts)),
    featureCodes: facts.features,
    acceptedTests: facts.tests,
    intakeMonths: facts.intakeMonths,
    status: PUBLISHED,
    publishedAt: new Date(),
    isFeatured: true,
    isPopular: true,
  };

  // Preservation only means anything for a row that already exists. If an
  // authored country is absent there is nothing to protect, so it is written
  // in full like any other.
  const preserve = Boolean(facts.preserveAuthored) && Boolean(existing);

  if (existing) {
    const data = preserve ? identity : { ...identity, ...authored, name: facts.name };
    if (!DRY_RUN) {
      await prisma.country.update({ where: { id: existing.id }, data });
    }
    note('Country', preserve ? 'reused' : 'updated');
    if (preserve) {
      console.log(`  Country  ${facts.name} — preserved (authored content untouched)`);
    }
    return { id: existing.id, preserve };
  }

  if (DRY_RUN) {
    note('Country', 'created');
    return { id: `dry-run-country-${facts.slug}`, preserve: false };
  }
  const created = await prisma.country.create({
    data: { name: facts.name, slug: facts.slug, ...identity, ...authored },
  });
  note('Country', 'created');
  return { id: created.id, preserve: false };
}

// ------------------------------------------------------------- states/cities

async function seedPlaces(facts: CountryFacts, countryId: string) {
  const stateIds = new Map<string, string>();
  for (const [order, state] of statesFor(facts.slug).entries()) {
    if (DRY_RUN) {
      note('State', 'created');
      stateIds.set(state.name, `dry-run-state-${state.slug}`);
      continue;
    }
    const existing = await prisma.state.findFirst({
      where: { countryId, slug: state.slug },
    });
    if (existing) {
      await prisma.state.update({
        where: { id: existing.id },
        data: { name: state.name, status: PUBLISHED, displayOrder: order },
      });
      note('State', 'updated');
      stateIds.set(state.name, existing.id);
    } else {
      const row = await prisma.state.create({
        data: {
          countryId,
          name: state.name,
          slug: state.slug,
          status: PUBLISHED,
          displayOrder: order,
        },
      });
      note('State', 'created');
      stateIds.set(state.name, row.id);
    }
  }

  const cityIds = new Map<string, string>();
  for (const [order, city] of (CITIES[facts.slug] ?? []).entries()) {
    const slug = city.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const data = {
      name: city.name,
      stateId: city.state ? (stateIds.get(city.state) ?? null) : null,
      shortDescription: cityShortDescription(city),
      overview: cityOverview(city),
      isFeatured: Boolean(city.featured),
      status: PUBLISHED,
      publishedAt: new Date(),
      displayOrder: order,
    };
    if (DRY_RUN) {
      note('City', 'created');
      cityIds.set(city.name, `dry-run-city-${slug}`);
      continue;
    }
    const row = await upsertCounted(
      'City',
      prisma.city as any,
      { countryId_slug: { countryId, slug } },
      { countryId, slug, ...data },
      data,
    );
    cityIds.set(city.name, row.id);
  }
  return cityIds;
}

// ---------------------------------------------------------- country profiles

async function seedCountryProfiles(
  facts: CountryFacts,
  countryId: string,
  preserve: boolean,
) {
  if (DRY_RUN) return;

  const costDisclaimer =
    'Indicative planning ranges only. Fees are set by each institution and each programme, and living costs vary widely by city. Confirm the figures for your own course and location before budgeting against them.';

  const cost = {
    currencyCode: facts.currencyCode,
    currencySymbol: facts.currencySymbol,
    tuitionMin: facts.tuitionMin,
    tuitionMax: facts.tuitionMax,
    tuitionPeriod: 'PER_YEAR',
    tuitionNotes: html([facts.costShape]),
    livingCostMin: facts.livingMin,
    livingCostMax: facts.livingMax,
    livingCostPeriod: 'PER_MONTH',
    disclaimer: costDisclaimer,
  };
  const existingCost = await prisma.countryCostProfile.findUnique({ where: { countryId } });
  if (existingCost) {
    if (!preserve) {
      await prisma.countryCostProfile.update({ where: { countryId }, data: cost });
      note('CountryCostProfile', 'updated');
    } else {
      note('CountryCostProfile', 'reused');
    }
  } else {
    await prisma.countryCostProfile.create({ data: { countryId, ...cost } });
    note('CountryCostProfile', 'created');
  }

  // A country an editor owns keeps its own position on work and visa policy:
  // writing one here would contradict the features they chose by hand.
  if (preserve) {
    warnings.push(
      `${facts.name}: work profile left for its author — the seed does not assert work or visa policy on a hand-authored country.`,
    );
  } else {
    const work = {
      partTimeAllowed: facts.partTimeAllowed,
      partTimeHoursPerWeek: facts.partTimeHours,
      partTimeSummary: html([facts.partTime]),
      postStudyWorkAvailable: facts.postStudyAvailable,
      postStudyWorkMinMonths: facts.postStudyMinMonths,
      postStudyWorkMaxMonths: facts.postStudyMaxMonths,
      postStudyWorkSummary: html([facts.postStudy]),
      immigrationPathwayStrength: facts.pathwayStrength,
      visaType: facts.visaType,
      disclaimer:
        'Immigration rules change, and differ by nationality and by the institution you attend. Confirm the conditions that apply to you with your institution and the authority issuing your visa before relying on them.',
    };
    await upsertCounted(
      'CountryWorkProfile',
      prisma.countryWorkProfile as any,
      { countryId },
      { countryId, ...work },
      work,
    );
  }

  const language = {
    ieltsRequirement: facts.ieltsRequirement,
    toeflRequirement: facts.tests.includes('TOEFL') ? facts.ieltsRequirement : 'VARIES',
    pteRequirement: facts.tests.includes('PTE') ? facts.ieltsRequirement : 'VARIES',
    duolingoRequirement: facts.tests.includes('DUOLINGO') ? 'VARIES' : 'VARIES',
    languageWaiverAvailable: facts.waiverAvailable,
    waiverNotes: facts.waiverAvailable
      ? html([
          `Many institutions in ${facts.name} will waive the English test where your previous qualification was taught and examined in English, against a medium of instruction letter on official letterhead.`,
          'Ask the admissions office directly whether your qualification qualifies, and get the answer in writing before deciding not to sit a test.',
        ])
      : null,
    generalNotes: html([
      `Minimum scores are set by the institution and often by the individual programme rather than nationally, so two courses at the same university can ask for different things.`,
      'Check whether minimums are required in each component as well as overall — the component that catches people out is usually writing — and whether the specific test you intend to take is accepted.',
    ]),
  };
  const existingLang = await prisma.countryLanguageRequirement.findUnique({ where: { countryId } });
  if (existingLang) {
    if (!preserve) {
      await prisma.countryLanguageRequirement.update({ where: { countryId }, data: language });
      note('CountryLanguageRequirement', 'updated');
    } else {
      note('CountryLanguageRequirement', 'reused');
    }
  } else {
    await prisma.countryLanguageRequirement.create({ data: { countryId, ...language } });
    note('CountryLanguageRequirement', 'created');
  }

  const seo = {
    seoTitle: `${facts.heading} — universities, courses, costs and intakes`.slice(0, 255),
    metaDescription: `${facts.tagline}. Compare universities, courses, costs, intakes and entry requirements for ${facts.name}.`.slice(0, 500),
  };
  const existingSeo = await prisma.seoMetadata.findUnique({
    where: { ownerType_ownerId: { ownerType: 'COUNTRY', ownerId: countryId } },
  });
  if (existingSeo) {
    note('SeoMetadata', 'reused');
  } else {
    await prisma.seoMetadata.create({
      data: { ownerType: 'COUNTRY', ownerId: countryId, ...seo },
    });
    note('SeoMetadata', 'created');
  }
}

// --------------------------------------------------------- country editorial

async function seedCountryEditorial(
  facts: CountryFacts,
  countryId: string,
  preserve: boolean,
) {
  if (DRY_RUN) return;

  // Documents: added when absent, never rewritten on an authored country.
  const existingDocs = await prisma.countryDocument.findMany({
    where: { countryId },
    select: { id: true, name: true },
  });
  const docByName = new Map(existingDocs.map((d) => [d.name.toLowerCase(), d.id]));
  for (const [order, doc] of countryDocuments(facts).entries()) {
    const hit = docByName.get(doc.name.toLowerCase());
    if (hit) {
      if (preserve) {
        note('CountryDocument', 'reused');
        continue;
      }
      await prisma.countryDocument.update({
        where: { id: hit },
        data: { details: doc.details, isRequired: doc.required, displayOrder: order },
      });
      note('CountryDocument', 'updated');
      continue;
    }
    if (preserve) {
      // The author's own list stands; do not extend it.
      continue;
    }
    await prisma.countryDocument.create({
      data: {
        countryId,
        name: doc.name,
        details: doc.details,
        isRequired: doc.required,
        displayOrder: order,
      },
    });
    note('CountryDocument', 'created');
  }

  // FAQs: matched on the question, so a re-run updates rather than duplicates.
  // On an authored country only genuinely new questions are added.
  const existingFaqs = await prisma.countryFaq.findMany({
    where: { countryId, ...live },
    select: { id: true, question: true },
  });
  const faqByQuestion = new Map(existingFaqs.map((f) => [f.question.toLowerCase().trim(), f.id]));
  let order = existingFaqs.length;
  for (const [index, faq] of countryFaqs(facts).entries()) {
    const key = faq.question.toLowerCase().trim();
    const hit = faqByQuestion.get(key);
    if (hit) {
      if (preserve) {
        note('CountryFaq', 'reused');
        continue;
      }
      await prisma.countryFaq.update({
        where: { id: hit },
        data: { answer: faq.answer, category: faq.category, status: 'ACTIVE' },
      });
      note('CountryFaq', 'updated');
      continue;
    }
    await prisma.countryFaq.create({
      data: {
        countryId,
        question: faq.question,
        answer: faq.answer,
        category: faq.category,
        status: 'ACTIVE',
        /* The position in the list. Looking the FAQ up with indexOf in a list
           built again for the purpose never matched, so every seeded FAQ was
           stored at -1 -- an order the API refuses, which failed any edit. */
        displayOrder: preserve ? order++ : index,
      },
    });
    note('CountryFaq', 'created');
  }

  // Editorial sections, keyed on (country, sectionKey).
  for (const [index, section] of countrySections(facts).entries()) {
    const existing = await prisma.countryContentSection.findUnique({
      where: { countryId_sectionKey: { countryId, sectionKey: section.key } },
    });
    if (existing) {
      if (preserve) {
        note('CountryContentSection', 'reused');
        continue;
      }
      await prisma.countryContentSection.update({
        where: { id: existing.id },
        data: {
          sectionType: section.type,
          eyebrow: section.eyebrow,
          heading: section.heading,
          bodyJson: section.body,
          displayOrder: index,
          status: 'ACTIVE',
          deletedAt: null,
        },
      });
      note('CountryContentSection', 'updated');
      continue;
    }
    if (preserve) continue;
    await prisma.countryContentSection.create({
      data: {
        countryId,
        sectionKey: section.key,
        sectionType: section.type,
        eyebrow: section.eyebrow,
        heading: section.heading,
        bodyJson: section.body,
        displayOrder: index,
        status: 'ACTIVE',
      },
    });
    note('CountryContentSection', 'created');
  }
}

// ------------------------------------------------------------------ intakes

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

async function seedCountryIntakes(facts: CountryFacts, countryId: string) {
  if (DRY_RUN) return;
  for (const [index, month] of facts.intakeMonths.entries()) {
    const name = `${MONTH_NAMES[month - 1]} intake`;
    const slug = `${MONTH_NAMES[month - 1].toLowerCase()}-intake`;
    let intake = await prisma.intake.findFirst({
      where: { OR: [{ slug }, { name }, { startMonth: month, endMonth: month }] },
    });
    if (!intake) {
      intake = await prisma.intake.create({
        data: {
          name,
          slug,
          startMonth: month,
          endMonth: month,
          shortLabel: MONTH_NAMES[month - 1].slice(0, 3),
          displayOrder: month,
        },
      });
      note('Intake', 'created');
    } else {
      note('Intake', 'reused');
    }
    await upsertCounted(
      'CountryIntake',
      prisma.countryIntake as any,
      { countryId_intakeId: { countryId, intakeId: intake.id } },
      {
        countryId,
        intakeId: intake.id,
        isMajor: index === 0,
        availabilityStatus: 'AVAILABLE',
        displayOrder: index,
      },
      { isMajor: index === 0, displayOrder: index },
    );
  }
}

// ----------------------------------------------------------------- academics

async function seedAcademics() {
  const subjectIds = new Map<string, string>();
  for (const [order, subject] of SUBJECTS.entries()) {
    const data = {
      name: subject.name,
      // Short descriptions and the career summary are plain text: the admin
      // edits them in plain fields and the public pages print them as text,
      // where markup showed as "<p>". Overviews stay rich text.
      shortDescription: subject.blurb,
      overview: subjectOverview(subject),
      status: PUBLISHED,
      publishedAt: new Date(),
      isFeatured: Boolean(subject.featured),
      displayOrder: order,
    };
    if (DRY_RUN) {
      note('Subject', 'created');
      subjectIds.set(subject.slug, `dry-run-subject-${subject.slug}`);
      continue;
    }
    // A subject may already exist under this name from earlier editing; reuse it.
    const existing =
      (await prisma.subject.findFirst({ where: { slug: subject.slug } })) ??
      (await prisma.subject.findFirst({ where: { name: subject.name } }));
    if (existing) {
      await prisma.subject.update({
        where: { id: existing.id },
        data: { ...data, slug: subject.slug, deletedAt: null },
      });
      note('Subject', 'updated');
      subjectIds.set(subject.slug, existing.id);
    } else {
      const row = await prisma.subject.create({ data: { slug: subject.slug, ...data } });
      note('Subject', 'created');
      subjectIds.set(subject.slug, row.id);
    }
  }

  const specIds = new Map<string, string>();
  for (const [order, spec] of SPECIALIZATIONS.entries()) {
    const subjectId = subjectIds.get(spec.subject);
    if (!subjectId) {
      warnings.push(`Specialisation ${spec.name} references unknown subject ${spec.subject}.`);
      continue;
    }
    if (DRY_RUN) {
      note('SubSubject', 'created');
      specIds.set(spec.slug, `dry-run-spec-${spec.slug}`);
      continue;
    }
    const data = {
      subjectId,
      name: spec.name,
      shortDescription: spec.blurb,
      overview: html([spec.blurb, spec.detail]),
      status: PUBLISHED,
      publishedAt: new Date(),
      displayOrder: order,
      deletedAt: null,
    };
    const row = await upsertCounted(
      'SubSubject',
      prisma.subSubject as any,
      { slug: spec.slug },
      { slug: spec.slug, ...data },
      data,
    );
    specIds.set(spec.slug, row.id);
  }
  return { subjectIds, specIds };
}

async function seedCourses(
  subjectIds: Map<string, string>,
  specIds: Map<string, string>,
  levelIds: Map<string, string>,
  modeIds: Map<string, string>,
) {
  const courseIds = new Map<string, string>();
  for (const [order, course] of COURSES.entries()) {
    const subjectId = subjectIds.get(course.subject);
    const courseLevelId = levelIds.get(course.level);
    if (!subjectId || !courseLevelId) {
      warnings.push(`Course ${course.name} skipped: missing subject or level.`);
      continue;
    }
    if (DRY_RUN) {
      note('Course', 'created');
      courseIds.set(course.slug, `dry-run-course-${course.slug}`);
      continue;
    }
    const data = {
      subjectId,
      subSubjectId: course.spec ? (specIds.get(course.spec) ?? null) : null,
      courseLevelId,
      name: course.name,
      shortName: course.shortName ?? null,
      qualificationName: course.qualification,
      shortDescription: course.covers.slice(0, 1000),
      overview: courseOverview(course),
      durationMin: course.durationMin,
      durationMax: course.durationMax,
      durationUnit: 'YEARS',
      careerSummary: course.careers,
      status: PUBLISHED,
      publishedAt: new Date(),
      isFeatured: Boolean(course.featured),
      displayOrder: order,
      deletedAt: null,
    };
    const row = await upsertCounted(
      'Course',
      prisma.course as any,
      { slug: course.slug },
      { slug: course.slug, ...data },
      data,
    );
    courseIds.set(course.slug, row.id);

    for (const mode of course.modes ?? ['FULL_TIME']) {
      const studyModeId = modeIds.get(mode);
      if (!studyModeId) continue;
      await prisma.courseStudyMode.upsert({
        where: { courseId_studyModeId: { courseId: row.id, studyModeId } },
        create: { courseId: row.id, studyModeId },
        update: {},
      });
    }
  }
  return courseIds;
}

// --------------------------------------------------------------- universities

async function seedUniversities(
  countryIds: Map<string, string>,
  cityIds: Map<string, Map<string, string>>,
) {
  const universityIds = new Map<string, string>();
  for (const [order, uni] of UNIVERSITIES.entries()) {
    const countryId = countryIds.get(uni.countrySlug);
    if (!countryId) {
      warnings.push(`University ${uni.name} references unknown country ${uni.countrySlug}.`);
      continue;
    }
    if (DRY_RUN) {
      note('University', 'created');
      note('UniversityCampus', 'created');
      universityIds.set(uni.slug, `dry-run-university-${uni.slug}`);
      continue;
    }
    const data = {
      countryId,
      name: uni.name,
      institutionType: uni.institutionType,
      shortDescription: universityShortDescription(uni),
      overview: universityOverview(uni),
      status: PUBLISHED,
      publishedAt: new Date(),
      isFeatured: Boolean(uni.featured),
      featuredPriority: uni.featured ? 1 : 0,
      displayOrder: order,
      deletedAt: null,
    };
    const row = await upsertCounted(
      'University',
      prisma.university as any,
      { slug: uni.slug },
      { slug: uni.slug, ...data },
      data,
    );
    universityIds.set(uni.slug, row.id);

    const cities = cityIds.get(uni.countrySlug) ?? new Map();
    const campuses = uni.extraCampuses?.length
      ? uni.extraCampuses
      : [{ name: `${uni.city} campus`, city: uni.city, note: `The university's campus in ${uni.city}.` }];
    for (const [ci, campus] of campuses.entries()) {
      const slug = campus.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const campusData = {
        name: campus.name,
        city: campus.city,
        cityId: cities.get(campus.city) ?? cities.get(uni.city) ?? null,
        overview: campus.note,
        status: 'ACTIVE',
        displayOrder: ci,
        deletedAt: null,
      };
      await upsertCounted(
        'UniversityCampus',
        prisma.universityCampus as any,
        { universityId_slug: { universityId: row.id, slug } },
        { universityId: row.id, slug, ...campusData },
        campusData,
      );
    }

    await prisma.countryPopularUniversity.upsert({
      where: { countryId_universityId: { countryId, universityId: row.id } },
      create: { countryId, universityId: row.id, displayOrder: order },
      update: { displayOrder: order },
    });
  }
  return universityIds;
}

// ------------------------------------------------------------------ offerings

async function seedOfferings(
  universityIds: Map<string, string>,
  courseIds: Map<string, string>,
  levelIds: Map<string, string>,
) {
  const uniBySlug = new Map(UNIVERSITIES.map((u) => [u.slug, u]));
  const courseBySlug = new Map(COURSES.map((c) => [c.slug, c]));

  for (const [uniSlug, courseSlugs] of Object.entries(OFFERINGS)) {
    const uni = uniBySlug.get(uniSlug);
    const universityId = universityIds.get(uniSlug);
    if (!uni || !universityId) continue;

    const campuses = DRY_RUN
      ? []
      : await prisma.universityCampus.findMany({
          where: { universityId, deletedAt: null },
          orderBy: { displayOrder: 'asc' },
        });
    const campusId = campuses[0]?.id ?? null;

    for (const [order, courseSlug] of courseSlugs.entries()) {
      const course = courseBySlug.get(courseSlug);
      const genericCourseId = courseIds.get(courseSlug);
      if (!course || !genericCourseId) continue;
      if (DRY_RUN) {
        note('UniversityCourseOffering', 'created');
        continue;
      }
      const slug = `${uniSlug}-${courseSlug}`;
      const data = {
        universityId,
        genericCourseId,
        campusId,
        name: course.name,
        courseLevelId: levelIds.get(course.level) ?? null,
        studyMode: 'FULL_TIME',
        shortDescription: offeringShortDescription(uni, course).slice(0, 1000),
        overview: offeringOverview(uni, course),
        durationMin: course.durationMin,
        durationMax: course.durationMax,
        durationUnit: 'YEARS',
        status: PUBLISHED,
        publishedAt: new Date(),
        isFeatured: Boolean(uni.featured && order === 0),
        displayOrder: order,
        deletedAt: null,
      };
      await upsertCounted(
        'UniversityCourseOffering',
        prisma.universityCourseOffering as any,
        { slug },
        { slug, ...data },
        data,
      );
    }
  }
}


// ------------------------------------------------------------ country courses

/**
 * Which generic courses are available in each destination, derived from the
 * offerings its universities actually run.
 *
 * `sourceReference` and `verifiedAt` are left null on purpose: the Admin API
 * validates the reference as a real HTTPS citation, so filling them here would
 * mean inventing one. Visibility no longer depends on them -- an active,
 * available mapping between a published course and a published country is
 * public on its own -- so an editor can add a citation later without anything
 * being hidden in the meantime.
 */
async function seedCountryCourses(
  countryIds: Map<string, string>,
  courseIds: Map<string, string>,
) {
  if (DRY_RUN) return;
  let unverified = 0;
  for (const [countrySlug, countryId] of countryIds) {
    const uniSlugs = UNIVERSITIES.filter((u) => u.countrySlug === countrySlug).map((u) => u.slug);
    const courseSlugs = new Set<string>();
    for (const uniSlug of uniSlugs) {
      for (const courseSlug of OFFERINGS[uniSlug] ?? []) courseSlugs.add(courseSlug);
    }
    let order = 0;
    for (const courseSlug of courseSlugs) {
      const courseId = courseIds.get(courseSlug);
      if (!courseId) continue;
      const existing = await prisma.countryCourse.findUnique({
        where: { countryId_courseId: { countryId, courseId } },
      });
      if (existing) {
        note('CountryCourse', 'reused');
        if (!existing.sourceReference || !existing.verifiedAt) unverified += 1;
        continue;
      }
      await prisma.countryCourse.create({
        data: {
          countryId,
          courseId,
          availabilityStatus: 'AVAILABLE',
          status: 'ACTIVE',
          displayOrder: order++,
        },
      });
      note('CountryCourse', 'created');
      unverified += 1;
    }
  }
  if (unverified) {
    warnings.push(
      `${unverified} country-course mappings carry no source reference or verified date. They are public regardless, and an editor can add a citation in Admin at any time. No citation was invented here.`,
    );
  }
}

// ------------------------------------------------------------ country subjects

async function seedCountrySubjects(
  countryIds: Map<string, string>,
  subjectIds: Map<string, string>,
) {
  if (DRY_RUN) return;
  // Derived from what the country's universities actually teach, so the mapping
  // stays honest rather than asserted.
  for (const [countrySlug, countryId] of countryIds) {
    const uniSlugs = UNIVERSITIES.filter((u) => u.countrySlug === countrySlug).map((u) => u.slug);
    const subjects = new Set<string>();
    for (const uniSlug of uniSlugs) {
      for (const courseSlug of OFFERINGS[uniSlug] ?? []) {
        const course = COURSES.find((c) => c.slug === courseSlug);
        if (course) subjects.add(course.subject);
      }
    }
    let order = 0;
    for (const subjectSlug of subjects) {
      const subjectId = subjectIds.get(subjectSlug);
      if (!subjectId) continue;
      await upsertCounted(
        'CountrySubject',
        prisma.countrySubject as any,
        { countryId_subjectId: { countryId, subjectId } },
        { countryId, subjectId, displayOrder: order++ },
        {},
      );
    }
  }
}

// --------------------------------------------------------------- scholarships

async function seedScholarships(countryIds: Map<string, string>) {
  if (DRY_RUN) {
    for (const _ of SCHOLARSHIPS) note('Scholarship', 'created');
    return;
  }
  const providerIds = new Map<string, string>();
  for (const [slug, provider] of Object.entries(SCHOLARSHIP_PROVIDERS)) {
    const data = { name: provider.name, websiteUrl: provider.url, status: 'ACTIVE', deletedAt: null };
    const row = await upsertCounted(
      'ScholarshipProvider',
      prisma.scholarshipProvider as any,
      { slug },
      { slug, ...data },
      data,
    );
    providerIds.set(slug, row.id);
  }

  for (const [order, s] of SCHOLARSHIPS.entries()) {
    const data = {
      providerId: providerIds.get(s.providerSlug) ?? null,
      title: s.title,
      summary: s.summary.slice(0, 1000),
      description: scholarshipDescription(s),
      eligibility: scholarshipEligibility(s),
      benefitType: s.benefitType,
      applicationUrl: s.applicationUrl,
      status: PUBLISHED,
      publishedAt: new Date(),
      isFeatured: Boolean(s.featured),
      displayOrder: order,
      deletedAt: null,
      // Award values and deadlines move every cycle; left unset deliberately.
      amount: null,
      currencyCode: null,
      deadline: null,
    };
    const row = await upsertCounted(
      'Scholarship',
      prisma.scholarship as any,
      { slug: s.slug },
      { slug: s.slug, ...data },
      data,
    );

    for (const countrySlug of s.countries) {
      const countryId = countryIds.get(countrySlug);
      if (!countryId) continue;
      await prisma.scholarshipCountry.upsert({
        where: { scholarshipId_countryId: { scholarshipId: row.id, countryId } },
        create: { scholarshipId: row.id, countryId },
        update: {},
      });
    }
  }
}

// ------------------------------------------------------------------ statistics

async function refreshStatistics(countryIds: Map<string, string>) {
  if (DRY_RUN) return;
  for (const [, countryId] of countryIds) {
    const [universities, cities, scholarships] = await Promise.all([
      prisma.university.count({ where: { countryId, deletedAt: null, status: PUBLISHED } }),
      prisma.city.count({ where: { countryId, deletedAt: null, status: PUBLISHED } }),
      prisma.scholarshipCountry.count({ where: { countryId } }),
    ]);
    const offerings = await prisma.universityCourseOffering.count({
      where: { university: { countryId }, deletedAt: null, status: PUBLISHED },
    });
    const publicCount = await prisma.university.count({
      where: { countryId, deletedAt: null, status: PUBLISHED, institutionType: 'Public' },
    });
    const data = {
      universitiesCount: universities,
      publicUniversitiesCount: publicCount,
      privateUniversitiesCount: universities - publicCount,
      coursesCount: offerings,
      citiesCount: cities,
      scholarshipsCount: scholarships,
      sourceMode: 'DERIVED',
    };
    await upsertCounted(
      'CountryStatistic',
      prisma.countryStatistic as any,
      { countryId },
      { countryId, ...data },
      data,
    );
  }
}

// -------------------------------------------------------------------- report

function report() {
  console.log('\n--- catalogue seed summary ---');
  const pad = (s: string, n: number) => s.padEnd(n);
  console.log(`${pad('entity', 30)}${pad('created', 10)}${pad('updated', 10)}reused`);
  let created = 0;
  let updated = 0;
  let reused = 0;
  for (const [entity, t] of [...tallies].sort()) {
    console.log(
      `${pad(entity, 30)}${pad(String(t.created), 10)}${pad(String(t.updated), 10)}${t.reused}`,
    );
    created += t.created;
    updated += t.updated;
    reused += t.reused;
  }
  console.log(`${pad('TOTAL', 30)}${pad(String(created), 10)}${pad(String(updated), 10)}${reused}`);
  if (warnings.length) {
    console.log('\n--- notes ---');
    for (const w of warnings) console.log(`  - ${w}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
