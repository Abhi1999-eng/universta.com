import { getSiteChrome } from '@/lib/site-chrome';
import { GlobalFooter, GlobalHeader } from './GlobalNav';

/** Server wrappers around the one public Header/Footer.
 *
 * These are the only components any page should render for site chrome. The
 * older per-template chrome components (CatalogHeader, PhaseOneHeader, ...)
 * are now thin aliases of these, so a single Admin navigation/settings change
 * is reflected on every public page regardless of which template it uses. */

export async function SiteChromeHeader() {
  return <GlobalHeader chrome={await getSiteChrome()} />;
}

export async function SiteChromeFooter() {
  return <GlobalFooter chrome={await getSiteChrome()} />;
}
