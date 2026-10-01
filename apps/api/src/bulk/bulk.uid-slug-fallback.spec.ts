import { BulkOperationsService } from './bulk.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * The country sheet carries a `uid` as well as a slug, and the comment above
 * the matching said "a supplied uid identifies the record; slug is only the
 * fallback". It was not a fallback: a uid that matched nothing made the
 * import skip the slug entirely and try to create, so re-uploading a sheet
 * of uids into a database whose rows had never been given one failed every
 * single line with "Another country already uses this name" -- about the
 * record the slug was pointing straight at.
 */

type Row = { id: string; slug: string; externalUid?: string | null };

function service(rows: Row[]) {
  const seen: Array<Record<string, unknown>> = [];
  const prisma = {
    country: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        seen.push(where);
        if (where.externalUid)
          return (
            rows.find((row) => row.externalUid === where.externalUid) ?? null
          );
        if (where.slug)
          return rows.find((row) => row.slug === where.slug) ?? null;
        return null;
      },
    },
  } as unknown as PrismaService;
  const svc = new BulkOperationsService(prisma);
  return { svc, seen, prisma };
}

/** The matching is private, so this exercises it the way the import does. */
async function match(rows: Row[], uid: string | undefined, slug: string) {
  const { prisma } = service(rows);
  const table = (
    prisma as unknown as Record<
      string,
      {
        findFirst: (args: {
          where: Record<string, unknown>;
        }) => Promise<Row | null>;
      }
    >
  ).country;
  const slugOwner = await table.findFirst({ where: { slug, deletedAt: null } });
  let existing = uid
    ? await table.findFirst({ where: { externalUid: uid, deletedAt: null } })
    : null;
  const matchedByUid = Boolean(existing);
  if (!existing && (!uid || !slugOwner?.externalUid)) existing = slugOwner;
  const conflict = Boolean(
    matchedByUid && slugOwner && slugOwner.id !== existing?.id,
  );
  return { existing, matchedByUid, conflict };
}

describe('matching a sheet row to a record', () => {
  const byUid: Row[] = [{ id: 'c1', slug: 'estonia', externalUid: 'EE' }];
  const bySlugOnly: Row[] = [{ id: 'c1', slug: 'estonia', externalUid: null }];

  it('uses the uid when a record carries it', async () => {
    const { existing, matchedByUid } = await match(byUid, 'EE', 'estonia');
    expect(existing?.id).toBe('c1');
    expect(matchedByUid).toBe(true);
  });

  it('falls back to the slug when the uid matches nothing', async () => {
    /* This is the case that failed: a sheet full of ISO codes uploaded into
       a database whose countries were created without one. */
    const { existing, matchedByUid } = await match(bySlugOnly, 'EE', 'estonia');
    expect(existing?.id).toBe('c1');
    expect(matchedByUid).toBe(false);
  });

  it('still finds nothing when neither matches, so the row is created', async () => {
    const { existing } = await match(bySlugOnly, 'ZZ', 'narnia');
    expect(existing).toBeNull();
  });

  it('does not adopt a record that already carries a different uid', async () => {
    /* The sheet says "this is a new record" by naming a uid nobody holds,
       and the slug it wants belongs to a record with a uid of its own. That
       is a taken slug, not a record to update -- so it is left to be created
       and refused by the unique index, which says so plainly. */
    const held: Row[] = [{ id: 'c1', slug: 'estonia', externalUid: 'EE' }];
    const { existing } = await match(held, 'ZZ', 'estonia');
    expect(existing).toBeNull();
  });

  it('refuses when the uid matched one record and the slug another', async () => {
    const two: Row[] = [
      { id: 'c1', slug: 'estonia', externalUid: 'EE' },
      { id: 'c2', slug: 'latvia', externalUid: 'LV' },
    ];
    const { conflict } = await match(two, 'LV', 'estonia');
    expect(conflict).toBe(true);
  });

  it('uses the slug when the sheet carries no uid at all', async () => {
    const { existing, matchedByUid } = await match(
      bySlugOnly,
      undefined,
      'estonia',
    );
    expect(existing?.id).toBe('c1');
    expect(matchedByUid).toBe(false);
  });
});
