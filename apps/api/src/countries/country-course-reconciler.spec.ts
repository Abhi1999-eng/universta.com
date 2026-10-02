import { reconcileCountryCourses } from './country-course-reconciler';
import { DERIVED, EDITORIAL } from './country-taxonomy-reconciler';
import type { PrismaClient } from '../generated/prisma/client';

/**
 * The link the chain was missing. A destination's subjects are worked out
 * from its course mappings and its tuition from the offerings behind them,
 * but nothing ever created the mapping itself -- so a university could
 * teach a course in a country the catalogue never connected it to.
 *
 * A country offers a course when one of its published universities has a
 * published offering for it. Nothing else makes that true.
 */
type Stored = {
  id: string;
  countryId: string;
  source: string;
  deletedAt: Date | null;
};

function db(offeringCountries: string[], stored: Stored[] = []) {
  const created: unknown[] = [];
  const updates: Array<{ ids: string[]; data: Record<string, unknown> }> = [];
  return {
    created,
    updates,
    prisma: {
      universityCourseOffering: {
        findMany: async () =>
          offeringCountries.map((countryId) => ({ university: { countryId } })),
      },
      countryCourse: {
        findMany: async () => stored,
        createMany: async ({ data }: { data: unknown[] }) => {
          created.push(...data);
          return { count: data.length };
        },
        updateMany: async ({
          where,
          data,
        }: {
          where: { id: { in: string[] } };
          data: Record<string, unknown>;
        }) => {
          updates.push({ ids: where.id.in, data });
          return { count: where.id.in.length };
        },
      },
    } as unknown as PrismaClient,
  };
}

const row = (
  countryId: string,
  source = DERIVED,
  deletedAt: Date | null = null,
): Stored => ({ id: `cc-${countryId}`, countryId, source, deletedAt });

describe('working a course’s destinations out from its offerings', () => {
  it('maps the country a published offering sits in', async () => {
    const { prisma, created } = db(['india']);
    const change = await reconcileCountryCourses(prisma, 'btech');
    expect(change.added).toBe(1);
    expect(created[0]).toMatchObject({
      countryId: 'india',
      courseId: 'btech',
      source: DERIVED,
    });
  });

  it('leaves the figures unset, for the tuition pass to fill', async () => {
    const { prisma, created } = db(['india']);
    await reconcileCountryCourses(prisma, 'btech');
    /* Naming a price here would be inventing one; the row says only that
       the course is taught, and the tuition reconciler runs next. */
    expect(created[0]).toMatchObject({ tuitionIsOverride: false });
  });

  it('maps a country once however many universities teach there', async () => {
    const { prisma, created } = db(['india', 'india', 'india']);
    const change = await reconcileCountryCourses(prisma, 'btech');
    expect(change.added).toBe(1);
    expect(created).toHaveLength(1);
  });

  it('maps every country that teaches it', async () => {
    const { prisma, created } = db(['india', 'germany']);
    await reconcileCountryCourses(prisma, 'btech');
    expect(created.map((entry: any) => entry.countryId).sort()).toEqual([
      'germany',
      'india',
    ]);
  });

  it('adds nothing twice', async () => {
    const { prisma, created } = db(['india'], [row('india')]);
    const change = await reconcileCountryCourses(prisma, 'btech');
    expect(change.added).toBe(0);
    expect(created).toHaveLength(0);
  });

  it('sets aside a derived row whose last offering has gone', async () => {
    const { prisma, updates } = db([], [row('india')]);
    const change = await reconcileCountryCourses(prisma, 'btech');
    expect(change.removed).toBe(1);
    expect(updates[0]?.ids).toEqual(['cc-india']);
    expect(updates[0]?.data.deletedAt).toBeInstanceOf(Date);
  });

  it('never removes what an editor meant', async () => {
    const { prisma, updates } = db([], [row('india', EDITORIAL)]);
    const change = await reconcileCountryCourses(prisma, 'btech');
    expect(change.removed).toBe(0);
    expect(updates).toHaveLength(0);
  });

  it('keeps an editorial row even when the offerings agree with it', async () => {
    const { prisma, created, updates } = db(
      ['india'],
      [row('india', EDITORIAL)],
    );
    const change = await reconcileCountryCourses(prisma, 'btech');
    expect(change.added).toBe(0);
    expect(created).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });

  it('brings back a row that was set aside when the offering returns', async () => {
    const { prisma, created, updates } = db(
      ['india'],
      [row('india', DERIVED, new Date())],
    );
    const change = await reconcileCountryCourses(prisma, 'btech');
    /* Created again it cannot be -- the pair is unique and the row still
       holds the editor's intake months and visa notes. */
    expect(created).toHaveLength(0);
    expect(change.revived).toBe(1);
    expect(updates[0]?.data).toMatchObject({
      deletedAt: null,
      status: 'ACTIVE',
      source: DERIVED,
    });
  });

  it('reasserts a withdrawn editorial row as derived, not as the claim', async () => {
    const { prisma, updates } = db(
      ['india'],
      [row('india', EDITORIAL, new Date())],
    );
    const change = await reconcileCountryCourses(prisma, 'btech');
    expect(change.revived).toBe(1);
    /* The editor withdrew their claim and that stands. What comes back is
       the catalogue's own statement, and it will leave with the last
       offering rather than needing them to remove it again. */
    expect(updates[0]?.data).toMatchObject({ source: DERIVED });
  });

  it('reports both the destination gained and the one lost', async () => {
    const { prisma } = db(['germany'], [row('india')]);
    const change = await reconcileCountryCourses(prisma, 'btech');
    /* A subject should disappear with its last course as readily as it
       appears with the first, so the caller has to read both again. */
    expect(change.touched.sort()).toEqual(['germany', 'india']);
  });

  it('does nothing at all when nothing teaches the course', async () => {
    const { prisma, created, updates } = db([]);
    const change = await reconcileCountryCourses(prisma, 'btech');
    expect(change).toMatchObject({ added: 0, revived: 0, removed: 0 });
    expect(created).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });
});
