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
 * untouched. */
function ownsItsChrome(path: string | undefined) {
  return path === '/study-abroad' || (path?.startsWith('/study-abroad/') ?? false);
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
