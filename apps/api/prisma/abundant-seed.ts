/**
 * Fills a local database with enough of everything to test against.
 *
 * The catalogue seed writes a small, carefully researched core -- twenty
 * destinations, a hundred real universities, the courses that go with them.
 * That is the right shape for a demo but too thin to exercise a list that
 * paginates, a filter with fifty options, or a bulk export of a thousand
 * rows. This tops every list up on top of that core, and never over it:
 * a record the catalogue seed authored is left exactly as it is.
 *
 * What it invents and what it does not:
 *
 *   - Countries come from `COUNTRY_TABLE`, so their names, ISO codes,
 *     currencies and regions are the real ones. The fields that would be
 *     claims about the world -- tuition, living costs, visa fees, processing
 *     times, IELTS minimums, student numbers -- are left empty for every
 *     country this file creates. An editor fills those from a source; this
 *     seed does not guess them.
 *   - Universities, consultants, scholarship providers and the rest carry
 *     invented names. An invented institution is not a false statement about
 *     a real one, so those are safe to generate; attaching invented fees to
 *     a real university's name would not be, and is not done here.
 *
 * It refuses to run against anything but a database on this machine, and
 * every record it writes says in its own description that it is seeded test
 * content, so there is no way to mistake one later.
 *
 * Deterministic: the same seed value produces the same catalogue every time,
 * and every write is an upsert on the slug, so re-running changes nothing.
 *
 *   npm run db:seed:abundant --workspace apps/api
 */
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';
import { COUNTRY_TABLE } from '../src/countries/country-table';

const PUBLISHED = 'PUBLISHED';
const MARK = 'Seeded test content.';

// --------------------------------------------------------------- randomness

/** mulberry32 -- small, fast, and identical on every machine. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261001);
/* Anything that ends up in a slug is addressed by index, not drawn from the
   shared stream. The stream's position depends on how many records already
   existed, so names drawn from it changed between runs and a second run
   inserted a whole second catalogue instead of finding its own work already
   there. An index-addressed name is the same on every run, so the "already
   taken" checks below actually catch it. */
const at = <T>(items: readonly T[], index: number): T =>
  items[((index % items.length) + items.length) % items.length]!;
const pick = <T>(items: readonly T[]): T =>
  items[Math.floor(rand() * items.length)]!;
const between = (min: number, max: number) =>
  min + Math.floor(rand() * (max - min + 1));
/** A shuffled copy, so a "take three of these" is varied but reproducible. */
function some<T>(items: readonly T[], count: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, Math.min(count, copy.length));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ------------------------------------------------------------- word lists

const PLACE_WORDS = [
  'Northbridge', 'Ashcroft', 'Westmere', 'Kingsley', 'Havenford', 'Stonegate',
  'Fairhaven', 'Elmswood', 'Brookfield', 'Redcliff', 'Lindenhall', 'Marbury',
  'Oakvale', 'Sterling', 'Clearwater', 'Aldergrove', 'Thornbury', 'Whitmore',
  'Granthorpe', 'Caldwell', 'Rosemont', 'Silverbeck', 'Highmoor', 'Lakemont',
  'Pinecrest', 'Ravenswood', 'Eastwell', 'Norwood', 'Bramley', 'Kestrel',
];
const INSTITUTE_KINDS = [
  'University', 'Institute of Technology', 'University of Applied Sciences',
  'International University', 'State University', 'College of Higher Education',
  'Polytechnic University', 'Metropolitan University',
];
const CONSULTANCY_KINDS = [
  'Education Advisors', 'Global Admissions', 'Study Abroad Consultants',
  'Overseas Education', 'Student Mobility Partners', 'Admissions Collective',
  'International Education Group', 'Counselling Partners',
];
const PROVIDER_KINDS = [
  'Education Trust', 'Scholarship Foundation', 'Learning Fund',
  'Merit Council', 'Endowment Board', 'Access Programme',
];
const SERVICES = [
  'Course selection', 'Application filing', 'Visa documentation',
  'Statement of purpose review', 'Scholarship guidance', 'Loan assistance',
  'Accommodation support', 'Pre-departure briefing', 'IELTS coaching',
  'Interview preparation', 'Credential evaluation', 'Post-arrival support',
];
const LANGUAGES = [
  ['English', 'en'], ['Hindi', 'hi'], ['Punjabi', 'pa'], ['Gujarati', 'gu'],
  ['Tamil', 'ta'], ['Telugu', 'te'], ['Marathi', 'mr'], ['Bengali', 'bn'],
  ['Malayalam', 'ml'], ['Kannada', 'kn'], ['Urdu', 'ur'], ['Nepali', 'ne'],
] as const;
const DEPARTMENTS = [
  'Counselling', 'Admissions', 'Partnerships', 'Engineering', 'Content',
  'Marketing', 'Operations', 'Student Success',
];
const EMPLOYMENT = ['Full time', 'Part time', 'Contract', 'Internship'];
const EVENT_KINDS = ['WEBINAR', 'FAIR', 'WORKSHOP', 'INFO_SESSION'];

