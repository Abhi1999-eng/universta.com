import { BULK_RESOURCES } from './bulk-resources';

/**
 * A university record carried a name, a type, a QS rank and two paragraphs.
 * Everything a student compares institutions on -- how big it is, how many
 * come from abroad, how many per member of staff, how old it is -- had
 * nowhere to live, so no page could show it.
 *
 * These are somebody else's figures. A cell that cannot be read is reported
 * rather than coerced, because an institution whose size nobody recorded is
 * not an institution with no students.
 */
const parse = async (row: Record<string, string>) => {
  const prisma = {
    country: { findFirst: async () => ({ id: 'c1', slug: 'germany' }) },
  } as never;
  return BULK_RESOURCES.universities.parseRow(
    {
      name: 'Test University',
      countrySlug: 'germany',
      shortDescription: 'x',
      ...row,
    },
    prisma,
  );
};

describe('the figures a university row carries', () => {
  it('reads the student numbers', async () => {
    const out = await parse({
      totalStudents: '22005',
      internationalStudentsPercent: '43',
      studentFacultyRatio: '10.4',
      establishedYear: '1096',
    });
    expect(out.data).toMatchObject({
      totalStudents: 22005,
      internationalStudentsPercent: '43',
      studentFacultyRatio: '10.4',
      establishedYear: 1096,
    });
  });

  it('carries who published them and when', async () => {
    const out = await parse({
      statsSourceName: 'Times Higher Education',
      statsSourceUrl: 'https://example.invalid/the-2026',
      statsYear: '2026',
    });
    expect(out.data).toMatchObject({
      statsSourceName: 'Times Higher Education',
      statsSourceUrl: 'https://example.invalid/the-2026',
      statsYear: 2026,
    });
  });

  it('reads a blank as "nobody recorded it", not as zero', async () => {
    const out = await parse({ totalStudents: '', studentFacultyRatio: '' });
    expect(out.data).toMatchObject({
      totalStudents: null,
      studentFacultyRatio: null,
    });
  });

  it('refuses a student count that is not a whole number', async () => {
    const out = await parse({ totalStudents: '22,005' });
    expect(out.errors).toContain('totalStudents must be a whole number');
  });

  it('refuses a ratio that is not a number', async () => {
    const out = await parse({ studentFacultyRatio: 'about ten' });
    expect(out.errors).toContain('studentFacultyRatio must be a number');
  });

  it('accepts the three campus settings, in any case', async () => {
    expect((await parse({ campusSetting: 'urban' })).data).toMatchObject({
      campusSetting: 'URBAN',
    });
    expect((await parse({ campusSetting: 'Rural' })).data).toMatchObject({
      campusSetting: 'RURAL',
    });
  });

  it('refuses a campus setting it does not know', async () => {
    const out = await parse({ campusSetting: 'seaside' });
    expect(out.errors).toContain(
      'campusSetting must be URBAN, SUBURBAN or RURAL',
    );
  });

  it('carries the contact details', async () => {
    const out = await parse({
      websiteUrl: 'https://example.invalid',
      admissionsEmail: 'admissions@example.invalid',
      phone: '+44 1865 270000',
    });
    expect(out.data).toMatchObject({
      websiteUrl: 'https://example.invalid',
      admissionsEmail: 'admissions@example.invalid',
      phone: '+44 1865 270000',
    });
  });

  it('offers every figure as a sheet column', () => {
    const columns = BULK_RESOURCES.universities.columns;
    for (const key of [
      'totalStudents',
      'internationalStudentsPercent',
      'studentFacultyRatio',
      'establishedYear',
      'campusSetting',
      'websiteUrl',
      'admissionsEmail',
      'phone',
      'statsSourceName',
      'statsSourceUrl',
      'statsYear',
    ])
      expect(columns).toContain(key);
  });
});
