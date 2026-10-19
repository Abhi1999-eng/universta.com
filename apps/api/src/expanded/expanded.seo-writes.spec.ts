import { ExpandedService } from './expanded.service';
import { SeoManagementService } from '../seo-management/seo-management.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ExperimentsService } from '../experiments/experiments.service';
import type { SettingsService } from '../settings/settings.service';

/**
 * SS-C4, SS-M2, SS-M3, EV-M5, CON-M1, CON-C11.
 *
 * The record editor opened on the resolved SEO and saved it back as
 * hand-written: one untouched save froze a story's title, the site's
 * default description and its address, and a later rename kept the old
 * title in the browser tab and pointed the canonical at a 404. The editor
 * now fills its inputs only from what was stored, and the API stores each
 * field an editor wrote on its own -- or nothing at all.
 */

type Row = Record<string, unknown>;
type SeoRow = Row & { ownerType: string; ownerId: string };

function world(record: Row, stored: SeoRow | null = null) {
  const state = {
    record: { ...record },
    seo: stored ? { ...stored } : null,
    seoWrites: 0,
    redirects: [] as Row[],
  };
  const model = {
    findFirst: async () => ({ ...state.record }),
    update: async ({ data }: { data: Row }) => {
      state.record = { ...state.record, ...data };
      return { ...state.record };
    },
  };
  const prisma = {
    successStory: model,
    consultant: model,
    event: model,
    mediaAsset: { findMany: async () => [], findFirst: async () => null },
    seoBulkTemplate: { findUnique: async () => null },
    seoMetadata: {
      findUnique: async () =>
        state.seo ? { ...state.seo, ogMedia: null, twitterMedia: null } : null,
      upsert: async ({ create, update }: { create: SeoRow; update: Row }) => {
        state.seoWrites += 1;
        state.seo = state.seo ? { ...state.seo, ...update } : { ...create };
        return state.seo;
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        if (state.seo && state.seo.canonicalUrl === where.canonicalUrl) {
          state.seo = { ...state.seo, ...data };
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    redirect: {
      updateMany: async () => ({ count: 0 }),
      upsert: async ({ create }: { create: Row }) => {
        state.redirects.push(create);
        return create;
      },
    },
  } as unknown as PrismaService;
  const settings = {
    publicGetAll: async () => ({
      seo: { defaultDescription: 'Global default description.' },
    }),
  } as unknown as SettingsService;
  const svc = new ExpandedService(
    prisma,
    {} as ExperimentsService,
    new SeoManagementService(prisma, settings),
  );
  return { svc, state };
}

/** What the editor sends for an SEO block nobody touched. */
const untouched = {
  seoTitle: '',
  metaDescription: '',
  canonicalUrl: '',
  focusKeyword: '',
  ogTitle: '',
  ogDescription: '',
  ogMediaId: null,
  twitterTitle: '',
  twitterDescription: '',
  twitterMediaId: null,
  robotsIndex: true,
  robotsFollow: true,
};

const story = {
  id: 'story-1',
  title: 'From Northbridge to Clearwater',
  slug: 'from-northbridge-to-clearwater',
  journey: '<p>A fictional journey from one campus to another.</p>',
  status: 'PUBLISHED',
  featuredMediaId: null,
};

describe('Saving a record’s SEO from the admin', () => {
  it('stores nothing when the SEO fields were left untouched', async () => {
    const { svc, state } = world(story);
    await svc.adminUpdate('success-stories', 'story-1', {
      title: story.title,
      seo: untouched,
    });
    expect(state.seoWrites).toBe(0);
    const detail = (await svc.adminDetail('success-stories', 'story-1')) as Row;
    expect(detail.seoStored).toBeNull();
    expect(detail.seo).toMatchObject({
      source: {
        title: 'fallback',
        description: 'fallback',
        canonical: 'fallback',
      },
    });
  });

  it('lets a renamed story’s title and address follow the rename', async () => {
    /* A row the old editor left behind: the canonical only named the
       story's own address at the time. */
    const { svc, state } = world(story, {
      ownerType: 'success-stories',
      ownerId: 'story-1',
      seoTitle: '',
      metaDescription: '',
      canonicalUrl: '/success-stories/from-northbridge-to-clearwater',
    });
    await svc.adminUpdate('success-stories', 'story-1', {
      title: 'From Northbridge to Kyoto',
      slug: 'from-northbridge-to-kyoto',
      seo: { ...untouched, canonicalUrl: state.seo?.canonicalUrl },
    });
    expect(state.redirects).toEqual([
      expect.objectContaining({
        sourcePath: '/success-stories/from-northbridge-to-clearwater',
        targetPath: '/success-stories/from-northbridge-to-kyoto',
        httpStatusCode: 301,
      }),
    ]);
    const detail = (await svc.adminDetail('success-stories', 'story-1')) as {
      seo: Row;
    };
    expect(detail.seo).toMatchObject({
      seoTitle: 'From Northbridge to Kyoto',
      canonicalUrl: '/success-stories/from-northbridge-to-kyoto',
      source: { title: 'fallback', canonical: 'fallback' },
    });
  });

  /* SS-M2. A lone title was dropped because saveSeo returned unless both a
     title and a description were given. */
  it('stores a title written on its own', async () => {
    const { svc, state } = world(story);
    await svc.adminUpdate('success-stories', 'story-1', {
      seo: { ...untouched, seoTitle: 'Clearwater, in Amara’s words' },
    });
    expect(state.seo).toMatchObject({
      seoTitle: 'Clearwater, in Amara’s words',
      metaDescription: '',
    });
  });

  it('clears what was stored when every field is emptied', async () => {
    const { svc, state } = world(story, {
      ownerType: 'success-stories',
      ownerId: 'story-1',
      seoTitle: 'An old hand-written title',
      metaDescription: 'An old hand-written description.',
      canonicalUrl: '/success-stories/somewhere-else',
      ogTitle: 'An old share title',
    });
    await svc.adminUpdate('success-stories', 'story-1', { seo: untouched });
    expect(state.seo).toMatchObject({
      seoTitle: '',
      metaDescription: '',
      canonicalUrl: null,
      ogTitle: null,
    });
    const detail = (await svc.adminDetail('success-stories', 'story-1')) as {
      seo: Row;
    };
    expect(detail.seo).toMatchObject({
      seoTitle: story.title,
      metaDescription: 'A fictional journey from one campus to another.',
      source: { title: 'fallback', description: 'fallback' },
    });
  });

  /* CON-C11 and CON-M1, for a consultant. */
  it('gives a consultant’s page the title written without a description', async () => {
    const consultant = {
      id: 'consultant-1',
      name: 'Demo Advisers',
      slug: 'demo-advisers',
      shortDescription: 'Fictional advisers for local layout checks.',
      locations: [],
      services: [],
      languages: [],
      countries: [],
    };
    const { svc, state } = world(consultant);
    await svc.adminUpdate('consultants', 'consultant-1', {
      name: 'Demo Advisers',
      seo: untouched,
    });
    expect(state.seoWrites).toBe(0);
    await svc.adminUpdate('consultants', 'consultant-1', {
      seo: { ...untouched, seoTitle: 'Demo Advisers, Delhi' },
    });
    const detail = (await svc.adminDetail('consultants', 'consultant-1')) as {
      seo: Row;
    };
    expect(detail.seo).toMatchObject({
      seoTitle: 'Demo Advisers, Delhi',
      metaDescription: 'Fictional advisers for local layout checks.',
      source: { title: 'manual', description: 'fallback' },
    });
  });

  it('keeps a robots choice even with no text written', async () => {
    const { svc, state } = world(story);
    await svc.adminUpdate('success-stories', 'story-1', {
      seo: { ...untouched, robotsIndex: false },
    });
    expect(state.seo).toMatchObject({ robotsIndex: false, seoTitle: '' });
  });
});