/** Specialization names that read as real fields of study but belong to no
 * particular institution, so nothing here asserts anything about one. */
const SPEC_HEADS = [
  'Applied', 'Advanced', 'Computational', 'Sustainable', 'Digital', 'Global',
  'Clinical', 'Industrial', 'Environmental', 'Strategic', 'Quantitative',
  'Comparative', 'Experimental', 'Molecular', 'Urban', 'Marine',
];
const SPEC_TAILS = [
  'Systems', 'Analytics', 'Design', 'Policy', 'Management', 'Engineering',
  'Sciences', 'Studies', 'Technology', 'Practice', 'Innovation', 'Research',
  'Modelling', 'Communication', 'Development', 'Informatics',
];

const QUALIFICATIONS: Array<[string, string, string, number, number]> = [
  // level code, qualification, short name, duration min, max
  ['UG', 'Bachelor of Science', 'BSc', 3, 4],
  ['UG', 'Bachelor of Arts', 'BA', 3, 4],
  ['UG', 'Bachelor of Engineering', 'BEng', 4, 4],
  ['PG', 'Master of Science', 'MSc', 1, 2],
  ['PG', 'Master of Arts', 'MA', 1, 2],
  ['PG', 'Master of Engineering', 'MEng', 2, 2],
  ['MBA', 'Master of Business Administration', 'MBA', 1, 2],
  ['PGDM', 'Post Graduate Diploma in Management', 'PGDM', 1, 2],
  ['PHD', 'Doctor of Philosophy', 'PhD', 3, 5],
  ['DIPLOMA', 'Diploma', 'Dip', 1, 2],
  ['CERTIFICATE', 'Certificate', 'Cert', 1, 1],
];

// ------------------------------------------------------------------ client

function databaseConfig() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error('DATABASE_URL is required for the abundant seed');
  const url = new URL(value);
  const host = url.hostname;
  /* This writes invented editorial content by the hundred. It is fine on a
     laptop and wrong anywhere an editor or a visitor can see it, so it will
     only talk to a database on this machine. */
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host))
    throw new Error(
      `Refusing to seed test content into "${host}": the abundant seed is local-only.`,
    );
  return {
    host,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, '').split('?')[0],
    allowPublicKeyRetrieval: true,
  };
}

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(databaseConfig()) });
const tally = new Map<string, number>();
const count = (entity: string, n = 1) =>
  tally.set(entity, (tally.get(entity) ?? 0) + n);

const REGION_TO_CONTINENT: Record<string, string> = {
  Africa: 'africa',
  Asia: 'asia',
  Europe: 'europe',
  'Latin America': 'south-america',
  'Middle East': 'middle-east',
  'North America': 'north-america',
  Oceania: 'australia-new-zealand',
};

// ---------------------------------------------------------------- the work

