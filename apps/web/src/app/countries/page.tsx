import HomePage from '../page';
import { staticPageMetadata } from '@/lib/static-page-seo';

/** Countries keeps the approved directory UI at its canonical public route.
 * The homepage remains an intentionally identical discovery entry point. */
export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return staticPageMetadata(
    'countries-listing',
    'Study destinations',
    'Explore structured study destinations and plan your next step with Universta.',
    '/countries',
  );
}

export default HomePage;
