/** Canonical header and footer navigation for a normal deployment.
 *
 * The public site renders whatever the Admin-owned NavigationMenu records say.
 * That is the right design -- the client edits their own menus -- but it means
 * a deployment whose menus were never created serves an empty header: on the
 * hosted site `headerMenu` came back `[]`, so the page showed a logo and a
 * counselling button and nothing else.
 *
 * The frontend deliberately has no hardcoded fallback links. A fallback would
 * make the header untruthful the moment an admin removed an item, and would
 * quietly diverge from what the Admin console shows. Instead the foundation
 * seed creates the menus once, as ordinary Admin-owned records the client can
 * then edit, reorder or delete like any other.
 *
 * Ownership rules, because this runs on every deploy against live data:
 *
 *   - a menu that already has items is *configured* and is never touched --
 *     not its name, not its items, not their order;
 *   - a menu that exists but is empty is populated, since an empty menu is the
 *     failure this exists to repair, not a deliberate choice;
 *   - a missing menu is created and populated;
 *   - nothing is ever updated or deleted.
 *
 * The demo-catalogue seed has its own navigation block that *does* update items
 * in place. That is correct there and wrong here: this must never overwrite a
 * client's menu, and it must never require the fictional catalogue to run.
 */

/** Minimal Prisma surface, so this can be called from a seed script or from
 * Nest without importing either one's client type. */
type NavigationClient = {
  navigationMenu: {
    findFirst(args: unknown): Promise<{ id: string } | null>;
    create(args: unknown): Promise<{ id: string }>;
  };
  navigationItem: {
    count(args: unknown): Promise<number>;
    create(args: unknown): Promise<{ id: string }>;
  };
};

type NavNode = {
  label: string;
  /** A public route. Omitted for a heading that only groups its children. */
  url?: string;
  children?: NavNode[];
};

type MenuDefinition = {
  menuKey: string;
  name: string;
  location: string;
  nodes: NavNode[];
};

/** Routes come from the Website Builder registry's `publicPath` values, not
 * from page slugs: a registered Page's slug is `universities-listing`, which
 * would resolve to `/universities-listing` and 404. */
export const NAVIGATION_DEFINITIONS: MenuDefinition[] = [
  {
    menuKey: 'header',
    name: 'Primary Navigation',
    location: 'HEADER',
    nodes: [
      { label: 'Study Destinations', url: '/countries' },
      { label: 'Universities', url: '/universities' },
      { label: 'Courses', url: '/courses' },
      { label: 'Subjects', url: '/subjects' },
      { label: 'Scholarships', url: '/scholarships' },
      { label: 'Consultants', url: '/study-abroad-consultants' },
      {
        label: 'Resources',
        children: [
          { label: 'Success Stories', url: '/success-stories' },
          { label: 'Testimonials', url: '/testimonials' },
          { label: 'Events', url: '/events' },
          { label: 'Careers', url: '/careers' },
          { label: 'FAQ', url: '/faq' },
        ],
      },
      { label: 'Contact', url: '/contact' },
    ],
  },
  {
    menuKey: 'footer',
    name: 'Footer Navigation',
    location: 'FOOTER',
    nodes: [
      {
        label: 'Destinations',
        children: [
          { label: 'All Countries', url: '/countries' },
          { label: 'Cities', url: '/cities' },
          { label: 'Compare Countries', url: '/compare/countries' },
        ],
      },
      {
        label: 'Study',
        children: [
          { label: 'Universities', url: '/universities' },
          { label: 'Subjects', url: '/subjects' },
          { label: 'Courses', url: '/courses' },
          { label: 'Scholarships', url: '/scholarships' },
        ],
      },
      {
        label: 'Guidance',
        children: [
          { label: 'Consultants', url: '/study-abroad-consultants' },
          { label: 'Book Free Counselling', url: '/counselling' },
          { label: 'Contact Us', url: '/contact' },
          { label: 'FAQ', url: '/faq' },
        ],
      },
      {
        label: 'Company',
        children: [
          { label: 'About Us', url: '/about' },
          { label: 'Success Stories', url: '/success-stories' },
          { label: 'Testimonials', url: '/testimonials' },
          { label: 'Events', url: '/events' },
          { label: 'Careers', url: '/careers' },
        ],
      },
    ],
  },
];

export type NavigationRegistrationResult = {
  /** Menu keys that were created from nothing. */
  menusCreated: string[];
  /** Menu keys that existed but were empty and have now been populated. */
  menusPopulated: string[];
  /** Menu keys left untouched because an admin has configured them. */
  menusPreserved: string[];
  itemsCreated: number;
};

export async function registerWebsiteNavigation(
  prisma: NavigationClient,
): Promise<NavigationRegistrationResult> {
  const result: NavigationRegistrationResult = {
    menusCreated: [],
    menusPopulated: [],
    menusPreserved: [],
    itemsCreated: 0,
  };

  for (const definition of NAVIGATION_DEFINITIONS) {
    // Matched on menuKey alone. The column is unique, so a menu an admin has
    // deactivated still occupies the key -- creating would throw, and
    // reactivating would undo a deliberate choice.
    const existing = await prisma.navigationMenu.findFirst({
      where: { menuKey: definition.menuKey },
      select: { id: true },
    });

    let menuId: string;
    if (existing) {
      const itemCount = await prisma.navigationItem.count({
        where: { menuId: existing.id },
      });
      if (itemCount > 0) {
        result.menusPreserved.push(definition.menuKey);
        continue;
      }
      menuId = existing.id;
      result.menusPopulated.push(definition.menuKey);
    } else {
      const created = await prisma.navigationMenu.create({
        data: {
          name: definition.name,
          menuKey: definition.menuKey,
          location: definition.location,
          status: 'ACTIVE',
        },
      });
      menuId = created.id;
      result.menusCreated.push(definition.menuKey);
    }

    const createNode = async (
      node: NavNode,
      displayOrder: number,
      parentItemId: string | null,
    ): Promise<void> => {
      const row = await prisma.navigationItem.create({
        data: {
          menuId,
          parentItemId,
          label: node.label,
          // A node with no URL is a grouping heading; NONE renders it as a
          // label rather than a dead link.
          linkType: node.url ? 'CUSTOM' : 'NONE',
          customUrl: node.url ?? null,
          displayOrder,
          status: 'ACTIVE',
        },
      });
      result.itemsCreated += 1;
      let childOrder = 1;
      for (const child of node.children ?? []) {
        await createNode(child, childOrder++, row.id);
      }
    };

    let order = 1;
    for (const node of definition.nodes) {
      await createNode(node, order++, null);
    }
  }

  return result;
}

export function describeNavigationRegistration(
  result: NavigationRegistrationResult,
): string {
  const touched = [...result.menusCreated, ...result.menusPopulated];
  if (touched.length === 0) {
    return `Navigation already configured (${result.menusPreserved.join(', ')}) - no changes.`;
  }
  const parts: string[] = [];
  if (result.menusCreated.length)
    parts.push(`created ${result.menusCreated.join(', ')}`);
  if (result.menusPopulated.length)
    parts.push(`populated empty ${result.menusPopulated.join(', ')}`);
  if (result.menusPreserved.length)
    parts.push(`preserved ${result.menusPreserved.join(', ')}`);
  return `Navigation ${parts.join('; ')} (${result.itemsCreated} item(s) created).`;
}
