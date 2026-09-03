import { ExpressAdapter } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { BulkOperationsService } from '../src/bulk/bulk.service';
import { CLEAR_TOKEN } from '../src/bulk/country-bulk';

/**
 * The Country bulk contract.
 *
 * The behaviour worth defending here is not "a CSV imports" but what happens
 * on the second and third import: a spreadsheet an editor half-filled must not
 * quietly delete the taxonomy, FAQs or sections it does not mention, and an
 * export fed straight back in must produce the same country rather than a
 * second one.
 */

type Row = Record<string, string>;

describe('country bulk contract (e2e)', () => {
  let app: INestApplication<App2>;
  let prisma: PrismaService;
  let bulk: BulkOperationsService;
  const stamp = `${Date.now()}-${randomUUID().slice(0, 6)}`;
  const uid = `bulk-uid-${stamp}`;
  const slug = `bulk-country-${stamp}`;
  let continentSlug = '';
  let subjectA = '';
  let subjectB = '';
  let subSubjectName = '';
  const created: string[] = [];
  const subjectIds: string[] = [];
  const tagIds: string[] = [];
  let mediaId = '';
  let mediaUrl = '';
  let intakeName = '';

  // The service writes an audit row, which reads request metadata off an
  // Express request, so the stub has to answer those calls.
  const request = {
    user: { sub: '', roles: ['SUPER_ADMIN'] },
    headers: {},
    ip: '127.0.0.1',
    requestId: 'country-bulk-e2e',
    get: () => undefined,
  } as unknown as Parameters<BulkOperationsService['import']>[4];

  function csv(rows: Row[]): Buffer {
    const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const escape = (value: string) =>
      /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    const lines = [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((key) => escape(row[key] ?? '')).join(','),
      ),
    ];
    return Buffer.from(lines.join('\n'), 'utf8');
  }

  const importRows = (rows: Row[], mode: 'create' | 'upsert' = 'upsert') =>
    bulk.import(
      'countries',
      csv(rows),
      'countries.csv',
      mode,
      request,
      actorId,
    );

  let actorId = '';

  async function country() {
    return prisma.country.findFirstOrThrow({
      where: { externalUid: uid, deletedAt: null },
      include: {
        subjectMaps: true,
        tagMaps: true,
        intakes: true,
        faqs: { where: { deletedAt: null } },
        contentSections: { where: { deletedAt: null } },
        costProfile: true,
        workProfile: true,
        languageRequirements: true,
        statistics: true,
      },
    });
  }

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication(new ExpressAdapter());
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    bulk = app.get(BulkOperationsService);

    const admin = await prisma.user.findFirstOrThrow({
      where: { userRoles: { some: { role: { code: 'SUPER_ADMIN' } } } },
      select: { id: true },
    });
    actorId = admin.id;
    (request as { user: { sub: string } }).user.sub = admin.id;

    const continent = await prisma.continent.findFirstOrThrow({
      where: { status: 'ACTIVE', deletedAt: null },
    });
    continentSlug = continent.slug;

    for (const label of ['BulkAlpha', 'BulkBeta']) {
      const subject = await prisma.subject.create({
        data: {
          name: `${label} ${stamp}`,
          slug: `${label.toLowerCase()}-${stamp}`,
          status: 'PUBLISHED',
        },
      });
      subjectIds.push(subject.id);
    }
    subjectA = `bulkalpha-${stamp}`;
    subjectB = `bulkbeta-${stamp}`;
    subSubjectName = `BulkChild ${stamp}`;
    await prisma.subSubject.create({
      data: {
        subjectId: subjectIds[0],
        name: subSubjectName,
        slug: `bulkchild-${stamp}`,
        status: 'PUBLISHED',
      },
    });
    for (const label of ['bulktag-one', 'bulktag-two']) {
      const tag = await prisma.countryTag.create({
        data: { name: `${label}-${stamp}`, slug: `${label}-${stamp}` },
      });
      tagIds.push(tag.id);
    }
    const intake = await prisma.intake.findFirstOrThrow({
      where: { status: 'ACTIVE' },
    });
    intakeName = intake.name;

    mediaUrl = `https://media.example.invalid/${stamp}.png`;
    const media = await prisma.mediaAsset.create({
      data: {
        objectKey: `bulk/${stamp}.png`,
        publicUrl: mediaUrl,
        originalFileName: `bulk-${stamp}.png`,
        storedFileName: `bulk-${stamp}.png`,
        mimeType: 'image/png',
        fileSizeBytes: BigInt(1024),
        status: 'ACTIVE',
      },
    });
    mediaId = media.id;
  });

  afterAll(async () => {
    const ids = await prisma.country.findMany({
      where: {
        OR: [
          { externalUid: { contains: stamp } },
          { slug: { contains: stamp } },
        ],
      },
      select: { id: true },
    });
    for (const row of [...ids.map((r) => r.id), ...created])
      await prisma.country
        .deleteMany({ where: { id: row } })
        .catch(() => undefined);
    await prisma.subSubject
      .deleteMany({ where: { subjectId: { in: subjectIds } } })
      .catch(() => undefined);
    await prisma.subject
      .deleteMany({ where: { id: { in: subjectIds } } })
      .catch(() => undefined);
    await prisma.countryTag
      .deleteMany({ where: { id: { in: tagIds } } })
      .catch(() => undefined);
    if (mediaId)
      await prisma.mediaAsset
        .deleteMany({ where: { id: mediaId } })
        .catch(() => undefined);
    await app.close();
  });

  const baseRow = (): Row => ({
    uid,
    slug,
    title: `Bulk Country ${stamp}`,
    status: 'PUBLISHED',
    excerpt: 'Imported excerpt',
    content: 'Imported long-form overview.',
    continent: continentSlug,
    iso_code: '',
    capital: 'Bulk City',
    currency: 'EUR',
    language: 'English',
    tagline: 'Imported tagline',
    tuition_min: '9000',
    tuition_max: '15000',
    tuition_currency: 'EUR',
    living_min: '700',
    living_max: '1100',
    application_fee: '60',
    visa_type: 'Student permit',
    visa_fee: '85',
    visa_processing: '4 to 6 weeks',
    post_study_work: '24',
    work_hours: '20',
    ielts_min: '6.5',
    featured: 'true',
    rank_order: '5',
    subject: `${subjectA} | ${subjectB}`,
    tag: `bulktag-one-${stamp}`,
    intakes: intakeName,
    faqs: JSON.stringify([
      {
        question: 'Can I work?',
        answer: 'Yes, within the permitted hours.',
        category: 'Work',
      },
    ]),
    why_study: 'Because the programmes are taught in English.',
    admission_process: 'Apply directly to the institution.',
  });

  it('creates a country from a new uid and resolves every relation', async () => {
    const summary = await importRows([baseRow()]);
    expect(summary.errors).toEqual([]);
    expect(summary.created).toBe(1);

    const row = await country();
    created.push(row.id);
    expect(row.name).toBe(`Bulk Country ${stamp}`);
    expect(row.tagline).toBe('Imported tagline');
    expect(row.officialLanguage).toBe('English');
    expect(row.capitalCity).toBe('Bulk City');
    expect(row.isFeatured).toBe(true);
    expect(row.displayOrder).toBe(5);
    expect(row.subjectMaps).toHaveLength(2);
    expect(row.tagMaps).toHaveLength(1);
    expect(row.intakes).toHaveLength(1);
    expect(row.faqs).toHaveLength(1);
    expect(String(row.costProfile?.tuitionMin)).toBe('9000');
    expect(row.workProfile?.visaType).toBe('Student permit');
    expect(String(row.languageRequirements?.ieltsMinScore)).toBe('6.5');
    expect(row.contentSections.map((s) => s.sectionKey).sort()).toEqual([
      'application-steps',
      'why-study',
    ]);
  });

  it('updates the same country on a second import with the same uid', async () => {
    const before = await country();
    const summary = await importRows([
      { ...baseRow(), title: `Renamed ${stamp}` },
    ]);
    expect(summary.updated).toBe(1);
    expect(summary.created).toBe(0);
    const after = await country();
    expect(after.id).toBe(before.id);
    expect(after.name).toBe(`Renamed ${stamp}`);
    const all = await prisma.country.count({
      where: { externalUid: uid, deletedAt: null },
    });
    expect(all).toBe(1);
  });

  it('follows the uid when the slug changes rather than creating a second country', async () => {
    const before = await country();
    await importRows([{ ...baseRow(), slug: `${slug}-renamed` }]);
    const after = await country();
    expect(after.id).toBe(before.id);
    expect(after.slug).toBe(`${slug}-renamed`);
    // put it back for the remaining tests
    await importRows([baseRow()]);
  });

  it('rejects a row whose uid and slug point at different countries', async () => {
    const otherUid = `${uid}-other`;
    await importRows([
      {
        ...baseRow(),
        uid: otherUid,
        slug: `${slug}-other`,
        title: `Other ${stamp}`,
      },
    ]);
    const summary = await importRows([{ ...baseRow(), uid: otherUid, slug }]);
    expect(summary.failed).toBe(1);
    expect(summary.errors[0].errors[0]).toContain('resolve the conflict');
  });

  it('preserves taxonomy when the cell is blank and clears it only on the token', async () => {
    const withBlank = { ...baseRow() };
    withBlank.subject = '';
    withBlank.tag = '';
    await importRows([withBlank]);
    const preserved = await country();
    expect(preserved.subjectMaps).toHaveLength(2);
    expect(preserved.tagMaps).toHaveLength(1);

    await importRows([
      { ...baseRow(), subject: CLEAR_TOKEN, tag: CLEAR_TOKEN },
    ]);
    const cleared = await country();
    expect(cleared.subjectMaps).toHaveLength(0);
    expect(cleared.tagMaps).toHaveLength(0);

    await importRows([baseRow()]);
  });

  it('replaces the subject set with exactly the resolved terms', async () => {
    await importRows([{ ...baseRow(), subject: subjectB }]);
    const row = await country();
    expect(row.subjectMaps).toHaveLength(1);
    expect(row.subjectMaps[0].subjectId).toBe(subjectIds[1]);
    await importRows([baseRow()]);
  });

  it('accepts a valid hierarchy path and stores only the parent subject', async () => {
    const summary = await importRows([
      { ...baseRow(), subject: `${subjectA} > ${subSubjectName}` },
    ]);
    expect(summary.errors).toEqual([]);
    const row = await country();
    expect(row.subjectMaps).toHaveLength(1);
    expect(row.subjectMaps[0].subjectId).toBe(subjectIds[0]);
    await importRows([baseRow()]);
  });

  it('errors on an unknown subject, tag, continent and hierarchy path', async () => {
    const unknownSubject = await importRows([
      { ...baseRow(), subject: 'no-such-subject' },
    ]);
    expect(unknownSubject.errors[0].errors.join(' ')).toContain(
      'subject "no-such-subject"',
    );

    const unknownTag = await importRows([{ ...baseRow(), tag: 'no-such-tag' }]);
    expect(unknownTag.errors[0].errors.join(' ')).toContain(
      'tag "no-such-tag"',
    );

    const unknownContinent = await importRows([
      { ...baseRow(), continent: 'atlantis' },
    ]);
    expect(unknownContinent.errors[0].errors.join(' ')).toContain(
      'continent "atlantis"',
    );

    const badPath = await importRows([
      { ...baseRow(), subject: `${subjectB} > ${subSubjectName}` },
    ]);
    expect(badPath.errors[0].errors.join(' ')).toContain('is not under');
  });

  it('keeps editor-set intake metadata when an import only restates membership', async () => {
    const row = await country();
    await prisma.countryIntake.updateMany({
      where: { countryId: row.id },
      data: {
        applicationOpeningMonth: 3,
        applicationDeadlineMonth: 6,
        notes: 'Editor note',
      },
    });
    await importRows([baseRow()]);
    const after = await country();
    expect(after.intakes[0].applicationOpeningMonth).toBe(3);
    expect(after.intakes[0].notes).toBe('Editor note');
  });

  it('reconciles FAQs without duplicating them on re-import', async () => {
    const faqs = JSON.stringify([
      {
        question: 'Can I work?',
        answer: 'Yes, within the permitted hours.',
        category: 'Work',
      },
      { question: 'Is there a visa fee?', answer: 'Yes.', displayOrder: 1 },
    ]);
    await importRows([{ ...baseRow(), faqs }]);
    await importRows([{ ...baseRow(), faqs }]);
    const row = await country();
    expect(row.faqs).toHaveLength(2);
    expect(row.faqs.map((f) => f.question).sort()).toEqual([
      'Can I work?',
      'Is there a visa fee?',
    ]);
  });

  it('reports an unparsable FAQ payload clearly', async () => {
    const summary = await importRows([
      { ...baseRow(), faqs: 'not json at all' },
    ]);
    expect(summary.failed).toBe(1);
    expect(summary.errors[0].errors.join(' ')).toContain(
      'faqs must be a JSON array',
    );

    const missingAnswer = await importRows([
      { ...baseRow(), faqs: JSON.stringify([{ question: 'Q only' }]) },
    ]);
    expect(missingAnswer.errors[0].errors.join(' ')).toContain(
      'answer is required',
    );
  });

  it('updates a long-form section in place and preserves unrelated sections', async () => {
    await importRows([{ ...baseRow(), why_study: 'Updated reason.' }]);
    const row = await country();
    const why = row.contentSections.filter((s) => s.sectionKey === 'why-study');
    expect(why).toHaveLength(1);
    expect(JSON.stringify(why[0].bodyJson)).toContain('Updated reason.');
    // The admission section was not in this import and must survive.
    expect(
      row.contentSections.some((s) => s.sectionKey === 'application-steps'),
    ).toBe(true);
  });

  it('resolves media by id and by public URL, and refuses an unknown reference', async () => {
    await importRows([
      { ...baseRow(), flag_image: mediaId, hero_image: mediaUrl },
    ]);
    const row = await country();
    expect(row.flagMediaId).toBe(mediaId);
    expect(row.heroMediaId).toBe(mediaId);

    const unknown = await importRows([
      { ...baseRow(), flag_image: 'https://example.invalid/missing.png' },
    ]);
    expect(unknown.failed).toBe(1);
    expect(unknown.errors[0].errors.join(' ')).toContain(
      'did not match an existing media asset',
    );
  });

  it('stores an imported university count without letting it override the live one', async () => {
    await importRows([
      { ...baseRow(), universities_count: '250', intl_students: '4000' },
    ]);
    const row = await country();
    expect(row.statistics?.universitiesCount).toBe(250);
    expect(row.statistics?.sourceMode).toBe('IMPORTED');
    // No source reference or verification date can come from a spreadsheet,
    // so the read path must still refuse to publish the number.
    expect(row.statistics?.sourceReference).toBeNull();
    expect(row.statistics?.verifiedAt).toBeNull();
  });

  it('leaves the row untouched when reconciliation fails', async () => {
    const before = await country();
    const summary = await importRows([
      {
        ...baseRow(),
        title: `Should Not Persist ${stamp}`,
        subject: 'no-such-subject',
      },
    ]);
    expect(summary.failed).toBe(1);
    const after = await country();
    expect(after.name).toBe(before.name);
  });

  it('carries an application fee range and a visa currency through a full round trip', async () => {
    await importRows([
      {
        ...baseRow(),
        application_fee: '60-120',
        // A currency that is deliberately not the country's own, so a fallback
        // could not accidentally produce the right answer.
        visa_fee: 'GBP 490',
      },
    ]);

    let row = await country();
    expect(String(row.costProfile?.applicationFeeMin)).toBe('60');
    expect(String(row.costProfile?.applicationFeeMax)).toBe('120');
    expect(String(row.workProfile?.visaFee)).toBe('490');
    expect(row.workProfile?.visaFeeCurrencyCode).toBe('GBP');

    const cell = async (column: string) => {
      const text = (await bulk.export('countries', 'csv')).buffer.toString(
        'utf8',
      );
      const [header, ...lines] = text.split('\n');
      const columns = header.split(',');
      const line = lines.find((entry) => entry.includes(uid));
      return line!.split(',')[columns.indexOf(column)];
    };

    // Export -> import -> export must say the same thing each time.
    expect(await cell('application_fee')).toBe('60-120');
    expect(await cell('visa_fee')).toBe('GBP 490');

    const exported = await bulk.export('countries', 'csv');
    await bulk.import(
      'countries',
      exported.buffer,
      'countries.csv',
      'upsert',
      request,
      actorId,
    );

    row = await country();
    expect(String(row.costProfile?.applicationFeeMin)).toBe('60');
    expect(String(row.costProfile?.applicationFeeMax)).toBe('120');
    expect(String(row.workProfile?.visaFee)).toBe('490');
    expect(row.workProfile?.visaFeeCurrencyCode).toBe('GBP');
    expect(await cell('application_fee')).toBe('60-120');
    expect(await cell('visa_fee')).toBe('GBP 490');
  });

  it('exports a single application fee as one number', async () => {
    await importRows([{ ...baseRow(), application_fee: '75' }]);
    const row = await country();
    expect(String(row.costProfile?.applicationFeeMin)).toBe('75');
    expect(String(row.costProfile?.applicationFeeMax)).toBe('75');
    const text = (await bulk.export('countries', 'csv')).buffer.toString(
      'utf8',
    );
    const [header, ...lines] = text.split('\n');
    const columns = header.split(',');
    const line = lines.find((entry) => entry.includes(uid));
    expect(line!.split(',')[columns.indexOf('application_fee')]).toBe('75');
  });

  it('keeps the stored visa currency when a later import sends a bare amount', async () => {
    await importRows([{ ...baseRow(), visa_fee: 'GBP 490' }]);
    await importRows([{ ...baseRow(), visa_fee: '505' }]);
    const row = await country();
    expect(String(row.workProfile?.visaFee)).toBe('505');
    // The second row said nothing about currency, so it must not have blanked it.
    expect(row.workProfile?.visaFeeCurrencyCode).toBe('GBP');
  });

  it('falls back to the country currency for a new profile given a bare visa fee', async () => {
    // Its own country: the shared fixture already has a work profile, and this
    // is specifically about what a profile is created with.
    const freshUid = `${uid}-fresh`;
    await importRows([
      {
        ...baseRow(),
        uid: freshUid,
        slug: `${slug}-fresh`,
        title: `Bulk Country Fresh ${stamp}`,
        currency: 'EUR',
        visa_fee: '185',
      },
    ]);
    const row = await prisma.country.findFirstOrThrow({
      where: { externalUid: freshUid, deletedAt: null },
      include: { workProfile: true },
    });
    expect(String(row.workProfile?.visaFee)).toBe('185');
    expect(row.workProfile?.visaFeeCurrencyCode).toBe('EUR');
  });

  it('rejects a malformed fee row instead of dropping the value', async () => {
    for (const [column, value, expected] of [
      ['application_fee', 'abc', 'application_fee'],
      ['application_fee', '60-', 'application_fee'],
      ['application_fee', '120-60', 'greater than its maximum'],
      ['visa_fee', 'USD abc', 'visa_fee'],
    ] as Array<[string, string, string]>) {
      const summary = await importRows([{ ...baseRow(), [column]: value }]);
      expect(summary.failed).toBe(1);
      expect(JSON.stringify(summary.errors)).toContain(expected);
    }
  });

  it('exports the client contract and re-imports its own export idempotently', async () => {
    await importRows([baseRow()]);
    const exported = await bulk.export('countries', 'csv');
    const text = exported.buffer.toString('utf8');
    const header = text.split('\n')[0];
    for (const column of [
      'uid',
      'slug',
      'title',
      'status',
      'excerpt',
      'content',
      'featured_image',
      'iso_code',
      'capital',
      'currency',
      'language',
      'tagline',
      'tuition_min',
      'tuition_max',
      'tuition_currency',
      'living_min',
      'living_max',
      'application_fee',
      'intakes',
      'visa_type',
      'visa_fee',
      'visa_processing',
      'post_study_work',
      'work_hours',
      'ielts_min',
      'universities_count',
      'intl_students',
      'why_study',
      'admission_process',
      'cost_breakdown',
      'visa_process',
      'flag_image',
      'hero_image',
      'featured',
      'rank_order',
      'faqs',
      'continent',
      'subject',
      'tag',
    ])
      expect(header).toContain(column);

    const before = await country();
    const beforeCounts = {
      subjects: before.subjectMaps.length,
      tags: before.tagMaps.length,
      intakes: before.intakes.length,
      faqs: before.faqs.length,
      sections: before.contentSections.length,
    };
    const countriesBefore = await prisma.country.count({
      where: { deletedAt: null },
    });

    // Feed the export straight back in.
    const summary = await bulk.import(
      'countries',
      exported.buffer,
      'countries.csv',
      'upsert',
      request,
      actorId,
    );
    expect(summary.failed).toBe(0);

    const after = await country();
    expect(after.id).toBe(before.id);
    expect(after.subjectMaps).toHaveLength(beforeCounts.subjects);
    expect(after.tagMaps).toHaveLength(beforeCounts.tags);
    expect(after.intakes).toHaveLength(beforeCounts.intakes);
    expect(after.faqs).toHaveLength(beforeCounts.faqs);
    expect(after.contentSections).toHaveLength(beforeCounts.sections);
    expect(await prisma.country.count({ where: { deletedAt: null } })).toBe(
      countriesBefore,
    );
  });
});

type App2 = import('supertest/types').App;
