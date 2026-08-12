import CountriesPage from './countries/page';
import { staticPageMetadata } from '@/lib/static-page-seo';

/** The Study Destinations listing is also the site's homepage: `/` and
 * `/countries` are the same discovery entry point and must stay identical, so
 * the route lives once, in `/countries`, and this file only supplies the
 * homepage's own canonical metadata. */
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
