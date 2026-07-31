import {
  PAGE_TEMPLATE_DEFINITIONS,
  describeRegistration,
  registerWebsiteBuilderRecords,
} from './register-website-pages';
import { WEBSITE_PAGES } from './website-pages.service';

/** This registration runs on every deployment, against populated production
 * databases. The tests below pin the properties that make that safe: it only
 * ever creates, it converges on a second run, and it covers the whole registry
 * so no approved page falls back to "Create editable page". */

type Row = Record<string, unknown>;

/** Minimal in-memory stand-in. Deliberately records every call so a test can
 * assert on what was *not* done, which is the point here. */
function fakeClient(seed: { pages?: Row[]; templates?: Row[] } = {}) {
  const pages = [...(seed.pages ?? [])];
  const templates = [...(seed.templates ?? [])];
  const calls: string[] = [];

  const match = (rows: Row[], field: string, where: Row) => {
    calls.push(`findFirst:${field}:${JSON.stringify(where)}`);
    return (
      rows.find((row) =>
        Object.entries(where).every(([key, value]) => row[key] === value),
      ) ?? null
    );
  };

  return {
    pages,
    templates,
    calls,
    page: {
      findFirst: async ({ where }: { where: Row }) =>
        match(pages, 'page', where) as { id: string } | null,
      create: async ({ data }: { data: Row }) => {
        calls.push('page.create');
        const row = { id: `page-${pages.length + 1}`, ...data };
        pages.push(row);
        return row;
      },
    },
    pageTemplate: {
      findFirst: async ({ where }: { where: Row }) =>
        match(templates, 'template', where) as { id: string } | null,
      create: async ({ data }: { data: Row }) => {
        calls.push('pageTemplate.create');
        const row = { id: `tpl-${templates.length + 1}`, ...data };
        templates.push(row);
        return row;
      },
    },
  };
}

const expectedPageCount = WEBSITE_PAGES.filter((entry) =>
  Boolean(entry.pageSlug),
).length;

