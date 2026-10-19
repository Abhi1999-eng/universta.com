import type { PrismaService } from '../prisma/prisma.service';
import type { SettingsService } from '../settings/settings.service';
import { SeoManagementService } from './seo-management.service';
import { htmlToPlainText, plainExcerpt } from './plain-text';

function createService() {
  const prisma = {
    seoBulkTemplate: { findUnique: jest.fn().mockResolvedValue(null) },
    mediaAsset: { findFirst: jest.fn().mockResolvedValue(null) },
  } as unknown as PrismaService;
  const settings = {
    publicGetAll: jest.fn().mockResolvedValue({
      seo: {
        defaultTitleSuffix: '| Universta',
        defaultDescription: 'Global default description.',
      },
    }),
  } as unknown as SettingsService;
  return new SeoManagementService(prisma, settings);
}

describe('A description nobody wrote', () => {
  /* C3, EV-C7, SS-C6. Every course, event, job, story and consultant page
     without written SEO shared the site's one default sentence, although
     each has words of its own. These types now put their own first; the
     rest -- a subject's and a study level's pages among them -- keep the
     site default first, as before. */
  it('is the event’s own summary, ahead of the site default', async () => {
    const event = {
      id: 'event-1',
      title: 'Study in Japan evening',
      slug: 'study-in-japan-evening',
      summary: 'An evening on universities and visas in Japan.',
      description: '<p>Longer text.</p>',
    };
    await expect(
      createService().resolve('event', event, null),
    ).resolves.toMatchObject({
      metaDescription: 'An evening on universities and visas in Japan.',
      ogDescription: 'An evening on universities and visas in Japan.',
      twitterDescription: 'An evening on universities and visas in Japan.',
      source: { description: 'fallback' },
    });
  });

  it('is a course’s short description, ahead of the site default', async () => {
    await expect(
      createService().resolve(
        'course',
        {
          id: 'course-1',
          name: 'Demo Studies',
          slug: 'demo-studies',
          shortDescription: 'A fictional course used for local checks.',
        },
        null,
      ),
    ).resolves.toMatchObject({
      metaDescription: 'A fictional course used for local checks.',
      source: { description: 'fallback' },
    });
  });

  it('is still the site default for a subject and a university', async () => {
    for (const type of ['subject', 'university'] as const)
      await expect(
        createService().resolve(
          type,
          {
            id: 'record-1',
            name: 'Demo',
            slug: 'demo',
            shortDescription: 'Local test record.',
          },
          null,
        ),
      ).resolves.toMatchObject({
        metaDescription: 'Global default description.',
        source: { description: 'default' },
      });
  });

  it('is a story’s journey as plain words, cut to a search result’s length', async () => {
    const journey = `<p>Amara  left&nbsp;Northbridge for <strong>Clearwater</strong>.</p><p><br></p><p>${'She studied hard and settled in quickly. '.repeat(8)}</p>`;
    const result = await createService().resolve(
      'successStory',
      {
        id: 'story-1',
        title: 'From Northbridge',
        slug: 'from-northbridge',
        journey,
      },
      null,
    );
    expect(result.metaDescription).toMatch(
      /^Amara left Northbridge for Clearwater\. She studied hard/,
    );
    expect(result.metaDescription).not.toMatch(/[<>]|&nbsp;|\s{2}/);
    expect(result.metaDescription.length).toBeLessThanOrEqual(160);
    expect(result.metaDescription.endsWith('…')).toBe(true);
    expect(result.source.description).toBe('fallback');
  });

  it('falls to the site default when the record has no words of its own', async () => {
    await expect(
      createService().resolve(
        'job',
        {
          id: 'job-1',
          title: 'Demo role',
          slug: 'demo-role',
          description: '<p><br></p>',
        },
        null,
      ),
    ).resolves.toMatchObject({
      metaDescription: 'Global default description.',
      source: { description: 'default' },
    });
  });

  it('keeps a description an editor wrote', async () => {
    await expect(
      createService().resolve(
        'consultant',
        {
          id: 'c-1',
          name: 'Demo',
          slug: 'demo',
          shortDescription: 'Its own words.',
        },
        { seoTitle: '', metaDescription: 'Written by an editor.' },
      ),
    ).resolves.toMatchObject({
      metaDescription: 'Written by an editor.',
      source: { title: 'fallback', description: 'manual' },
    });
  });
});

describe('A share image nobody chose', () => {
  /* EV-C5. An event's own picture stands in before the site's default. */
  const event = {
    id: 'event-1',
    title: 'Demo',
    slug: 'demo',
    featuredMedia: { publicUrl: '/media/fair.jpg', altText: 'A fair hall' },
  };

  it('is the event’s own image', async () => {
    const result = await createService().resolve('event', event, null);
    expect(result.ogMedia).toEqual({
      url: '/media/fair.jpg',
      alt: 'A fair hall',
    });
    expect(result.twitterMedia).toEqual({
      url: '/media/fair.jpg',
      alt: 'A fair hall',
    });
  });

  it('is still the one an editor chose, when there is one', async () => {
    const result = await createService().resolve('event', event, {
      ogMedia: { publicUrl: '/media/chosen.jpg', altText: 'Chosen' },
    });
    expect(result.ogMedia).toEqual({ url: '/media/chosen.jpg', alt: 'Chosen' });
  });
});

describe('plain text from rich text', () => {
  it('reads an emptied editor as nothing', () => {
    expect(htmlToPlainText('<p><br></p>')).toBe('');
    expect(htmlToPlainText('<p>&nbsp;</p>')).toBe('');
    expect(plainExcerpt('<p><br></p>')).toBeNull();
  });

  it('keeps a short text whole', () => {
    expect(plainExcerpt('<p>Fish &amp; chips</p>')).toBe('Fish & chips');
  });
});
