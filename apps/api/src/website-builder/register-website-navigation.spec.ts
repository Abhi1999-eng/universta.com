import {
  NAVIGATION_DEFINITIONS,
  describeNavigationRegistration,
  registerWebsiteNavigation,
} from './register-website-navigation';
import { WEBSITE_PAGES } from './website-pages.service';

/** This runs on every deploy against a live database that may hold menus the
 * client has spent time arranging. The tests below pin the line between
 * "repair an empty header" and "overwrite someone's work". */

type Row = Record<string, unknown>;

function fakeClient(seed: { menus?: Row[]; items?: Row[] } = {}) {
  const menus = [...(seed.menus ?? [])];
  const items = [...(seed.items ?? [])];
  const calls: string[] = [];

  return {
    menus,
    items,
    calls,
    navigationMenu: {
      findFirst: async ({ where }: { where: Row }) =>
        (menus.find((row) => row.menuKey === where.menuKey) ?? null) as {
          id: string;
        } | null,
      create: async ({ data }: { data: Row }) => {
        calls.push(`menu.create:${String(data.menuKey)}`);
        const row = { id: `menu-${menus.length + 1}`, ...data };
        menus.push(row);
        return row;
      },
    },
    navigationItem: {
      count: async ({ where }: { where: Row }) =>
        items.filter((row) => row.menuId === where.menuId).length,
      create: async ({ data }: { data: Row }) => {
        calls.push(`item.create:${String(data.label)}`);
        const row = { id: `item-${items.length + 1}`, ...data };
        items.push(row);
        return row;
      },
    },
  };
}

const headerDefinition = NAVIGATION_DEFINITIONS.find(
  (menu) => menu.menuKey === 'header',
)!;

