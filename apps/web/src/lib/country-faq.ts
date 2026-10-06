import { richTextToPlainText } from "@/components/phase1/RichText";

export function countryFaqJsonLd(
  faqs: Array<{ question: string; answer: string }>,
) {
  return faqs.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: richTextToPlainText(faq.answer),
          },
        })),
      }
    : null;
}
