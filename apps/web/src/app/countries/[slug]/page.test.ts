import { describe, expect, it } from 'vitest';
import { countryFaqJsonLd } from './page';

describe('country FAQ JSON-LD', () => {
  it('keeps FAQ JSON-LD valid and answer content plain when an editor uses HTML', () => {
    const value = countryFaqJsonLd([
      {
        question: 'How do I apply?',
        answer: '<p>You can <strong>apply online</strong>.</p><script>alert(1)</script>',
      },
    ]);

    expect(value).toEqual({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'How do I apply?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'You can apply online.',
          },
        },
      ],
    });
    expect(JSON.stringify(value)).not.toContain('<');
  });

  it('leaves a plain FAQ answer unchanged', () => {
    expect(
      countryFaqJsonLd([
        { question: 'Is English required?', answer: 'It depends on the course.' },
      ]),
    ).toMatchObject({
      mainEntity: [
        { acceptedAnswer: { text: 'It depends on the course.' } },
      ],
    });
  });
});
