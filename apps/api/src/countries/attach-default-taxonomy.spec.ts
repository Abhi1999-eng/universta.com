import {
  attachDefaultTaxonomy,
  EDITORIAL,
} from './country-taxonomy-reconciler';

/**
 * What a destination or a field starts life with.
 *
 * The taxonomy seed writes a link from every country to every subject, and
 * the country editor exists to narrow that down. Records born after the
 * seed had none of it: a new country opened on an empty field list, and a
 * new subject reached no destination until somebody attached it by hand.
 */

function client(subjects: string[], countries: string[]) {
  const writes: Array<{
    data: Array<Record<string, unknown>>;
    skipDuplicates?: boolean;
  }> = [];
  const reads: unknown[] = [];
  return {
    writes,
    reads,
    api: {
      subject: {
        findMany: async (args: unknown) => {
          reads.push(args);
          return subjects.map((id) => ({ id }));
        },
      },
      country: {
        findMany: async (args: unknown) => {
          reads.push(args);
          return countries.map((id) => ({ id }));
        },
      },
      countrySubject: {
        createMany: async (args: {
          data: Array<Record<string, unknown>>;
          skipDuplicates?: boolean;
        }) => {
          writes.push(args);
          return { count: args.data.length };
        },
      },
    },
  };
}

describe('a destination being born', () => {
  it('takes every published subject', async () => {
    const c = client(['s-1', 's-2', 's-3'], []);
    const count = await attachDefaultTaxonomy(c.api, { countryId: 'c-1' });
    expect(count).toBe(3);
    expect(c.writes[0].data.map((row) => row.subjectId)).toEqual([
      's-1',
      's-2',
      's-3',
    ]);
    expect(c.writes[0].data.every((row) => row.countryId === 'c-1')).toBe(true);
  });

  it('takes drafts and archived subjects too', async () => {
    /* Filtering to PUBLISHED here would mean a subject published tomorrow
       never reached a country created today, and filtering to live ones
       that a restored subject came back reaching nobody. Every reader
       filters the record's own status, so the link is invisible until it
       should not be. */
    const c = client(['s-1'], []);
    await attachDefaultTaxonomy(c.api, { countryId: 'c-1' });
    expect(c.reads[0]).toEqual({ select: { id: true } });
  });
});

describe('a field being born', () => {
  it('reaches every published destination', async () => {
    const c = client([], ['c-1', 'c-2']);
    const count = await attachDefaultTaxonomy(c.api, { subjectId: 's-9' });
    expect(count).toBe(2);
    expect(c.writes[0].data.map((row) => row.countryId)).toEqual([
      'c-1',
      'c-2',
    ]);
    expect(c.writes[0].data.every((row) => row.subjectId === 's-9')).toBe(true);
  });
});

describe('how the rows are written', () => {
  it('marks them EDITORIAL, which is the value the editor can remove', async () => {
    // DERIVED says a course stands behind the link, which is the sweep's to
    // work out and not something a record is born knowing.
    const c = client(['s-1'], []);
    await attachDefaultTaxonomy(c.api, { countryId: 'c-1' });
    expect(c.writes[0].data.every((row) => row.source === EDITORIAL)).toBe(
      true,
    );
  });

  it('skips duplicates rather than failing the transaction', async () => {
    // A pair may already stand -- a subject created while this one was being
    // written -- and the unique key would otherwise roll the creation back.
    const c = client(['s-1'], []);
    await attachDefaultTaxonomy(c.api, { countryId: 'c-1' });
    expect(c.writes[0].skipDuplicates).toBe(true);
  });

  it('writes nothing, and asks for nothing, when there is nothing to attach', async () => {
    const c = client([], []);
    expect(await attachDefaultTaxonomy(c.api, { countryId: 'c-1' })).toBe(0);
    expect(await attachDefaultTaxonomy(c.api, { subjectId: 's-1' })).toBe(0);
    expect(c.writes).toEqual([]);
  });

  it('leaves specializations alone', async () => {
    /* Attaching every one of them is 190,035 rows for two readers, and the
       pages that list a destination's specializations read them from the
       subject. The client here has no countrySubSubject delegate at all, so
       touching it would throw. */
    const c = client(['s-1', 's-2'], []);
    await expect(
      attachDefaultTaxonomy(c.api, { countryId: 'c-1' }),
    ).resolves.toBe(2);
  });
});
