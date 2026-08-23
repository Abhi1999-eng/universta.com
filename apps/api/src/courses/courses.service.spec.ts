import {
  CoursesService,
  sanitizeCourseRichText,
  sanitizeCourseRichTextBody,
} from './courses.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('CoursesService catalogue policies', () => {
  const service = new CoursesService({} as PrismaService);
  const internals = service as unknown as {
    validateDuration: (min?: string, max?: string) => void;
    validatePopularity: (value?: string) => void;
    validateMapping: (dto: {
      indicativeTuitionMin?: string;
      indicativeTuitionMax?: string;
      availabilityStatus?: string;
      sourceReference?: string;
      verifiedAt?: string;
    }) => Promise<void>;
  };

  it('requires a country when tuition filters are requested', async () => {
    await expect(
      service.publicList({ minTuition: '1000', page: 1, limit: 12 }),
    ).rejects.toMatchObject({
      response: { code: 'COURSE_TUITION_COUNTRY_REQUIRED' },
    });
  });

  it('rejects inverted duration ranges and out-of-range popularity', () => {
    expect(() => internals.validateDuration('4', '2')).toThrow(
      'Duration minimum cannot exceed maximum',
    );
    expect(() => internals.validatePopularity('101')).toThrow(
      'Popularity score must be between 0 and 100',
    );
  });

  it('requires source verification for available country mappings', async () => {
    await expect(
      internals.validateMapping({ availabilityStatus: 'AVAILABLE' }),
    ).rejects.toMatchObject({
      response: { code: 'COURSE_MAPPING_SOURCE_REQUIRED' },
    });
  });

  it('preserves legacy course copy while sanitizing rich course overview HTML', () => {
    expect(sanitizeCourseRichText('Existing plain overview')).toBe(
      'Existing plain overview',
    );
    expect(
      sanitizeCourseRichText(
        '<p>{courseName}</p><script>alert(1)</script><img src="data:image/png;base64,blocked">',
      ),
    ).toBe('<p>{courseName}</p>');
  });

  it('allows sanitized HTML only in RICH_TEXT course section paragraphs', () => {
    expect(
      sanitizeCourseRichTextBody({
        paragraphs: [
          '<p><strong>{courseName}</strong></p><script>bad()</script>',
        ],
      }),
    ).toEqual({ paragraphs: ['<p><strong>{courseName}</strong></p>'] });
  });
});
