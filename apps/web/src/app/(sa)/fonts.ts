import { Manrope, Sora } from 'next/font/google';

/**
 * The approved design's two typefaces, loaded through next/font as CSS
 * variables rather than a stylesheet link, so nothing blocks paint and
 * nothing leaks. Shared by the Study Abroad layout and the page-not-found
 * page, which draws the same frame outside that layout.
 */
export const sora = Sora({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--sa-font-display',
  display: 'swap',
});

export const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--sa-font-body',
  display: 'swap',
});