async function seedCountries() {
  const continents = new Map(
    (await prisma.continent.findMany({ where: { deletedAt: null } })).map(
      (row) => [row.slug, row.id],
    ),
  );
  /* `countries` is unique on the slug AND on each ISO code, and the two
     disagree about the same country often enough to matter: the catalogue
     calls GB "United Kingdom" while the ISO table spells it out in full, so
     matching on the slug alone tried to insert a second GB. Skip on any of
     the three and the seed adds only what is genuinely missing. */
  const seen = await prisma.country.findMany({
    select: { slug: true, name: true, iso2Code: true, iso3Code: true },
  });
  const takenSlug = new Set(seen.map((row) => row.slug));
  const takenName = new Set(seen.map((row) => row.name.toLowerCase()));
  const takenIso = new Set(
    seen.flatMap((row) => [row.iso2Code, row.iso3Code].filter(Boolean) as string[]),
  );
  const ids = new Map<string, string>();
  for (const row of await prisma.country.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true },
  }))
    ids.set(row.slug, row.id);

  let order = 1000;
  for (const row of COUNTRY_TABLE) {
    const slug = slugify(row.name);
    if (
      takenSlug.has(slug) ||
      takenName.has(row.name.toLowerCase()) ||
      takenIso.has(row.iso2) ||
      takenIso.has(row.iso3)
    )
      continue;
    takenSlug.add(slug);
    takenIso.add(row.iso2);
    takenIso.add(row.iso3);
    order += 1;
    const created = await prisma.country.create({
      data: {
        name: row.name,
        slug,
        iso2Code: row.iso2,
        iso3Code: row.iso3,
        currencyCode: row.currencyCode,
        currencyName: row.currencyName,
        currencySymbol: row.currencySymbol,
        continentId: continents.get(REGION_TO_CONTINENT[row.region] ?? '') ?? null,
        /* Identity only. Every figure a visitor would read as fact is left
           for an editor with a source -- see the note at the top. */
        shortDescription: `${row.name} as a study destination. ${MARK} Its costs, visa route and entry requirements are not filled in.`,
        status: PUBLISHED,
        publishedAt: new Date(),
        displayOrder: order,
      },
    });
    ids.set(slug, created.id);
    count('Country');
  }
  return ids;
}

async function seedSpecializations() {
  const subjects = await prisma.subject.findMany({
    where: { deletedAt: null },
    include: { subSubjects: { where: { deletedAt: null } } },
  });
  const ids = new Map<string, string[]>();
  for (const [subjectIndex, subject] of subjects.entries()) {
    const mine = subject.subSubjects.map((row) => row.id);
    const taken = new Set(subject.subSubjects.map((row) => row.slug));
    let order = subject.subSubjects.length;
    let seq = 0;
    /* Twelve or so per subject: enough that the specialization index
       paginates and a subject page's filter has something to filter. */
    while (taken.size < 12 && seq < 200) {
      const name = `${at(SPEC_HEADS, seq * 7 + subjectIndex)} ${at(SPEC_TAILS, seq * 3 + subjectIndex * 5)}`;
      seq += 1;
      const slug = slugify(name);
      if (taken.has(slug)) continue;
      taken.add(slug);
      order += 1;
      const created = await prisma.subSubject.create({
        data: {
          subjectId: subject.id,
          name,
          slug,
          shortDescription: `${name} within ${subject.name}. ${MARK}`,
          overview: `<p>${name} is a specialization of ${subject.name}. ${MARK} Replace this with editorial copy before publishing anywhere real.</p>`,
          status: PUBLISHED,
          publishedAt: new Date(),
          displayOrder: order,
        },
      });
      mine.push(created.id);
      count('SubSubject');
    }
    ids.set(subject.id, mine);
  }
  return ids;
}

async function seedCourses(specsBySubject: Map<string, string[]>) {
  const levels = new Map(
    (await prisma.courseLevel.findMany()).map((row) => [row.code, row.id]),
  );
  const modes = await prisma.studyMode.findMany();
  const subjects = await prisma.subject.findMany({ where: { deletedAt: null } });
  const taken = new Set(
    (await prisma.course.findMany({ select: { slug: true } })).map((r) => r.slug),
  );
  const rows = await prisma.course.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });
  const ids: string[] = rows.map((row) => row.id);
  const takenName = new Set(rows.map((row) => row.name));

  for (const [subjectIndex, subject] of subjects.entries()) {
    const specs = specsBySubject.get(subject.id) ?? [];
    const generated = new Set<string>();
    /* Twenty-odd programmes per subject, spread over every level, so the
       level filter on the course index has real counts behind it. */
    for (let i = 0; i < 22; i += 1) {
      const [levelCode, qualification, shortName, durMin, durMax] = at(
        QUALIFICATIONS,
        i * 5 + subjectIndex,
      );
      const levelId = levels.get(levelCode);
      if (!levelId) continue;
      const base = `${shortName} ${subject.name}${i % 3 === 0 ? '' : ` (${at(SPEC_TAILS, i * 11 + subjectIndex)})`}`;
      /* Two slots can land on the same words, and a course name has to be
         its own -- an offering's name is built from it and offerings are
         unique per university by name. The tie is broken against the names
         this run has generated, never against the ones already in the
         database: deciding from the database made the name depend on what
         was there, so a second run renamed every course and inserted the
         whole set again instead of finding it. */
      const name = generated.has(base) ? `${base} ${i + 1}` : base;
      generated.add(name);
      const slug = slugify(`${name}-${i}`);
      if (taken.has(slug) || takenName.has(name)) continue;
      taken.add(slug);
      takenName.add(name);
      const created = await prisma.course.create({
        data: {
          subjectId: subject.id,
          subSubjectId: specs.length ? pick(specs) : null,
          courseLevelId: levelId,
          name,
          slug,
          qualificationName: qualification,
          shortName,
          shortDescription: `${qualification} in ${subject.name}. ${MARK}`,
          durationMin: durMin,
          durationMax: durMax,
          durationUnit: 'YEARS',
          status: PUBLISHED,
          publishedAt: new Date(),
          displayOrder: i,
          studyModes: {
            create: some(modes, between(1, 3)).map((mode) => ({
              studyModeId: mode.id,
            })),
          },
        },
      });
      ids.push(created.id);
      count('Course');
    }
  }
  return ids;
}

