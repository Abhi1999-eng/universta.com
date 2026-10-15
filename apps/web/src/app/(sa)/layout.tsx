import type { Metadata } from 'next';
import { StudyAbroadShell } from '@/components/study-abroad/StudyAbroadShell';
import { manrope, sora } from './fonts';
import { getDestinations } from '@/lib/study-abroad';
import './study-abroad.css';
import './study-abroad-header.css';

/**
 * The Study Abroad route family.
 *
 * The approved design brings its own typography, its own navigation and its own
 * footer. The stylesheet is scoped to `.sa` so it cannot reach any other page,
 * and the two typefaces are loaded through next/font as CSS variables rather
 * than a stylesheet link, so nothing blocks paint and nothing leaks either.
 */

export const metadata: Metadata = {
  title: {
    default: 'Study Abroad',
    template: '%s | Universta',
  },
};

export default async function StudyAbroadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  /* The country selector in the header searches every destination, so the
   * directory is read once here for the whole route family rather than by each
   * page that happens to show it. A failure leaves the selector empty rather
   * than taking the page down with it. */
  const directory = await getDestinations().catch(() => null);

  return (
    /* flex-1 because this now sits directly in the body's column, where the
       root layout's <main> used to: without it a short page leaves the footer
       floating above the fold. */
    <div className={`sa flex-1 ${sora.variable} ${manrope.variable}`}>
      <StudyAbroadShell destinations={directory}>{children}</StudyAbroadShell>
    </div>
  );
}
