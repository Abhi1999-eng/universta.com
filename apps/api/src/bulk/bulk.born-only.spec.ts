import { bulkResource } from './bulk-resources';

/**
 * Why the reconcile hook had to learn whether it followed a create.
 *
 * A destination starts offering every field and the editor narrows it
 * down. The import path writes through the same hook on update as on
 * create, so attaching the defaults unconditionally would put back
 * everything that had been narrowed away, every time the sheet was
 * re-imported -- silently, and reported as a successful update.
 */

/** A transaction stand-in that records what the hook reached for.
 *
 * `findMany` answers with two rows so the attach has something to write;
 * answering with none would make it return early and the test would pass
 * for the wrong reason. */
function tx() {
  const touched: string[] = [];
  const table = (name: string) =>
    new Proxy(
      {},
      {
        get: (_t, method: string) => async (args: unknown) => {
          touched.push(name);
          if (method === 'findMany')
            return [{ id: `${name}-a` }, { id: `${name}-b` }];
          const data = (args as { data?: unknown[] } | undefined)?.data;
          return { count: Array.isArray(data) ? data.length : 0 };
        },
      },
    );
  return {
    touched,
    client: new Proxy(
      {},
      {
        get: (_target, prop: string) => table(prop),
      },
    ),
  };
}

const EMPTY_COUNTRY_RELATIONS = {
  subjects: { kind: 'absent' },
  subSubjects: { kind: 'absent' },
  tags: { kind: 'absent' },
  faqs: { kind: 'absent' },
  sections: {},
  cost: null,
  work: null,
  language: null,
  statistics: null,
};

describe('a country arriving through the sheet', () => {
  it('takes the default subjects when the row is new', async () => {
    const { touched, client } = tx();
    await bulkResource('countries').reconcile!(
      client,
      'c-1',
      EMPTY_COUNTRY_RELATIONS,
      true,
    );
    expect(touched).toContain('subject');
    expect(touched).toContain('countrySubject');
  });

  it('takes only what its own `subject` cell names, when it names any', async () => {
    /* "By default" is what happens when nothing was said. A row that lists
       two subjects and comes back with thirty has been overruled. */
    const { touched, client } = tx();
    await bulkResource('countries').reconcile!(
      client,
      'c-1',
      {
        ...EMPTY_COUNTRY_RELATIONS,
        subjects: { kind: 'value', value: ['s-1', 's-2'] },
      },
      true,
    );
    expect(touched).not.toContain('subject');
  });

  it('takes nothing on a re-import, so a narrowing survives', async () => {
    const { touched, client } = tx();
    await bulkResource('countries').reconcile!(
      client,
      'c-1',
      EMPTY_COUNTRY_RELATIONS,
      false,
    );
    expect(touched).not.toContain('subject');
  });

  it('treats an unstated mode as not-new, which is the safe way round', async () => {
    const { touched, client } = tx();
    await bulkResource('countries').reconcile!(
      client,
      'c-1',
      EMPTY_COUNTRY_RELATIONS,
    );
    expect(touched).not.toContain('subject');
  });
});

describe('a subject arriving through the sheet', () => {
  const relations = { status: 'DRAFT', rows: [] };

  it('reaches every destination when the row is new', async () => {
    const { touched, client } = tx();
    await bulkResource('subjects').reconcile!(client, 's-1', relations, true);
    expect(touched).toContain('country');
    expect(touched).toContain('countrySubject');
  });

  it('reaches none of them on a re-import', async () => {
    const { touched, client } = tx();
    await bulkResource('subjects').reconcile!(client, 's-1', relations, false);
    expect(touched).not.toContain('country');
  });
});

/**
 * The attach again, once the row has committed.
 *
 * A country and a subject imported at the same moment each attach
 * themselves to everything they can see, and inside their own transactions
 * neither can see the other -- so the pair is written by nobody, and
 * nothing later would write it. After the commit, whichever landed second
 * sees the first.
 */
describe('after the row has committed', () => {
  it('attaches a new country again, where it can see what landed meanwhile', async () => {
    const { touched, client } = tx();
    await bulkResource('countries').afterCommit!(
      client as never,
      'c-1',
      EMPTY_COUNTRY_RELATIONS,
      true,
    );
    expect(touched).toContain('subject');
    expect(touched).toContain('countrySubject');
  });

  it('does the same for a row that says "All subjects", new or not', async () => {
    const { touched, client } = tx();
    await bulkResource('countries').afterCommit!(
      client as never,
      'c-1',
      { ...EMPTY_COUNTRY_RELATIONS, subjects: { kind: 'all' } },
      false,
    );
    expect(touched).toContain('countrySubject');
  });

  it('leaves a re-imported country alone, so a narrowing survives', async () => {
    const { touched, client } = tx();
    await bulkResource('countries').afterCommit!(
      client as never,
      'c-1',
      EMPTY_COUNTRY_RELATIONS,
      false,
    );
    expect(touched).toEqual([]);
  });

  it('leaves a new country that named its own subjects alone', async () => {
    const { touched, client } = tx();
    await bulkResource('countries').afterCommit!(
      client as never,
      'c-1',
      {
        ...EMPTY_COUNTRY_RELATIONS,
        subjects: { kind: 'value', value: ['s-1'] },
      },
      true,
    );
    expect(touched).toEqual([]);
  });

  it('attaches a new subject again, and not a re-imported one', async () => {
    const born = tx();
    await bulkResource('subjects').afterCommit!(
      born.client as never,
      's-1',
      { status: 'DRAFT', rows: [] },
      true,
    );
    expect(born.touched).toContain('country');

    const again = tx();
    await bulkResource('subjects').afterCommit!(
      again.client as never,
      's-1',
      { status: 'DRAFT', rows: [] },
      false,
    );
    expect(again.touched).toEqual([]);
  });
});
