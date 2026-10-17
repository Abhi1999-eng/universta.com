import { RichText, richTextToPlainText } from '@/components/phase1/RichText';
import type { SubjectLevelPageContent } from '@/lib/catalog';
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
function said(value: string | null | undefined): value is string {
  return Boolean(value && (richTextToPlainText(value) || /<img\b/i.test(value)));
}

/** The questions worth drawing: an answer with nothing in it is not one.
 *  The page's FAQPage data is built from the same list. */
export function levelFaqs(content: SubjectLevelPageContent | null | undefined) {
  return (content?.faqs ?? []).filter((faq) => faq.question.trim() && said(faq.answer));
}

/**
 * The page's own opening, straight under the hero and above the list: what
 * this level of this field is, in the editor's words. The hero keeps its
 * subline (the level as Admin, Course levels describes it).
 */
export function LevelIntro({
  intro,
  heading,
}: {
  intro: string | null | undefined;
  /** For a screen reader, which reads the intro as a section of its own. */
  heading: string;
}) {
  if (!said(intro)) return null;
  return (
    <section className="sec sec--white sec--tight levelintro" id="overview">
      <div className="wrap">
        <h2 className="sr-only">{heading}</h2>
        <div className="prose">
          <RichText value={intro} />
        </div>
      </div>
    </section>
  );
}

/**
 * The written bands after the list: getting in, where it leads, and the
 * questions. Paper and white alternate by position, as on a
 * specialization's page, so a band that stands down never leaves two of
 * the same shade touching; the list above them is white, so they open on
 * paper.
 */
export function LevelWrittenSections({
  content,
  levelName,
  fieldName,
}: {
  content: SubjectLevelPageContent | null;
  levelName: string;
  fieldName: string;
}) {
  if (!content) return null;
  const here = `${levelName} in ${fieldName}`;
  const faqs = levelFaqs(content);
  const bands = [
    said(content.admissionNote)
      ? { id: 'admission', eyebrow: 'Admission', title: `Getting into ${here}`, body: <div className="prose"><RichText value={content.admissionNote} /></div> }
      : null,
    said(content.careersNote)
      ? { id: 'careers', eyebrow: 'Careers', title: `Where ${here} can lead`, body: <div className="prose"><RichText value={content.careersNote} /></div> }
      : null,
    faqs.length
      ? { id: 'faqs', eyebrow: 'Questions', title: `Questions about ${here}`, body: <FaqList faqs={faqs} /> }
      : null,
  ].filter((band) => band !== null);
  return (
    <>
      {bands.map((band, index) => (
        <section
          className={index % 2 === 0 ? 'sec sec--paper' : 'sec sec--white'}
          id={band.id}
          key={band.id}
        >
          <div className="wrap">
            <SectionHead eyebrow={band.eyebrow} title={band.title} />
            {band.body}
          </div>
        </section>
      ))}
    </>
  );
}