describe('registerWebsiteBuilderRecords', () => {
  it('registers a backing record for every approved page on an empty database', async () => {
    const client = fakeClient();
    const result = await registerWebsiteBuilderRecords(client, 'admin-1');

    expect(result.pagesCreated).toHaveLength(expectedPageCount);
    expect(result.templatesCreated).toHaveLength(
      PAGE_TEMPLATE_DEFINITIONS.length,
    );
    expect({
      pages: result.pagesExisting,
      templates: result.templatesExisting,
    }).toEqual({ pages: 0, templates: 0 });
  });

  it('leaves every registry entry with a backing record, so none falls back to "Create editable page"', async () => {
    const client = fakeClient();
    await registerWebsiteBuilderRecords(client, 'admin-1');

    const slugs = new Set(client.pages.map((page) => page.slug));
    const keys = new Set(client.templates.map((tpl) => tpl.templateKey));
    const unbacked = WEBSITE_PAGES.filter((entry) =>
      entry.templateKey
        ? !keys.has(entry.templateKey)
        : !slugs.has(entry.pageSlug),
    ).map((entry) => entry.key);

    expect(unbacked).toEqual([]);
  });

  it('creates nothing on a second run', async () => {
    const client = fakeClient();
    await registerWebsiteBuilderRecords(client, 'admin-1');
    const countAfterFirst = {
      pages: client.pages.length,
      templates: client.templates.length,
    };

    const second = await registerWebsiteBuilderRecords(client, 'admin-1');

    expect(second.pagesCreated).toEqual([]);
    expect(second.templatesCreated).toEqual([]);
    expect({
      pages: client.pages.length,
      templates: client.templates.length,
    }).toEqual(countAfterFirst);
  });

  it('never updates or deletes an existing record', async () => {
    const client = fakeClient();
    await registerWebsiteBuilderRecords(client, 'admin-1');
    client.calls.length = 0;

    await registerWebsiteBuilderRecords(client, 'admin-1');

    // No update/delete method is even reachable: the client exposes only
    // findFirst and create, so a regression that reintroduces an upsert would
    // fail here rather than silently overwriting an admin's content.
    expect(client.calls.filter((call) => call.includes('create'))).toEqual([]);
  });

  it('preserves a page an admin has customised', async () => {
    const entry = WEBSITE_PAGES.find((page) => page.pageSlug)!;
    const customised = {
      id: 'existing',
      slug: entry.pageSlug,
      title: 'Renamed by the client',
      status: 'DRAFT',
    };
    const client = fakeClient({ pages: [customised] });

    await registerWebsiteBuilderRecords(client, 'admin-1');

    expect(client.pages.find((page) => page.slug === entry.pageSlug)).toEqual(
      customised,
    );
  });

  it('preserves a template whose default sections were edited', async () => {
    const template = PAGE_TEMPLATE_DEFINITIONS[0];
    const customised = {
      id: 'existing',
      templateKey: template.templateKey,
      name: 'Client layout',
      defaultSectionsJson: [{ sectionKey: 'client-only', displayOrder: 0 }],
    };
    const client = fakeClient({ templates: [customised] });

    const result = await registerWebsiteBuilderRecords(client, 'admin-1');

    expect(
      client.templates.find((row) => row.templateKey === template.templateKey),
    ).toEqual(customised);
    expect(result.templatesCreated).not.toContain(template.templateKey);
  });

  it('skips a soft-deleted row rather than colliding on its unique key', async () => {
    // slug and templateKey are unique in the schema, so a soft-deleted row
    // still occupies the key. Creating would throw; resurrecting would undo a
    // deliberate deletion. Skipping is the only safe move.
    const entry = WEBSITE_PAGES.find((page) => page.pageSlug)!;
    const client = fakeClient({
      pages: [
        { id: 'gone', slug: entry.pageSlug, deletedAt: new Date('2026-01-01') },
      ],
    });

    const result = await registerWebsiteBuilderRecords(client, 'admin-1');

    expect(result.pagesCreated).not.toContain(entry.pageSlug);
    expect(
      client.pages.filter((page) => page.slug === entry.pageSlug),
    ).toHaveLength(1);
  });

  it('publishes new registrations, because the route they frame is already live', async () => {
    const client = fakeClient();
    await registerWebsiteBuilderRecords(client, 'admin-1');

    const unpublished = client.pages
      .filter((page) => page.status !== 'PUBLISHED')
      .map((page) => page.slug);
    expect(unpublished).toEqual([]);
  });

  it('attributes new records to the seeding admin', async () => {
    const client = fakeClient();
    await registerWebsiteBuilderRecords(client, 'admin-1');

    expect(
      client.pages.every((page) => page.createdByUserId === 'admin-1'),
    ).toBe(true);
    expect(
      client.templates.every((tpl) => tpl.updatedByUserId === 'admin-1'),
    ).toBe(true);
  });

  it('works without an actor, rather than writing an invalid user id', async () => {
    const client = fakeClient();
    await registerWebsiteBuilderRecords(client);

    expect(client.pages.every((page) => page.createdByUserId === null)).toBe(
      true,
    );
  });
});

describe('PAGE_TEMPLATE_DEFINITIONS', () => {
  it('defines exactly the templates the registry references', async () => {
    const referenced = WEBSITE_PAGES.map((entry) => entry.templateKey).filter(
      Boolean,
    );
    const defined = PAGE_TEMPLATE_DEFINITIONS.map((tpl) => tpl.templateKey);

    expect([...defined].sort()).toEqual([...referenced].sort());
  });

  it('gives every template at least one section to render', async () => {
    for (const template of PAGE_TEMPLATE_DEFINITIONS) {
      expect({
        key: template.templateKey,
        sections: template.sections.length > 0,
      }).toEqual({ key: template.templateKey, sections: true });
    }
  });

  it('keeps section keys unique within a template', async () => {
    for (const template of PAGE_TEMPLATE_DEFINITIONS) {
      const keys = template.sections.map(([sectionKey]) => sectionKey);
      expect({ key: template.templateKey, unique: new Set(keys).size }).toEqual(
        { key: template.templateKey, unique: keys.length },
      );
    }
  });
});

describe('describeRegistration', () => {
  it('reports no changes when everything is already registered', () => {
    expect(
      describeRegistration({
        pagesCreated: [],
        pagesExisting: 20,
        templatesCreated: [],
        templatesExisting: 13,
      }),
    ).toContain('no changes');
  });

  it('reports what it created on a first run', () => {
    const message = describeRegistration({
      pagesCreated: ['home'],
      pagesExisting: 19,
      templatesCreated: [],
      templatesExisting: 13,
    });
    expect(message).toContain('1 page(s)');
    expect(message).not.toContain('no changes');
  });
});
