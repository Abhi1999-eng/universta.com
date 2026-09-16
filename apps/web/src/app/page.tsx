import CountriesPage from './countries/page';
import { staticPageMetadata } from '@/lib/static-page-seo';

/** The Study Destinations listing is the site's homepage. Its implementation
 * still lives in `/countries/page.tsx`, but `/countries` itself now redirects:
 * bare to the /study-abroad directory, and with filters to this page, which
 * honours the same query. This file only supplies the homepage's own
 * canonical metadata. */
export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return staticPageMetadata(
    'countries-listing',
    'Study destinations',
    'Explore structured study destinations and plan your next step with Universta.',
    '/',
  );
}

export default CountriesPage;
