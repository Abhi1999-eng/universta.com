import Link from 'next/link';
import { headers } from 'next/headers';
import { NotFoundBody } from '@/components/study-abroad/NotFoundBody';
import { StudyAbroadShell } from '@/components/study-abroad/StudyAbroadShell';
import { ownsItsChrome } from '@/lib/own-chrome';
import { getDestinations } from '@/lib/study-abroad';
import { manrope, sora } from './(sa)/fonts';
import './(sa)/study-abroad.css';
import './(sa)/study-abroad-header.css';

/**
 * An address nothing answers.
 *
 * The public site wears the approved design, so a lost address wears it
 * too: the design's frame and its page-not-found page, outside the Study
 * Abroad layout that would otherwise draw the frame. The student portal and
 * the preview still wear the site chrome, which the root layout has already
 * drawn around this, so there the page is only its words.
 */
export default async function NotFound() {
  let path: string | null = null;
  try {
    path = (await headers()).get('x-pathname');
  } catch {
    // Static rendering has no request headers; the design's frame is the default.
  }
  if (path && !ownsItsChrome(path)) {
    return (
      <div className="wrap" style={{ padding: '48px 20px', maxWidth: 720 }}>
        <p>404</p>
        <h1>We could not find that page</h1>
        <p>The link may be old or mistyped.</p>
        <p>
          <Link href="/">Go to the homepage</Link>
        </p>
      </div>
    );
  }
  const directory = await getDestinations().catch(() => null);
  return (
    <div className={`sa flex-1 ${sora.variable} ${manrope.variable}`}>
      <StudyAbroadShell destinations={directory}>
        <NotFoundBody />
      </StudyAbroadShell>
    </div>
  );
}
