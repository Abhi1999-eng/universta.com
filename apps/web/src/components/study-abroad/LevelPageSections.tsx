import Link from 'next/link';
import type { ReactNode } from 'react';
import { RichText, richTextToPlainText } from '@/components/phase1/RichText';
import type { SubjectLevelPageContent } from '@/lib/catalog';
import { withArticle } from '@/lib/level-page';
import { SectionHead } from './SectionHead';
import { FaqList } from './SpecializationContent';

/**
 * What an editor wrote for a field at one study level, drawn on its level
 * page (Admin, the subject's or specialization's Level pages card). Each
 * part stands down when nothing is written, so a page nobody has written
 * for is the catalogue's list and nothing more.
 */

/** Whether rich text has anything a reader would see: an empty paragraph
 *  is not an intro. */
export function said(value: string | null | undefined): value is string {
  return Boolean(value && (richTextToPlainText(value) || /<img\b/i.test(value)));
}

/** The questions worth drawing: an answer with nothing in it is not one.
 *  The page's FAQPage data is built from the same list. */
export function levelFaqs(content: SubjectLevelPageContent | null | undefined) {
  return (content?.faqs ?? []).filter((faq) => faq.question.trim() && said(faq.answer));
}

/** One band of a level page: its anchor, the section head's eyebrow and
 *  heading, an optional lead beside them, and what follows them. */
export type LevelBand = { id: string; eyebrow: string; title: string; lead?: ReactNode; body: ReactNode };

type WrittenBand = 'overview' | 'studyTopics' | 'careers' | 'industries' | 'employers' | 'admission' | 'lookingAhead' | 'faqs';

/** Said under every list of employers: the page names them, it does not
 *  vouch for them. */
export const EMPLOYERS_NOTE = 'Named for illustration only; not a ranking, endorsement or partnership.';

const prose = (value: string) => (
  <div className="prose">
    <RichText value={value} />
  </div>
);

/**
 * The page's written bands by id, each null when nothing is written. The
 * page decides where each one goes: a subject's level page and a
 * specialization's run them in different orders.
 */
export function writtenLevelBands(
  content: SubjectLevelPageContent | null,
  { levelName, fieldName }: { levelName: string; fieldName: string },
): Record<WrittenBand, LevelBand | null> {
  const here = `${levelName} in ${fieldName}`;
  const faqs = levelFaqs(content);
  const written = (value: string | null | undefined, band: Omit<LevelBand, 'body'>, body = prose): LevelBand | null =>
    said(value) ? { ...band, body: body(value) } : null;
  return {
    overview: written(content?.intro, { id: 'overview', eyebrow: 'Overview', title: `Why study ${withArticle(levelName)} in ${fieldName}?` }),
    studyTopics: written(content?.studyTopics, { id: 'study-topics', eyebrow: 'Curriculum', title: 'What you may study' }),
    careers: written(content?.careersNote, { id: 'careers', eyebrow: 'Careers', title: 'Career pathways' }),
    industries: written(content?.industries, { id: 'industries', eyebrow: 'Sectors', title: 'Industries' }),
    employers: written(content?.employers, { id: 'employers', eyebrow: 'Who hires', title: 'Employers' }, (value) => (
      <>
        {prose(value)}
        <p className="trust__note">{EMPLOYERS_NOTE}</p>
      </>
    )),
    admission: written(content?.admissionNote, { id: 'admission', eyebrow: 'Admission', title: `Getting into ${here}` }),
    lookingAhead: written(content?.lookingAhead, { id: 'looking-ahead', eyebrow: 'Outlook', title: 'Looking ahead' }),
    faqs: faqs.length
      ? { id: 'faqs', eyebrow: 'Questions', title: `Questions about ${here}`, body: <FaqList faqs={faqs} /> }
      : null,
  };
}

/**
 * Paper and white alternate so no two bands of one shade touch. The
 * programme list keeps its white; the bands next to it, above and below,
 * are paper, and the shades alternate outwards from there. A band that
 * stands down is not in `ids`, so it never leaves two of a shade touching.
 */
export function bandTones(ids: readonly string[], fixed = 'discovery'): Record<string, 'paper' | 'white'> {
  const at = ids.indexOf(fixed);
  const tones: Record<string, 'paper' | 'white'> = {};
  const tone = (distance: number) => (distance % 2 === 1 ? 'paper' : 'white');
  if (at < 0) {
    ids.forEach((id, index) => { tones[id] = tone(index + 1); });
    return tones;
  }
  ids.forEach((id, index) => { tones[id] = tone(Math.abs(index - at)); });
  return tones;
}

/** One band, drawn the way the guides draw a section. */
export function LevelBandSection({ band, tone }: { band: LevelBand; tone: 'paper' | 'white' }) {
  return (
    <section className={`sec sec--${tone}`} id={band.id}>
      <div className="wrap">
        <SectionHead eyebrow={band.eyebrow} title={band.title} lead={band.lead} />
        {band.body}
      </div>
    </section>
  );
}

/**
 * A row of links under a band's heading, drawn as the field's other level
 * pages are (`LevelLinks`' chips): pages elsewhere on the site, each one a
 * route that answers. Draws nothing when there are no links.
 */
export function LinkChips({ label, links }: { label: string; links: ReadonlyArray<{ href: string; label: string }> }) {
  if (!links.length) return null;
  return (
    <nav className="specchips levelchips" aria-label={label}>
      <ul className="specchips__row" role="list">
        {links.map((link) => (
          <li key={link.href}>
            <Link className="specchip" href={link.href}>{link.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The one link that closes a band, "About Computing →": the whole of
 *  what the band lists. */
export function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <p className="levelmore__about">
      <Link className="linkcta" href={href}>{children}{' '}<span className="linkcta__arrow" aria-hidden="true">&rarr;</span></Link>
    </p>
  );
}
