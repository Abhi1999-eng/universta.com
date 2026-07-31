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

async function currentPath() {
  try {
    return (await headers()).get('x-pathname') ?? undefined;
  } catch {
    // Static rendering has no request headers; fall back to the global chrome.
    return undefined;
  }
}

export async function SiteChromeHeader() {
  const chrome = await getSiteChrome(await currentPath());
  // HIDE removes the element entirely rather than visually hiding it, so a
  // hidden header leaves no empty band and no unreachable focus targets.
  if (chrome.chrome?.header.mode === 'HIDE') return null;
  return <GlobalHeader chrome={chrome} />;
}

export async function SiteChromeFooter() {
  const chrome = await getSiteChrome(await currentPath());
  if (chrome.chrome?.footer.mode === 'HIDE') return null;
  return <GlobalFooter chrome={chrome} />;
}