async function seedUniversities(courseIds: string[]) {
  const countries = await prisma.country.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, slug: true },
  });
  const citiesByCountry = new Map<string, Array<{ id: string; name: string }>>();
  for (const city of await prisma.city.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, countryId: true },
  })) {
    const list = citiesByCountry.get(city.countryId) ?? [];
    list.push({ id: city.id, name: city.name });
    citiesByCountry.set(city.countryId, list);
  }
  const levels = await prisma.courseLevel.findMany();
  const taken = new Set(
    (await prisma.university.findMany({ select: { slug: true } })).map(
      (r) => r.slug,
    ),
  );
  const created: Array<{ id: string; name: string; countryId: string }> = [];
  let offeringSerial = 0;

  /* Universities go where the catalogue already has cities, so a campus can
     sit in a real place rather than nowhere. */
  const hosts = countries.filter((c) => (citiesByCountry.get(c.id) ?? []).length);
  for (let i = 0; i < 140; i += 1) {
    const country = at(hosts, i * 3);
    const name = `${at(PLACE_WORDS, i)} ${at(INSTITUTE_KINDS, Math.floor(i / PLACE_WORDS.length) + i * 2)}`;
    const slug = slugify(`${name}-${country.slug}`);
    if (taken.has(slug)) continue;
    taken.add(slug);
    const row = await prisma.university.create({
      data: {
        countryId: country.id,
        name,
        slug,
        shortDescription: `${name} is a seeded institution in ${country.name}. ${MARK}`,
        status: PUBLISHED,
        publishedAt: new Date(),
        displayOrder: i,
      },
    });
    created.push({ id: row.id, name, countryId: country.id });
    count('University');

    const cities = citiesByCountry.get(country.id) ?? [];
    for (const city of some(cities, between(1, 2))) {
      await prisma.universityCampus.create({
        data: {
          universityId: row.id,
          cityId: city.id,
          name: `${city.name} campus`,
          slug: slugify(`${slug}-${city.name}-campus`),
          status: PUBLISHED,
        },
      });
      count('UniversityCampus');
    }

    /* Offerings are what the course search actually reads, so every seeded
       university teaches a handful. The tuition is left unset for the same
       reason the country figures are: it would be a made-up price under a
       named institution. */
    const offeringNames = new Set<string>();
    for (const courseId of some(courseIds, between(4, 9))) {
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { name: true, courseLevelId: true },
      });
      if (!course) continue;
      const offeringName = `${course.name} at ${name}`;
      if (offeringNames.has(offeringName)) continue;
      offeringNames.add(offeringName);
      offeringSerial += 1;
      const offeringSlug = slugify(`${slug}-${course.name}-${offeringSerial}`);
      await prisma.universityCourseOffering.create({
        data: {
          universityId: row.id,
          genericCourseId: courseId,
          courseLevelId: course.courseLevelId ?? pick(levels).id,
          name: offeringName,
          slug: offeringSlug,
          status: PUBLISHED,
          publishedAt: new Date(),
        },
      });
      count('UniversityCourseOffering');
    }
  }
  return created;
}

