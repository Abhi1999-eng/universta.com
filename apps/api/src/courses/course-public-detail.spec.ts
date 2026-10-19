import { CoursesService } from './courses.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * A course's public detail carries what its guide prints: the code an editor
 * gave it, and each content section's picture. The sections were read
 * without their media, so every one went out with `media: null` whatever
 * the editor picked.
 */

type Row = Record<string, unknown>;

const asset = (over: Row = {}) => ({
  id: 'm1',
  publicUrl: '/media/curriculum.jpg',
  altText: 'Students in a lab',
  title: 'Lab',
  width: 1200,
  height: 800,
  status: 'ACTIVE',
  deletedAt: null,
  ...over,
});

function service(course: Row) {
  const calls: Row[] = [];
  const prisma = {
    course: {
      findFirst: async (args: Row) => {
        calls.push(args);
        return course;
      },
    },
    seoMetadata: { findUnique: async () => null },
  };
  return {
    calls,
    courses: new CoursesService(prisma as unknown as PrismaService),
  };
}

const course = (over: Row = {}): Row => ({
  id: 'c1',
  name: 'Master of Information Science and Technology',
  slug: 'mist',
  shortName: 'MIST',
  courseCode: 'IST-M',
  qualificationName: null,
  shortDescription: null,
  overview: null,
  careerSummary: null,
  subject: { id: 's1', name: 'Computing', slug: 'computing' },
  subSubject: null,
  courseLevel: { id: 'l1', name: "Master's", code: 'PG' },
  studyModes: [],
  durationMin: null,
  durationMax: null,
  durationUnit: null,
  credits: null,
  featuredMedia: null,
  isFeatured: false,
  displayOrder: 0,
  countryCourses: [],
  contentSections: [],
  faqs: [],
  relatedFrom: [],
  ...over,
});

describe('a course’s public detail', () => {
  it('reads each section with its picture', async () => {
    const { calls, courses } = service(course());
    await courses.publicDetail('mist');
    const include = (calls[0]!.include as Row).contentSections as Row;
    expect(include.include).toEqual({
      media: { select: expect.objectContaining({ publicUrl: true }) },
    });
  });

  it('sends a section’s picture out in the public media shape', async () => {
    const { courses } = service(
      course({
        contentSections: [
          {
            id: 's1',
            sectionKey: 'curriculum',
            heading: 'What you will study',
            subheading: 'Courses, then a thesis',
            bodyJson: { paragraphs: ['<p>Core courses.</p>'] },
            media: asset(),
            displayOrder: 1,
          },
        ],
      }),
    );
    const detail = await courses.publicDetail('mist');
    expect(detail.contentSections[0]).toMatchObject({
      subheading: 'Courses, then a thesis',
      media: {
        id: 'm1',
        url: '/media/curriculum.jpg',
        alt: 'Students in a lab',
      },
    });
  });

  it('leaves out a picture that was archived', async () => {
    const { courses } = service(
      course({
        contentSections: [
          {
            id: 's1',
            sectionKey: 'curriculum',
            heading: null,
            subheading: null,
            bodyJson: null,
            media: asset({ status: 'ARCHIVED' }),
            displayOrder: 1,
          },
        ],
      }),
    );
    const detail = await courses.publicDetail('mist');
    expect(detail.contentSections[0]!.media).toBeNull();
  });

  it('carries the course code, and null when none was given', async () => {
    expect((await service(course()).courses.publicDetail('mist')).courseCode).toBe(
      'IST-M',
    );
    expect(
      (await service(course({ courseCode: null })).courses.publicDetail('mist'))
        .courseCode,
    ).toBeNull();
  });
});
