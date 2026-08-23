import type { PrismaClient } from '../generated/prisma/client';

/**
 * Canonical reference continents are deliberately reconciled by every live
 * natural identifier, not only by slug. Older deployments can have the same
 * code under a previous name or slug; a slug-only upsert would then attempt a
 * conflicting create on the code+deletedKey unique index.
 */
export const FOUNDATION_CONTINENTS = [
  ['Europe', 'europe', 'EU'],
  ['North America', 'north-america', 'NA'],
  ['Asia', 'asia', 'AS'],
  ['Australia & New Zealand', 'australia-new-zealand', 'ANZ'],
  ['Middle East', 'middle-east', 'ME'],
  ['Africa', 'africa', 'AF'],
  ['South America', 'south-america', 'SA'],
] as const;

type ContinentSeedClient = Pick<PrismaClient, 'continent'>;

/**
 * Preserve an existing live master record, including its editorial fields and
 * Country relations. Deleted records are intentionally not revived: their
 * deletedKey has released live uniqueness, so a fresh canonical row may be
 * created just as the Admin delete/recreate workflow promises.
 */
export async function reconcileFoundationContinents(
  prisma: ContinentSeedClient,
  adminId: string,
) {
  for (const [name, slug, code] of FOUNDATION_CONTINENTS) {
    const matches = await prisma.continent.findMany({
      where: {
        deletedAt: null,
        OR: [{ name }, { slug }, { code }],
      },
      select: { id: true, name: true, slug: true, code: true },
    });

    if (matches.length > 1) {
      throw new Error(
        `Cannot reconcile canonical continent ${code}: multiple live records match its name, slug, or code.`,
      );
    }

    if (matches.length === 1) continue;

    await prisma.continent.create({
      data: {
        name,
        slug,
        code,
        status: 'ACTIVE',
        createdByUserId: adminId,
        updatedByUserId: adminId,
      },
    });
  }
}