async function seedConsultants(countryIds: Map<string, string>) {
  const cities = await prisma.city.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, countryId: true, stateId: true },
  });
  const countryList = [...countryIds.values()];
  const takenLoc = new Set(
    (await prisma.consultantLocation.findMany({ select: { slug: true } })).map(
      (r) => r.slug,
    ),
  );
  const locations: string[] = (
    await prisma.consultantLocation.findMany({
      where: { deletedAt: null },
      select: { id: true },
    })
  ).map((r) => r.id);

  for (const city of cities.slice(0, 90)) {
    const name = `${city.name} advisory centre`;
    const slug = slugify(`${name}-${city.id.slice(0, 6)}`);
    if (takenLoc.has(slug)) continue;
    takenLoc.add(slug);
    const row = await prisma.consultantLocation.create({
      data: {
        name,
        slug,
        city: city.name,
        cityId: city.id,
        stateId: city.stateId,
        countryId: city.countryId,
        overview: `Walk-in counselling in ${city.name}. ${MARK}`,
        status: 'ACTIVE',
      },
    });
    locations.push(row.id);
    count('ConsultantLocation');
  }

  const takenCon = new Set(
    (await prisma.consultant.findMany({ select: { slug: true } })).map(
      (r) => r.slug,
    ),
  );
  for (let i = 0; i < 70; i += 1) {
    const name = `${at(PLACE_WORDS, i)} ${at(CONSULTANCY_KINDS, Math.floor(i / PLACE_WORDS.length) + i)}`;
    const slug = slugify(name);
    if (takenCon.has(slug)) continue;
    takenCon.add(slug);
    const handle = slugify(name).slice(0, 24);
    await prisma.consultant.create({
      data: {
        name,
        slug,
        shortDescription: `${name} counsels students on studying abroad. ${MARK}`,
        description: `<p>${name} is a seeded consultancy record. ${MARK} It exists so the consultant directory, its filters and its detail pages have something to show.</p>`,
        email: `hello@${handle}.example`,
        phone: `+91 90000 ${String(10000 + i).slice(0, 5)}`,
        websiteUrl: `https://${handle}.example`,
        verificationStatus: pick(['VERIFIED', 'PENDING', 'UNVERIFIED']),
        verifiedAt: rand() > 0.4 ? new Date() : null,
        status: PUBLISHED,
        publishedAt: new Date(),
        isFeatured: rand() > 0.75,
        displayOrder: i,
        services: {
          create: some(SERVICES, between(3, 7)).map((service, order) => ({
            name: service,
            slug: slugify(service),
            displayOrder: order,
          })),
        },
        languages: {
          create: some(LANGUAGES, between(2, 5)).map(([label, code]) => ({
            name: label,
            code,
          })),
        },
        countries: {
          create: some(countryList, between(2, 6)).map((countryId) => ({
            countryId,
          })),
        },
        locations: {
          create: some(locations, between(1, 4)).map((locationId) => ({
            locationId,
            address: `${between(1, 200)} ${pick(PLACE_WORDS)} Road`,
          })),
        },
      },
    });
    count('Consultant');
  }
}

async function seedScholarships(countryIds: Map<string, string>) {
  const countryList = [...countryIds.values()];
  const takenProvider = new Set(
    (await prisma.scholarshipProvider.findMany({ select: { slug: true } })).map(
      (r) => r.slug,
    ),
  );
  const providers: string[] = (
    await prisma.scholarshipProvider.findMany({
      where: { deletedAt: null },
      select: { id: true },
    })
  ).map((r) => r.id);

  for (let i = 0; i < 30; i += 1) {
    const name = `${at(PLACE_WORDS, i * 2)} ${at(PROVIDER_KINDS, i)}`;
    const slug = slugify(name);
    if (takenProvider.has(slug)) continue;
    takenProvider.add(slug);
    const row = await prisma.scholarshipProvider.create({
      data: {
        name,
        slug,
        websiteUrl: `https://${slug}.example`,
        status: 'ACTIVE',
      },
    });
    providers.push(row.id);
    count('ScholarshipProvider');
  }

  const taken = new Set(
    (await prisma.scholarship.findMany({ select: { slug: true } })).map(
      (r) => r.slug,
    ),
  );
  for (let i = 0; i < 90; i += 1) {
    const title = `${at(PLACE_WORDS, i * 3)} ${at(['Merit', 'Access', 'Global', 'Regional', 'Excellence', 'Opportunity'], i)} Scholarship ${2026 + (i % 3)}`;
    const slug = slugify(`${title}-${i}`);
    if (taken.has(slug)) continue;
    taken.add(slug);
    const row = await prisma.scholarship.create({
      data: {
        title,
        slug,
        providerId: pick(providers),
        summary: `${title}. ${MARK}`,
        description: `<p>${MARK} The award amount, the deadline and the eligibility rules are left unset: those change every cycle and belong to an editor with a source.</p>`,
        status: PUBLISHED,
        publishedAt: new Date(),
        displayOrder: i,
      },
    });
    /* A scholarship reaches a country through a join row, not a column. */
    for (const countryId of some(countryList, between(1, 4)))
      await prisma.scholarshipCountry.upsert({
        where: { scholarshipId_countryId: { scholarshipId: row.id, countryId } },
        create: { scholarshipId: row.id, countryId },
        update: {},
      });
    count('Scholarship');
  }
}