describe('registerWebsiteNavigation', () => {
  it('creates header and footer menus on a database that has none', async () => {
    const client = fakeClient();

    const result = await registerWebsiteNavigation(client);

    expect(result.menusCreated).toEqual(['header', 'footer']);
    expect(result.menusPreserved).toEqual([]);
    expect(result.itemsCreated).toBeGreaterThan(0);
    expect(client.menus.map((menu) => menu.menuKey)).toEqual([
      'header',
      'footer',
    ]);
  });

  it('gives the header the approved top-level destinations', async () => {
    const client = fakeClient();
    await registerWebsiteNavigation(client);

    const headerId = client.menus.find((menu) => menu.menuKey === 'header')!.id;
    const topLevel = client.items
      .filter((item) => item.menuId === headerId && item.parentItemId === null)
      .map((item) => item.label);

    expect(topLevel).toEqual([
      'Study Destinations',
      'Universities',
      'Courses',
      'Subjects',
      'Scholarships',
      'Consultants',
      'Resources',
      'Contact',
    ]);
  });

  it('never touches a menu an admin has already configured', async () => {
    // The failure this prevents: a deploy quietly replacing the client's
    // curated header with the canonical one.
    const client = fakeClient({
      menus: [
        { id: 'existing-header', menuKey: 'header', name: 'Client Menu' },
      ],
      items: [
        { id: 'their-item', menuId: 'existing-header', label: 'Their Link' },
      ],
    });

    const result = await registerWebsiteNavigation(client);

    expect(result.menusPreserved).toContain('header');
    expect(result.menusPopulated).not.toContain('header');
    expect(
      client.items.filter((item) => item.menuId === 'existing-header'),
    ).toEqual([
      { id: 'their-item', menuId: 'existing-header', label: 'Their Link' },
    ]);
    expect(
      client.calls.filter((call) => call.startsWith('menu.create:header')),
    ).toEqual([]);
  });

  it('populates a menu that exists but is empty', async () => {
    // An empty menu is the defect, not a preference: it renders a header with
    // no links at all.
    const client = fakeClient({
      menus: [{ id: 'empty-header', menuKey: 'header', name: 'Primary' }],
    });

    const result = await registerWebsiteNavigation(client);

    expect(result.menusPopulated).toContain('header');
    expect(result.menusCreated).not.toContain('header');
    expect(
      client.items.filter((item) => item.menuId === 'empty-header').length,
    ).toBeGreaterThan(0);
  });

  it('preserves one menu while repairing the other', async () => {
    const client = fakeClient({
      menus: [{ id: 'configured-footer', menuKey: 'footer', name: 'Footer' }],
      items: [{ id: 'f1', menuId: 'configured-footer', label: 'Their Footer' }],
    });

    const result = await registerWebsiteNavigation(client);

    expect(result.menusCreated).toEqual(['header']);
    expect(result.menusPreserved).toEqual(['footer']);
  });

  it('creates nothing on a second run', async () => {
    const client = fakeClient();
    await registerWebsiteNavigation(client);
    const afterFirst = {
      menus: client.menus.length,
      items: client.items.length,
    };
    client.calls.length = 0;

    const second = await registerWebsiteNavigation(client);

    expect(second.menusCreated).toEqual([]);
    expect(second.menusPopulated).toEqual([]);
    expect(second.menusPreserved).toEqual(['header', 'footer']);
    expect({ menus: client.menus.length, items: client.items.length }).toEqual(
      afterFirst,
    );
    expect(client.calls).toEqual([]);
  });

  it('exposes no update or delete path at all', async () => {
    // The client surface deliberately offers only findFirst/count/create, so a
    // regression that reintroduces the demo seed's in-place update would fail
    // to compile rather than silently overwrite a client's menu.
    const client = fakeClient();
    expect(Object.keys(client.navigationMenu).sort()).toEqual([
      'create',
      'findFirst',
    ]);
    expect(Object.keys(client.navigationItem).sort()).toEqual([
      'count',
      'create',
    ]);
  });

  it('nests children under their heading rather than flattening them', async () => {
    const client = fakeClient();
    await registerWebsiteNavigation(client);

    const resources = client.items.find(
      (item) => item.label === 'Resources',
    ) as Row;
    const children = client.items.filter(
      (item) => item.parentItemId === resources.id,
    );
    expect(children.map((child) => child.label)).toEqual([
      'Success Stories',
      'Testimonials',
      'Events',
      'Careers',
      'FAQ',
    ]);
  });

  it('marks a grouping heading as a non-link so it renders no dead href', async () => {
    const client = fakeClient();
    await registerWebsiteNavigation(client);

    const resources = client.items.find((item) => item.label === 'Resources')!;
    expect({
      linkType: resources.linkType,
      customUrl: resources.customUrl,
    }).toEqual({ linkType: 'NONE', customUrl: null });
  });

  it('orders siblings from one, so the header renders in the approved order', async () => {
    const client = fakeClient();
    await registerWebsiteNavigation(client);

    const headerId = client.menus.find((menu) => menu.menuKey === 'header')!.id;
    const orders = client.items
      .filter((item) => item.menuId === headerId && item.parentItemId === null)
      .map((item) => item.displayOrder);
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('NAVIGATION_DEFINITIONS', () => {
  it('links only to routes the site actually serves', async () => {
    // A navigation entry pointing at a route that does not exist is a 404 in
    // the header of every page, so every URL is checked against the registry
    // of approved public paths.
    const approved = new Set(WEBSITE_PAGES.map((entry) => entry.publicPath));
    const urls: string[] = [];
    const walk = (nodes: (typeof NAVIGATION_DEFINITIONS)[number]['nodes']) => {
      for (const node of nodes) {
        if (node.url) urls.push(node.url);
        if (node.children) walk(node.children);
      }
    };
    for (const menu of NAVIGATION_DEFINITIONS) walk(menu.nodes);

    const unknown = urls.filter((url) => !approved.has(url));
    expect(unknown).toEqual([]);
  });

  it('covers every destination the client asked to see in the header', async () => {
    const labels = headerDefinition.nodes.map((node) => node.label);
    for (const required of [
      'Study Destinations',
      'Universities',
      'Courses',
      'Subjects',
      'Scholarships',
      'Consultants',
      'Resources',
      'Contact',
    ]) {
      expect(labels).toContain(required);
    }
  });

  it('keeps sibling labels unique within a menu', async () => {
    for (const menu of NAVIGATION_DEFINITIONS) {
      const siblings = (nodes: NavNodeList): void => {
        const labels = nodes.map((node) => node.label);
        expect({ menu: menu.menuKey, unique: new Set(labels).size }).toEqual({
          menu: menu.menuKey,
          unique: labels.length,
        });
        for (const node of nodes) if (node.children) siblings(node.children);
      };
      siblings(menu.nodes);
    }
  });
});

type NavNodeList = (typeof NAVIGATION_DEFINITIONS)[number]['nodes'];

describe('describeNavigationRegistration', () => {
  it('reports no changes when both menus are configured', () => {
    expect(
      describeNavigationRegistration({
        menusCreated: [],
        menusPopulated: [],
        menusPreserved: ['header', 'footer'],
        itemsCreated: 0,
      }),
    ).toContain('no changes');
  });

  it('names what it repaired', () => {
    const message = describeNavigationRegistration({
      menusCreated: ['header'],
      menusPopulated: [],
      menusPreserved: ['footer'],
      itemsCreated: 12,
    });
    expect(message).toContain('created header');
    expect(message).toContain('preserved footer');
  });
});
