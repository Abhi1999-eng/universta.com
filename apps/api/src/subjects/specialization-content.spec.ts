import { SubjectsService } from './subjects.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from '../auth/auth.types';

/**
 * A specialization's own content, as a course has: sections stored with
 * their type, FAQs, each written and read back in order, and only the live
 * ones reaching the public record.
 */

const subject = {
  id: 'cs',
  name: 'Computer Science',
  slug: 'computer-science',
  status: 'PUBLISHED',
  deletedAt: null,
};
const spec = {
  id: 'ai',
  subjectId: 'cs',
  subject,
  name: 'Artificial Intelligence',
  slug: 'artificial-intelligence',
  shortDescription: null,
  overview: null,
  iconMedia: null,
  listingMedia: null,
  isFeatured: false,
  displayOrder: 0,
  status: 'PUBLISHED',
  publishedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  courseLevels: [],
};
const stamp = {
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
};

function prisma(calls: Record<string, unknown[]>) {
  const record = (name: string) => (args: unknown) => {
    (calls[name] ??= []).push(args);
  };
  return {
    subSubject: { findFirst: async () => spec },
    subSubjectContentSection: {
      findMany: async (args: unknown) => {
        record('sectionFindMany')(args);
        return [
          {
            id: 's1',
            sectionKey: 'curriculum',
            heading: 'What you learn',
            subheading: null,
            bodyJson: {
              type: 'RICH_TEXT',
              content: { paragraphs: ['<p>Maths.</p>'] },
            },
            media: null,
            displayOrder: 0,
            status: 'ACTIVE',
            ...stamp,
          },
        ];
      },
      findFirst: async () => ({
        id: 's1',
        subSubjectId: 'ai',
        sectionKey: 'curriculum',
        heading: 'Old',
        subheading: null,
        bodyJson: null,
        mediaId: null,
        displayOrder: 0,
        status: 'ACTIVE',
        media: null,
        ...stamp,
      }),
      create: async (args: { data: Record<string, unknown> }) => {
        record('sectionCreate')(args);
        return { id: 's2', media: null, ...args.data, ...stamp };
      },
      update: async (args: { data: Record<string, unknown> }) => {
        record('sectionUpdate')(args);
        return {
          id: 's1',
          sectionKey: 'curriculum',
          media: null,
          ...args.data,
          ...stamp,
        };
      },
    },
    subSubjectFaq: {
      findMany: async (args: unknown) => {
        record('faqFindMany')(args);
        return [
          {
            id: 'f1',
            question: 'Is maths needed?',
            answer: 'Yes.',
            status: 'ACTIVE',
            displayOrder: 0,
            ...stamp,
          },
        ];
      },
      findFirst: async () => ({
        id: 'f1',
        subSubjectId: 'ai',
        question: 'Q',
        answer: 'A',
        status: 'ACTIVE',
        displayOrder: 0,
        ...stamp,
      }),
      create: async (args: { data: Record<string, unknown> }) => {
        record('faqCreate')(args);
        return { id: 'f2', ...args.data, ...stamp };
      },
      update: async (args: { data: Record<string, unknown> }) => {
        record('faqUpdate')(args);
        return {
          id: 'f1',
          question: 'Q',
          answer: 'A',
          status: 'ACTIVE',
          displayOrder: 0,
          ...args.data,
          ...stamp,
        };
      },
    },
    mediaAsset: { count: async () => 0 },
    auditLog: { create: async () => null },
  } as unknown as PrismaService;
}
const request = {
  user: { sub: 'admin-1' },
  headers: {},
  ip: '127.0.0.1',
  get: () => undefined,
} as unknown as AuthenticatedRequest;

describe('a specialization’s sections and FAQs', () => {
  it('stores a section with its type and hands it back read for the editor', async () => {
    const calls: Record<string, unknown[]> = {};
    const service = new SubjectsService(prisma(calls));
    const created = await service.createSpecializationSection(
      'ai',
      {
        sectionKey: 'skills',
        sectionType: 'CHECKLIST',
        heading: 'Skills',
        bodyJson: { items: ['Python', 'Statistics'] },
      },
      request,
    );
    const data = (calls.sectionCreate[0] as { data: Record<string, unknown> })
      .data;
    expect(data).toMatchObject({
      subSubjectId: 'ai',
      sectionKey: 'skills',
      status: 'ACTIVE',
      bodyJson: {
        type: 'CHECKLIST',
        content: { items: ['Python', 'Statistics'] },
      },
    });
    expect(created.sectionType).toBe('CHECKLIST');
    expect(created.bodyJson).toEqual({ items: ['Python', 'Statistics'] });
    expect(created.status).toBe('ACTIVE');
  });

  it('refuses a section kind the page has no band for', async () => {
    const service = new SubjectsService(prisma({}));
    await expect(
      service.createSpecializationSection(
        'ai',
        {
          sectionKey: 'curriculum',
          sectionType: 'CHECKLIST',
          bodyJson: { items: ['<b>no html</b>'] },
        },
        request,
      ),
    ).rejects.toMatchObject({
      response: { code: 'SUB_SUBJECT_SECTION_INVALID' },
    });
  });

  it('lists the editor every section it has, type read off the body', async () => {
    const service = new SubjectsService(prisma({}));
    const rows = await service.listSpecializationSections('ai');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      sectionKey: 'curriculum',
      sectionType: 'RICH_TEXT',
      bodyJson: { paragraphs: ['<p>Maths.</p>'] },
      status: 'ACTIVE',
    });
  });

  it('writes an FAQ trimmed and in order', async () => {
    const calls: Record<string, unknown[]> = {};
    const service = new SubjectsService(prisma(calls));
    const faq = await service.createSpecializationFaq(
      'ai',
      { question: '  Is maths needed?  ', answer: ' Yes. ', displayOrder: 3 },
      request,
    );
    expect(
      (calls.faqCreate[0] as { data: Record<string, unknown> }).data,
    ).toMatchObject({
      subSubjectId: 'ai',
      question: 'Is maths needed?',
      answer: 'Yes.',
      displayOrder: 3,
      status: 'ACTIVE',
    });
    expect(faq.question).toBe('Is maths needed?');
  });

  it('removes a section or an FAQ by hiding it, never by deleting the row', async () => {
    const calls: Record<string, unknown[]> = {};
    const service = new SubjectsService(prisma(calls));
    await service.removeSpecializationSection('ai', 's1', {}, request);
    await service.removeSpecializationFaq('ai', 'f1', {}, request);
    expect(
      (calls.sectionUpdate[0] as { data: Record<string, unknown> }).data,
    ).toMatchObject({ status: 'INACTIVE' });
    expect(
      (calls.sectionUpdate[0] as { data: { deletedAt: Date } }).data.deletedAt,
    ).toBeInstanceOf(Date);
    expect(
      (calls.faqUpdate[0] as { data: Record<string, unknown> }).data,
    ).toMatchObject({ status: 'INACTIVE' });
  });
});