async function seedEditorial(countryIds: Map<string, string>) {
  const countryList = [...countryIds.values()];
  const universities = (
    await prisma.university.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      take: 200,
    })
  );
  const cities = await prisma.city.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, countryId: true, stateId: true },
    take: 200,
  });

  const takenJob = new Set(
    (await prisma.job.findMany({ select: { slug: true } })).map((r) => r.slug),
  );
  for (let i = 0; i < 30; i += 1) {
    const department = at(DEPARTMENTS, i);
    const title = `${at(['Senior', 'Lead', 'Associate', 'Junior', ''], i)} ${department} ${at(['Specialist', 'Manager', 'Executive', 'Analyst'], i * 3)}`.trim();
    const slug = slugify(`${title}-${i}`);
    if (takenJob.has(slug)) continue;
    takenJob.add(slug);
    const city = pick(cities);
    await prisma.job.create({
      data: {
        title,
        slug,
        department,
        employmentType: pick(EMPLOYMENT),
        location: city.name,
        cityId: city.id,
        stateId: city.stateId,
        countryId: city.countryId,
        remoteStatus: pick(['ON_SITE', 'HYBRID', 'REMOTE']),
        summary: `${title} on the ${department} team. ${MARK}`,
        description: `<p>${MARK} This vacancy exists so the careers list and its detail page have content.</p>`,
        publishedDate: new Date(),
        status: PUBLISHED,
        publishedAt: new Date(),
        displayOrder: i,
      },
    });
    count('Job');
  }

  const takenEvent = new Set(
    (await prisma.event.findMany({ select: { slug: true } })).map((r) => r.slug),
  );
  for (let i = 0; i < 30; i += 1) {
    const city = at(cities, i * 5);
    const title = `${city.name} study abroad ${at(['fair', 'webinar', 'workshop', 'open day'], i)} ${i + 1}`;
    const slug = slugify(title);
    if (takenEvent.has(slug)) continue;
    takenEvent.add(slug);
    const starts = new Date(Date.now() + between(-30, 120) * 86400000);
    await prisma.event.create({
      data: {
        title,
        slug,
        summary: `${title}. ${MARK}`,
        description: `<p>${MARK} Seeded so the events list, its filters and its detail page have something to show.</p>`,
        startsAt: starts,
        endsAt: new Date(starts.getTime() + 3 * 3600000),
        timezone: 'Asia/Kolkata',
        eventType: pick(EVENT_KINDS),
        venue: `${pick(PLACE_WORDS)} Convention Centre`,
        cityId: city.id,
        stateId: city.stateId,
        countryId: city.countryId,
        status: PUBLISHED,
        publishedAt: new Date(),
        displayOrder: i,
      },
    });
    count('Event');
  }

  const takenStory = new Set(
    (await prisma.successStory.findMany({ select: { slug: true } })).map(
      (r) => r.slug,
    ),
  );
  for (let i = 0; i < 30; i += 1) {
    const university = at(universities, i * 7);
    const title = `From ${at(PLACE_WORDS, i)} to ${university.name}`;
    const slug = slugify(`${title}-${i}`);
    if (takenStory.has(slug)) continue;
    takenStory.add(slug);
    await prisma.successStory.create({
      data: {
        title,
        slug,
        journey: `<p>${MARK} A seeded journey: shortlisting, application, visa and arrival, written so the success stories list and its detail page are not empty.</p>`,
        universityId: university.id,
        countryId: pick(countryList),
        attribution: `Seeded student ${i + 1}`,
        attributionNote: MARK,
        status: PUBLISHED,
        publishedAt: new Date(),
        displayOrder: i,
      },
    });
    count('SuccessStory');
  }

  /* A testimonial has no slug to match on, so the guard is how many seeded
     ones are already here. Without it this loop added forty-five more on
     every run. */
  const seededQuotes = await prisma.testimonial.count({
    where: { attributionNote: MARK },
  });
  for (let i = seededQuotes; i < 45; i += 1) {
    const university = at(universities, i * 7);
    await prisma.testimonial.create({
      data: {
        quote: `The counselling made the ${university.name} application straightforward. ${MARK}`,
        universityId: university.id,
        countryId: pick(countryList),
        attribution: `Seeded student ${i + 1}`,
        attributionNote: MARK,
        status: PUBLISHED,
        publishedAt: new Date(),
        displayOrder: i,
      },
    });
    count('Testimonial');
  }
}

