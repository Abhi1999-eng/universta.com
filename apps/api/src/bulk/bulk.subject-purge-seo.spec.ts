import { bulkResource, type PurgeTx } from './bulk-resources';

/**
 * A subject deleted for good from the bulk page takes its SEO rows with it:
 * its own, its specializations' and its level pages'. The level pages
 * cascade in the schema, but an SEO row has no foreign key, and one left
 * behind still counted as a use of its image, which then could not be
 * archived.
 */

const subjects = bulkResource('subjects');

function fakeTx() {
  const deletes: Array<[string, unknown]> = [];
  const table = (name: string, rows: Array<{ id: string }> = []) => ({
    findMany: async () => rows,
    deleteMany: async ({ where }: { where: unknown }) => {
      deletes.push([name, where]);
      return { count: 0 };
    },
  });
  const tx = {
    subSubject: table('subSubject', [{ id: 'ai' }, { id: 'ds' }]),
    subjectLevelPage: table('subjectLevelPage', [
      { id: 'page-ug' },
      { id: 'page-ai-pg' },
    ]),
    seoMetadata: table('seoMetadata'),
    countrySubject: table('countrySubject'),
    countrySubSubject: table('countrySubSubject'),
  };
  return { tx: tx as unknown as PurgeTx, deletes };
}

describe('purging subjects in bulk', () => {
  it("removes the subjects', their specializations' and their level pages' SEO rows first", async () => {
    const { tx, deletes } = fakeTx();
    await subjects.purgeChildren!(tx, ['cs']);
    expect(deletes[0]).toEqual([
      'seoMetadata',
      {
        OR: [
          { ownerType: 'SUBJECT', ownerId: { in: ['cs'] } },
          { ownerType: 'SUB_SUBJECT', ownerId: { in: ['ai', 'ds'] } },
          {
            ownerType: 'SUBJECT_LEVEL_PAGE',
            ownerId: { in: ['page-ug', 'page-ai-pg'] },
          },
        ],
      },
    ]);
    /* Before the specializations go, while their ids can still be read. */
    expect(deletes.map(([name]) => name)).toEqual([
      'seoMetadata',
      'countrySubject',
      'countrySubSubject',
      'subSubject',
    ]);
  });
});
