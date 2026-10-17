import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FaqAccordion, StudyPaths } from './CountrySections';

/**
 * The design's stylesheet shows a study-path panel by `data-active` and an FAQ
 * answer by `data-open` on the answer itself, and hides both otherwise. With
 * only the `hidden` attribute set, the selected panel and the open answer
 * were display: none too -- present in the markup, invisible on the page.
 */
describe('country guide behaviour hooks', () => {
  it('marks the selected study path as the active panel', () => {
    const html = renderToStaticMarkup(
      <StudyPaths
        alt={false}
        countryName="Germany"
        paths={[
          { id: 'bachelors', label: "Bachelor's", duration: '3–4 years', entry: 'School', note: null, courseCount: 3 },
          { id: 'masters', label: "Master's", duration: '1–2 years', entry: "Bachelor's", note: null, courseCount: 5 },
        ]}
      />,
    );
    expect(html.match(/data-active="true"/g) ?? []).toHaveLength(1);
    expect(html).toContain('data-active="false"');
  });

  it('opens the first answer on the answer itself', () => {
    const html = renderToStaticMarkup(
      <FaqAccordion
        alt={false}
        countryName="Germany"
        faqs={[
          { id: 'a', question: 'Can I work?', answer: '<p>Yes.</p>' },
          { id: 'b', question: 'Do I need German?', answer: '<p>Sometimes.</p>' },
        ]}
      />,
    );
    expect(html).toMatch(/class="faq__a"[^>]*data-open="true"/);
    expect(html).toMatch(/class="faq__a"[^>]*data-open="false"/);
  });

  it('lists study path stats as a definition list, which the design styles', () => {
    const html = renderToStaticMarkup(
      <StudyPaths
        alt={false}
        countryName="Germany"
        paths={[{ id: 'phd', label: 'PhD', duration: '3–5 years', entry: "Master's", note: null, courseCount: null }]}
      />,
    );
    expect(html).toContain('<dl class="path__stats"><div class="path__stat"><dt>Typical duration</dt><dd>3–5 years</dd>');
  });
});

/**
 * A country's FAQ answers are rich text from the Admin. They were written
 * into the page as the API served them, resting on its sanitiser alone;
 * they now pass the site's own, as every other rich text does.
 */
describe('a country’s FAQ answers', () => {
  const answer = (value: string) =>
    renderToStaticMarkup(
      <FaqAccordion
        alt={false}
        countryName="Germany"
        faqs={[{ id: 'a', question: 'Can I work?', answer: value }]}
      />,
    ).match(/<div class="faq__a"[^>]*>([\s\S]*?)<\/div><\/div><\/div><\/div><\/section>$/)?.[1];

  it('keeps the formatting an editor wrote', () => {
    expect(answer('<p>Yes, <strong>20 hours</strong> a week. <a href="/study-abroad/germany">More</a></p>')).toBe(
      '<p>Yes, <strong>20 hours</strong> a week. <a href="/study-abroad/germany" rel="noopener noreferrer">More</a></p>',
    );
  });

  it('runs nothing an answer carries, whatever the API let through', () => {
    const html = answer(
      '<p onclick="alert(1)">Yes.</p><script>alert(2)</script><img src=x onerror="alert(3)"><a href="javascript:alert(4)">x</a>',
    );
    expect(html).toBe('<p>Yes.</p><a>x</a>');
  });

  it('does not escape an image address the API already escaped a second time', () => {
    const html = answer('<p><img src="https://cdn.example/permit.png?w=1&amp;h=2" alt="Permit"></p>');
    expect(html).toContain('src="https://cdn.example/permit.png?w=1&amp;h=2"');
    expect(html).not.toContain('&amp;amp;');
  });
});
