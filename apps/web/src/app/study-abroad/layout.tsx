import type { Metadata } from 'next';
import { Manrope, Sora } from 'next/font/google';
import { StudyAbroadShell } from '@/components/study-abroad/StudyAbroadShell';
import { getDestinations } from '@/lib/study-abroad';
import './study-abroad.css';

/**
 * The Study Abroad route family.
 *
 * The approved design brings its own typography, its own navigation and its own
 * footer. The stylesheet is scoped to `.sa` so it cannot reach any other page,
 * and the two typefaces are loaded through next/font as CSS variables rather
 * than a stylesheet link, so nothing blocks paint and nothing leaks either.
 */

const sora = Sora({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--sa-font-display',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--sa-font-body',
  display: 'swap',
});

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
    <div className={`sa ${sora.variable} ${manrope.variable}`}>
      <StudyAbroadShell destinations={directory}>{children}</StudyAbroadShell>
    </div>
  );
}
