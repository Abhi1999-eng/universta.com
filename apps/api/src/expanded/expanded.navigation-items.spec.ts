import { ExpandedService } from './expanded.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ExperimentsService } from '../experiments/experiments.service';

/** ISS-019. Before this, a navigation menu could be listed, published and
 * archived, but nothing anywhere let an admin see, add, edit, reorder or
 * remove the links inside it -- the only editing surface was a raw JSON
 * draft textarea, and no endpoint returned or accepted a NavigationItem row
 * even though the model, the public site-chrome query, and the live header
 * and footer all already depended on it.
 *
 * These pin the validation these new methods enforce, each one written
 * because the public tree builder (`navigationTree`) resolves a broken or
 * ambiguous item by silently dropping it from the rendered menu -- exactly
 * the "link vanished with nothing in any log" failure this fix exists to
 * close off, so it has to be caught here instead. */

type Row = Record<string, unknown>;

function fakePrisma(
  seed: { menus?: Row[]; items?: Row[]; pages?: Row[] } = {},
) {
  const menus = seed.menus ?? [
    { id: 'menu-1', menuKey: 'header', status: 'ACTIVE' },
  ];
  const items: Row[] = seed.items ?? [];
  const pages: Row[] = seed.pages ?? [
    {
      id: 'page-1',
      title: 'About',
      slug: 'about',
      status: 'PUBLISHED',
      deletedAt: null,
    },
  ];
  let nextId = 1;

  const matches = (row: Row, where: Row): boolean =>
    Object.entries(where).every(([key, value]) => {
      if (value && typeof value === 'object' && 'in' in value)
        return (value as { in: unknown[] }).in.includes(row[key]);
      if (value && typeof value === 'object' && 'not' in value)
        return row[key] !== value.not;
      if (value && typeof value === 'object' && 'equals' in value)
        return row[key] === value.equals;
      return row[key] === value;
    });

  return {
    navigationMenu: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        menus.find((menu) => menu.id === where.id) ?? null,
    },
    navigationItem: {
      findMany: async ({
        where = {},
        include,
        orderBy,
      }: { where?: Row; include?: Row; orderBy?: Row[] } = {}) => {
        let rows = items.filter((item) => matches(item, where));
        if (orderBy?.length)
          rows = [...rows].sort((a, b) => {
            for (const clause of orderBy) {
              const [field, direction] = Object.entries(clause)[0] as [
                string,
                'asc' | 'desc',
              ];
              const av = (a[field] as number | string | null) ?? '';
              const bv = (b[field] as number | string | null) ?? '';
              if (av < bv) return direction === 'asc' ? -1 : 1;
              if (av > bv) return direction === 'asc' ? 1 : -1;
            }
            return 0;
          });
        if (include?.page)
          rows = rows.map((row) => ({
            ...row,
            page: row.pageId
              ? (pages.find((page) => page.id === row.pageId) ?? null)
              : null,
          }));
        return rows;
      },
      findFirst: async ({ where = {} }: { where?: Row } = {}) =>
        items.find((item) => matches(item, where)) ?? null,
      findUnique: async ({ where }: { where: { id: string } }) =>
        items.find((item) => item.id === where.id) ?? null,
      count: async ({ where = {} }: { where?: Row } = {}) =>
        items.filter((item) => matches(item, where)).length,
      create: async ({ data }: { data: Row }) => {
        const row = {
          id: `item-${nextId++}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        items.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = items.find((item) => item.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const index = items.findIndex((item) => item.id === where.id);
        if (index === -1) throw new Error('not found');
        const [removed] = items.splice(index, 1);
        return removed;
      },
    },
    page: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        pages.find((page) => page.id === where.id) ?? null,
    },
    $transaction: async (ops: Array<Promise<unknown>>) => Promise.all(ops),
  } as unknown as PrismaService;
}

function service(seed?: Parameters<typeof fakePrisma>[0]) {
  return new ExpandedService(fakePrisma(seed), {} as ExperimentsService);
}

describe('ExpandedService navigation items', () => {
  it('rejects a blank label with a message naming the field', async () => {
    const svc = service();
    await expect(
      svc.navigationItemCreate('menu-1', { label: '   ', linkType: 'NONE' }),
    ).rejects.toMatchObject({ response: { code: 'LABEL_REQUIRED' } });
  });

  it('rejects an unknown link type', async () => {
    const svc = service();
    await expect(
      svc.navigationItemCreate('menu-1', { label: 'Home', linkType: 'ANCHOR' }),
    ).rejects.toMatchObject({ response: { code: 'LINK_TYPE_INVALID' } });
  });

  it('requires a page for a PAGE-type item', async () => {
    const svc = service();
    await expect(
      svc.navigationItemCreate('menu-1', { label: 'About', linkType: 'PAGE' }),
    ).rejects.toMatchObject({ response: { code: 'PAGE_REQUIRED' } });
  });

  it('rejects a PAGE target that does not exist', async () => {
    const svc = service();
    await expect(
      svc.navigationItemCreate('menu-1', {
        label: 'About',
        linkType: 'PAGE',
        pageId: 'missing-page',
      }),
    ).rejects.toMatchObject({ response: { code: 'PAGE_NOT_FOUND' } });
  });

  it('accepts a PAGE target that exists', async () => {
    const svc = service();
    const created = await svc.navigationItemCreate('menu-1', {
      label: 'About',
      linkType: 'PAGE',
      pageId: 'page-1',
    });
    expect(created).toMatchObject({ label: 'About', pageId: 'page-1' });
  });

  it('requires a URL for a CUSTOM-type item', async () => {
    const svc = service();
    await expect(
      svc.navigationItemCreate('menu-1', {
        label: 'External',
        linkType: 'CUSTOM',
      }),
    ).rejects.toMatchObject({ response: { code: 'URL_REQUIRED' } });
  });

  it.each([
    'not a url',
    'ftp://example.com',
    'javascript:alert(1)',
    'http://example.com', // must be https, not http
  ])('rejects an invalid custom URL: %s', async (bad) => {
    const svc = service();
    await expect(
      svc.navigationItemCreate('menu-1', {
        label: 'External',
        linkType: 'CUSTOM',
        customUrl: bad,
      }),
    ).rejects.toMatchObject({ response: { code: 'URL_INVALID' } });
  });

  it.each(['/about', 'https://example.com/path'])(
    'accepts a valid custom URL: %s',
    async (good) => {
      const svc = service();
      const created = await svc.navigationItemCreate('menu-1', {
        label: 'External',
        linkType: 'CUSTOM',
        customUrl: good,
      });
      expect(created).toMatchObject({ customUrl: good });
    },
  );

  it('creates a NONE-type item with no target, for a dropdown group', async () => {
    const svc = service();
    const created = await svc.navigationItemCreate('menu-1', {
      label: 'Resources',
      linkType: 'NONE',
    });
    expect(created).toMatchObject({
      linkType: 'NONE',
      pageId: null,
      customUrl: null,
    });
  });

  it('rejects a duplicate label within the same menu and parent', async () => {
    const svc = service({
      items: [
        {
          id: 'existing',
          menuId: 'menu-1',
          parentItemId: null,
          label: 'Contact',
        },
      ],
    });
    await expect(
      svc.navigationItemCreate('menu-1', {
        label: 'Contact',
        linkType: 'NONE',
      }),
    ).rejects.toMatchObject({ response: { code: 'LABEL_DUPLICATE' } });
  });

  it('allows the same label under a different parent', async () => {
    const svc = service({
      items: [
        {
          id: 'parent-a',
          menuId: 'menu-1',
          parentItemId: null,
          label: 'Study',
        },
        {
          id: 'existing',
          menuId: 'menu-1',
          parentItemId: 'parent-a',
          label: 'Contact',
        },
      ],
    });
    const created = await svc.navigationItemCreate('menu-1', {
      label: 'Contact',
      linkType: 'NONE',
    });
    expect(created).toMatchObject({ label: 'Contact' });
  });

  it('rejects a parent item from a different menu', async () => {
    const svc = service({
      items: [
        {
          id: 'foreign',
          menuId: 'menu-2',
          parentItemId: null,
          label: 'Other menu item',
        },
      ],
    });
    await expect(
      svc.navigationItemCreate('menu-1', {
        label: 'Child',
        linkType: 'NONE',
        parentItemId: 'foreign',
      }),
    ).rejects.toMatchObject({ response: { code: 'PARENT_NOT_FOUND' } });
  });

  it('rejects nesting an item under an item that already has a parent', async () => {
    const svc = service({
      items: [
        { id: 'top', menuId: 'menu-1', parentItemId: null, label: 'Top' },
        { id: 'mid', menuId: 'menu-1', parentItemId: 'top', label: 'Mid' },
      ],
    });
    // navigationTree only ever walks parent -> children, one level; a
    // grandchild would render nowhere on the live site, so it is rejected
    // rather than silently accepted and then silently dropped.
    await expect(
      svc.navigationItemCreate('menu-1', {
        label: 'Grandchild',
        linkType: 'NONE',
        parentItemId: 'mid',
      }),
    ).rejects.toMatchObject({ response: { code: 'PARENT_TOO_DEEP' } });
  });

  it('rejects an item being its own parent', async () => {
    const svc = service({
      items: [
        { id: 'self', menuId: 'menu-1', parentItemId: null, label: 'Self' },
      ],
    });
    await expect(
      svc.navigationItemUpdate('menu-1', 'self', { parentItemId: 'self' }),
    ).rejects.toMatchObject({ response: { code: 'PARENT_INVALID' } });
  });

  it('rejects an invalid status value', async () => {
    const svc = service({
      items: [
        {
          id: 'item-1',
          menuId: 'menu-1',
          parentItemId: null,
          label: 'Home',
          linkType: 'NONE',
        },
      ],
    });
    await expect(
      svc.navigationItemUpdate('menu-1', 'item-1', { status: 'HIDDEN' }),
    ).rejects.toMatchObject({ response: { code: 'STATUS_INVALID' } });
  });

  it('deactivates and reactivates an item by status, independent of the others', async () => {
    const svc = service({
      items: [
        {
          id: 'a',
          menuId: 'menu-1',
          parentItemId: null,
          label: 'A',
          linkType: 'NONE',
          status: 'ACTIVE',
        },
        {
          id: 'b',
          menuId: 'menu-1',
          parentItemId: null,
          label: 'B',
          linkType: 'NONE',
          status: 'ACTIVE',
        },
      ],
    });
    const deactivated = await svc.navigationItemUpdate('menu-1', 'a', {
      status: 'INACTIVE',
    });
    expect(deactivated).toMatchObject({ status: 'INACTIVE' });
    const untouched = await svc.navigationItems('menu-1');
    expect(untouched.find((row) => row.id === 'b')?.status).toBe('ACTIVE');
    const reactivated = await svc.navigationItemUpdate('menu-1', 'a', {
      status: 'ACTIVE',
    });
    expect(reactivated).toMatchObject({ status: 'ACTIVE' });
  });

  it('blocks deleting an item that still has children', async () => {
    const svc = service({
      items: [
        { id: 'parent', menuId: 'menu-1', parentItemId: null, label: 'Parent' },
        {
          id: 'child',
          menuId: 'menu-1',
          parentItemId: 'parent',
          label: 'Child',
        },
      ],
    });
    await expect(
      svc.navigationItemDelete('menu-1', 'parent'),
    ).rejects.toMatchObject({
      response: { code: 'ITEM_HAS_CHILDREN' },
    });
  });

  it('deletes an item with no children', async () => {
    const svc = service({
      items: [
        { id: 'lonely', menuId: 'menu-1', parentItemId: null, label: 'Lonely' },
      ],
    });
    const result = await svc.navigationItemDelete('menu-1', 'lonely');
    expect(result).toEqual({ deleted: true });
    expect(await svc.navigationItems('menu-1')).toEqual([]);
  });

  it('reorders a sibling group and persists the new displayOrder', async () => {
    const svc = service({
      items: [
        {
          id: 'a',
          menuId: 'menu-1',
          parentItemId: null,
          label: 'A',
          linkType: 'NONE',
          displayOrder: 0,
        },
        {
          id: 'b',
          menuId: 'menu-1',
          parentItemId: null,
          label: 'B',
          linkType: 'NONE',
          displayOrder: 1,
        },
        {
          id: 'c',
          menuId: 'menu-1',
          parentItemId: null,
          label: 'C',
          linkType: 'NONE',
          displayOrder: 2,
        },
      ],
    });
    const reordered = await svc.navigationItemReorder('menu-1', null, [
      'c',
      'a',
      'b',
    ]);
    expect(reordered.map((row) => row.id)).toEqual(['c', 'a', 'b']);
  });

  it('rejects a reorder list that omits or adds an id outside the sibling group', async () => {
    const svc = service({
      items: [
        {
          id: 'a',
          menuId: 'menu-1',
          parentItemId: null,
          label: 'A',
          linkType: 'NONE',
        },
        {
          id: 'b',
          menuId: 'menu-1',
          parentItemId: null,
          label: 'B',
          linkType: 'NONE',
        },
      ],
    });
    await expect(
      svc.navigationItemReorder('menu-1', null, ['a']),
    ).rejects.toMatchObject({ response: { code: 'ORDER_MISMATCH' } });
    await expect(
      svc.navigationItemReorder('menu-1', null, ['a', 'b', 'not-a-sibling']),
    ).rejects.toMatchObject({ response: { code: 'ORDER_MISMATCH' } });
  });

  it('rejects a reorder list with a repeated id', async () => {
    const svc = service({
      items: [
        {
          id: 'a',
          menuId: 'menu-1',
          parentItemId: null,
          label: 'A',
          linkType: 'NONE',
        },
      ],
    });
    await expect(
      svc.navigationItemReorder('menu-1', null, ['a', 'a']),
    ).rejects.toMatchObject({ response: { code: 'ORDER_INVALID' } });
  });

  it('flags a PAGE item whose target has since been unpublished', async () => {
    const svc = service({
      pages: [
        {
          id: 'page-1',
          title: 'Old promo',
          slug: 'old-promo',
          status: 'DRAFT',
          deletedAt: null,
        },
      ],
      items: [
        {
          id: 'item-1',
          menuId: 'menu-1',
          parentItemId: null,
          label: 'Promo',
          linkType: 'PAGE',
          pageId: 'page-1',
          customUrl: null,
          openInNewTab: false,
          displayOrder: 0,
          status: 'ACTIVE',
        },
      ],
    });
    const [row] = await svc.navigationItems('menu-1');
    expect(row.brokenTarget).toBe(true);
  });

  it('flags a PAGE item whose target has since been soft-deleted', async () => {
    const svc = service({
      pages: [
        {
          id: 'page-1',
          title: 'Gone',
          slug: 'gone',
          status: 'PUBLISHED',
          deletedAt: new Date(),
        },
      ],
      items: [
        {
          id: 'item-1',
          menuId: 'menu-1',
          parentItemId: null,
          label: 'Gone link',
          linkType: 'PAGE',
          pageId: 'page-1',
          customUrl: null,
          openInNewTab: false,
          displayOrder: 0,
          status: 'ACTIVE',
        },
      ],
    });
    const [row] = await svc.navigationItems('menu-1');
    expect(row.brokenTarget).toBe(true);
  });

  it('does not flag a PAGE item whose target is published and not deleted', async () => {
    const svc = service({
      items: [
        {
          id: 'item-1',
          menuId: 'menu-1',
          parentItemId: null,
          label: 'About',
          linkType: 'PAGE',
          pageId: 'page-1',
          customUrl: null,
          openInNewTab: false,
          displayOrder: 0,
          status: 'ACTIVE',
        },
      ],
      pages: [
        {
          id: 'page-1',
          title: 'About',
          slug: 'about',
          status: 'PUBLISHED',
          deletedAt: null,
        },
      ],
    });
    const [row] = await svc.navigationItems('menu-1');
    expect(row.brokenTarget).toBe(false);
    expect(row.resolvedHref).toBe('/about');
  });

  it('404s for a menu that does not exist', async () => {
    const svc = service();
    await expect(svc.navigationItems('missing-menu')).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
  });
});
