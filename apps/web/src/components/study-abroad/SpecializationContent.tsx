import { RichText } from '@/components/phase1/RichText';
import type { SpecializationDetail } from '@/lib/catalog';
import { namedParagraphs, sectionLines } from '@/lib/specialization-content';

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
        : section.sectionType === 'STEPS'
          ? (
              /* Steps are an order, and read as one; a checklist is a set.
                 Inside .rich-text so the list markers the site's reset
                 strips come back, as they do in every authored list. */
              <div className="rich-text">
                <ol>
                  {lines.map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                </ol>
              </div>
            )
          : section.sectionType === 'CHECKLIST'
            ? (
                <div className="rich-text">
                  <ul>
                    {lines.map((line, index) => (
                      <li key={index}>{line}</li>
                    ))}
                  </ul>
                </div>
              )
            : lines.map((line, index) => <p key={index}>{line}</p>)}
    </div>
  );
}

/**
 * A section as it reads beside its heading on the specialization's page:
 * a checklist or steps run in the numbered two-column list the level pages
 * use, a section written place by place ("<strong>Canada</strong>: ...")
 * becomes a card for each, and prose stays prose.
 */
export function WideSectionBody({ section }: { section: Section }) {
  if (section.sectionType === 'CHECKLIST' || section.sectionType === 'STEPS') {
    return (
      <div className={section.sectionType === 'STEPS' ? 'levellist levellist--steps' : 'levellist'}>
        <SectionBody section={section} />
      </div>
    );
  }
  const cards = section.sectionType === 'RICH_TEXT' && !section.media?.url ? namedParagraphs(sectionLines(section)) : null;
  if (!cards) return <SectionBody section={section} />;
  return (
    <ul className="levelsectors" role="list">
      {cards.map((card, index) => (
        <li className="levelsector" key={`${index}-${card.name}`}>
          <h3 className="levelsector__t">{card.name}</h3>
          <RichText value={`<p>${card.line}</p>`} className="levelsector__b" />
        </li>
      ))}
    </ul>
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
