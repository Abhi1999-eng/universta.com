import { ExpandedService } from './expanded.service';

/** The public header/footer render exactly what this returns, so a regression
 * here is a regression in whether Phase 1 pages are reachable at all. */
describe('ExpandedService.navigationTree', () => {
  const row = (
    over: Partial<Parameters<typeof ExpandedService.navigationTree>[0][number]>,
  ) => ({
    id: 'id',
    parentItemId: null,
    label: 'Label',
    linkType: 'CUSTOM',
    customUrl: '/somewhere',
    openInNewTab: false,
    displayOrder: 0,
    page: null,
    ...over,
  });

  it('nests children under their parent and orders both levels', () => {
    const tree = ExpandedService.navigationTree([
      row({
        id: 'child-b',
        parentItemId: 'parent',
        label: 'B',
        customUrl: '/b',
        displayOrder: 2,
      }),
      row({
        id: 'parent',
        label: 'Parent',
        customUrl: null,
        linkType: 'NONE',
        displayOrder: 1,
      }),
      row({
        id: 'child-a',
        parentItemId: 'parent',
        label: 'A',
        customUrl: '/a',
        displayOrder: 1,
      }),
      row({
        id: 'first',
        label: 'First',
        customUrl: '/first',
        displayOrder: 0,
      }),
    ]);

    expect(tree.map((item) => item.label)).toEqual(['First', 'Parent']);
    expect(tree[1].children.map((child) => child.label)).toEqual(['A', 'B']);
  });

  it('resolves PAGE links from the related page slug', () => {
    const [item] = ExpandedService.navigationTree([
      row({ linkType: 'PAGE', customUrl: null, page: { slug: 'about' } }),
    ]);
    expect(item.href).toBe('/about');
  });

  it('drops items whose link cannot be resolved instead of rendering a dead link', () => {
    const tree = ExpandedService.navigationTree([
      // PAGE link whose page was deleted.
      row({
        id: 'a',
        label: 'Orphan',
        linkType: 'PAGE',
        customUrl: null,
        page: null,
      }),
      // Unsafe scheme.
      row({ id: 'b', label: 'Unsafe', customUrl: 'javascript:alert(1)' }),
      // Plain placeholder.
      row({ id: 'c', label: 'Placeholder', customUrl: '#' }),
    ]);
    expect(tree).toEqual([]);
  });

  it('keeps a linkless parent when it still has resolvable children', () => {
    const tree = ExpandedService.navigationTree([
      row({
        id: 'parent',
        label: 'Resources',
        linkType: 'NONE',
        customUrl: null,
      }),
      row({
        id: 'child',
        parentItemId: 'parent',
        label: 'FAQ',
        customUrl: '/faq',
      }),
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].href).toBeNull();
    expect(tree[0].children.map((child) => child.href)).toEqual(['/faq']);
  });

  it('drops a dropdown parent once every child is unresolvable', () => {
    const tree = ExpandedService.navigationTree([
      row({ id: 'parent', label: 'Empty', linkType: 'NONE', customUrl: null }),
      row({
        id: 'child',
        parentItemId: 'parent',
        label: 'Broken',
        customUrl: '#',
      }),
    ]);
    expect(tree).toEqual([]);
  });

  it('allows absolute https links but not other schemes', () => {
    const tree = ExpandedService.navigationTree([
      row({ id: 'ok', label: 'Docs', customUrl: 'https://example.test/docs' }),
      row({ id: 'bad', label: 'Insecure', customUrl: 'http://example.test' }),
    ]);
    expect(tree.map((item) => item.label)).toEqual(['Docs']);
  });
});
