import { headers } from 'next/headers';
import { getSiteChrome } from '@/lib/site-chrome';
import { GlobalFooter, GlobalHeader } from './GlobalNav';

/** Server wrappers around the one public Header/Footer.
 *
 * These are the only components any page should render for site chrome. The
 * older per-template chrome components (CatalogHeader, PhaseOneHeader, ...)
 * are now thin aliases of these, so a single Admin navigation/settings change
 * is reflected on every public page regardless of which template it uses.
 *
 * The current path comes from a request header set in middleware, because an
 * App Router layout cannot read the pathname directly. It is used only to ask
 * the API which Page/Template override applies -- the chrome components
 * themselves stay single and canonical. */

/** Study Abroad is the one route family that ships its own header and footer
 * as part of the client-approved design, so the site chrome stands down for it
 * rather than stacking a second navigation on top. Every other route is
 * untouched.
 *
 * The homepage is part of that family: the destination listing the approved
 * design published at `/study-abroad` and `/countries` is now the homepage
 * itself, and it arrives wearing the same header and footer as the country
 * guides it links to. */
const OWN_CHROME_PREFIXES = [
  '/study-abroad',
  /* Subjects and specializations are part of the same approved design: the
     reference builds them from the same stylesheet and the same section
     bands as the country guides, and they now live in the (sa) route group
     that ships its header and footer. */
  '/subjects',
  '/specializations',
  '/courses',
];

/** The same, for the routes under a family whose other children have not
 * moved. The university directory and a university's own guide are built on
 * the approved design and ship its chrome; the claim form and an offering's
 * page are still the older template and need the site chrome, so these match
 * a path rather than the family. */
const OWN_CHROME_PATHS = ['/universities'];
const OWN_CHROME_PATTERNS = [/^\/universities\/[^/]+$/];

function ownsItsChrome(path: string | undefined) {
  if (path === '/') return true;
  if (!path) return false;
  if (OWN_CHROME_PATHS.includes(path)) return true;
  if (OWN_CHROME_PATTERNS.some((pattern) => pattern.test(path))) return true;
  return OWN_CHROME_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

async function currentPath() {
  try {
    return (await headers()).get('x-pathname') ?? undefined;
  } catch {
    // Static rendering has no request headers; fall back to the global chrome.
    return undefined;
  }
}

export async function SiteChromeHeader() {
  const path = await currentPath();
  if (ownsItsChrome(path)) return null;
  const chrome = await getSiteChrome(path);
  // HIDE removes the element entirely rather than visually hiding it, so a
  // hidden header leaves no empty band and no unreachable focus targets.
  if (chrome.chrome?.header.mode === 'HIDE') return null;
  return <GlobalHeader chrome={chrome} />;
}

/** The page's own content landmark. Study Abroad renders its own, between its
 * own header and footer, so wrapping it again here would nest one <main> in
 * another and pull that route's header and footer inside the content. */
export async function SiteChromeContent({ children }: { children: React.ReactNode }) {
  if (ownsItsChrome(await currentPath())) return <>{children}</>;
  return (
    <main id="content" className="flex-1">
      {children}
    </main>
  );
}

export async function SiteChromeFooter() {
  const path = await currentPath();
  if (ownsItsChrome(path)) return null;
  const chrome = await getSiteChrome(path);
  if (chrome.chrome?.footer.mode === 'HIDE') return null;
  return <GlobalFooter chrome={chrome} />;
}
