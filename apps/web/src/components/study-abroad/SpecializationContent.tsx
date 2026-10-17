import { RichText } from '@/components/phase1/RichText';
import type { SpecializationDetail } from '@/lib/catalog';
import { sectionLines } from '@/lib/specialization-content';

type Section = NonNullable<SpecializationDetail['contentSections']>[number];
type Faq = NonNullable<SpecializationDetail['faqs']>[number];

/**
 * One of a specialization's content sections, as prose: its media, then its
 * text as the editor set it out -- paragraphs, or a list for a checklist or
 * steps. Its page and its page in a destination both draw it through here.
 */
export function SectionBody({ section }: { section: Section }) {
  const lines = sectionLines(section);
  return (
    <div className="prose">
      {section.media?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={section.media.url} alt={section.media.alt ?? ''} loading="lazy" />
      ) : null}
      {section.sectionType === 'RICH_TEXT'
        ? lines.map((line, index) => <RichText key={index} value={line} />)
        : section.sectionType === 'CHECKLIST' || section.sectionType === 'STEPS'
          ? (
              <ul>
                {lines.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            )
          : lines.map((line, index) => <p key={index}>{line}</p>)}
    </div>
  );
}

/** A specialization's questions, each opening on its answer. */
export function FaqList({ faqs }: { faqs: Faq[] }) {
  return (
    <div className="faq">
      {faqs.map((faq) => (
        <details className="faq__item" key={faq.id}>
          <summary className="faq__q">
            {faq.question}
            <span className="faq__plus" aria-hidden="true">
              +
            </span>
          </summary>
          <div className="faq__a prose">
            <RichText value={faq.answer} />
          </div>
        </details>
      ))}
    </div>
  );
}