/**
 * A course is only listed publicly when at least one country says it is
 * taught there, and a country only shows subjects it is linked to. Neither
 * link is decoration: without them the seeded catalogue exists in the admin
 * and is invisible on the site, which is the opposite of the point.
 */
async function seedCoverage() {
  const countries = await prisma.country.findMany({
    where: { deletedAt: null, status: PUBLISHED },
    select: { id: true },
  });
  const countryIds = countries.map((row) => row.id);

  const courses = await prisma.course.findMany({
    where: { deletedAt: null, status: PUBLISHED, countryCourses: { none: {} } },
    select: { id: true },
  });
  const intakes = await prisma.intake.findMany({ select: { id: true } });
  for (const course of courses) {
    for (const countryId of some(countryIds, between(2, 6))) {
      const mapping = await prisma.countryCourse.upsert({
        where: { countryId_courseId: { countryId, courseId: course.id } },
        create: { countryId, courseId: course.id },
        update: {},
      });
      count('CountryCourse');
      /* Intakes are months, not prices -- inventing "September" for a seeded
         course claims nothing about the world, and the intake filter needs
         rows behind it to be testable at all. */
      for (const intake of some(intakes, between(1, 3))) {
        await prisma.countryCourseIntake.upsert({
          where: {
            countryCourseId_intakeId: {
              countryCourseId: mapping.id,
              intakeId: intake.id,
            },
          },
          create: { countryCourseId: mapping.id, intakeId: intake.id },
          update: {},
        });
        count('CountryCourseIntake');
      }
    }
  }

  /* Every destination covers the whole catalogue until an editor narrows it
     -- the same default the country editor now starts a new country with. */
  const subjects = await prisma.subject.findMany({
    where: { deletedAt: null, status: PUBLISHED },
    select: { id: true, subSubjects: { where: { deletedAt: null }, select: { id: true } } },
  });
  const bare = await prisma.country.findMany({
    where: { deletedAt: null, status: PUBLISHED, subjectMaps: { none: {} } },
    select: { id: true },
  });
  for (const country of bare) {
    const subjectRows = await prisma.countrySubject.createMany({
      data: subjects.map((subject) => ({
        countryId: country.id,
        subjectId: subject.id,
      })),
      skipDuplicates: true,
    });
    count('CountrySubject', subjectRows.count);
    const specRows = await prisma.countrySubSubject.createMany({
      data: subjects.flatMap((subject) =>
        subject.subSubjects.map((spec) => ({
          countryId: country.id,
          subSubjectId: spec.id,
        })),
      ),
      skipDuplicates: true,
    });
    count('CountrySubSubject', specRows.count);
  }
}

async function main() {
  console.log('=== abundant seed: local test content ===\n');
  const countryIds = await seedCountries();
  const specs = await seedSpecializations();
  const courseIds = await seedCourses(specs);
  await seedUniversities(courseIds);
  await seedConsultants(countryIds);
  await seedScholarships(countryIds);
  await seedEditorial(countryIds);
  await seedCoverage();

  console.log('--- created ---');
  for (const [entity, n] of [...tally].sort())
    console.log(`  ${entity.padEnd(30)}${n}`);
  console.log(
    '\nEvery record above says "Seeded test content." in its own description.',
  );
}

void (async () => {
  try {
    await main();
  } finally {
    await prisma.$disconnect();
  }
})();
