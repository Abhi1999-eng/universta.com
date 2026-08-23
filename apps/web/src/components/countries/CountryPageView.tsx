import Link from 'next/link';
/* API-selected media can come from approved external asset hosts. */
/* eslint-disable @next/next/no-img-element */
import type { CountryPage } from '@/lib/countries';
import { SiteFooter, SiteHeader } from './SiteChrome';
import { CountryEditorialSections, editorialNavItems } from './CountryEditorialSections';
import { CountryJumpNav } from './CountryJumpNav';
import { CountryStructuredSections, structuredNavItems } from './CountryStructuredSections';

export function CountryPageView({ page }: { page: CountryPage }) {
  const { country, sections, faqs, consultantCards } = page;
  const structured = structuredNavItems(country);
  const editorial = editorialNavItems(sections);
  const consultantHref = `/study-abroad-consultants?country=${encodeURIComponent(country.slug)}`;
  const navItems = [...editorial, ...structured, ...(faqs.length ? [{ id: 'faqs', label: 'FAQs' }] : []), ...(consultantCards.length ? [{ id: 'consultants', label: 'Guidance' }] : []), { id: 'consultation', label: 'Consultation' }];
  return (
    <main>
      <SiteHeader detail />
      <section className="detail-hero">
        <div className="shell detail-hero-grid">
          <div>
            <Link className="back-link" href="/countries">
              ← All destinations
            </Link>
            <p className="eyebrow">Study destination · {country.continent.name}</p>
            <h1>{country.pageHeading || `Study in ${country.name}`}</h1>
            <p className="hero-copy">{country.shortDescription}</p>
            <Link className="button" href={consultantHref}>
              Find consultants
            </Link>
          </div>
          <div className="hero-card">
            {country.flag ? (
              <img src={country.flag.url} alt={country.flag.alt || `${country.name} flag`} />
            ) : (
              <div className="hero-placeholder" aria-hidden="true">
                {country.name.slice(0, 1)}
              </div>
            )}
            <span>{country.name}</span>
            <small>{country.continent.name}</small>
          </div>
        </div>
      </section>
      <CountryJumpNav items={navItems} />
      <div className="shell detail-layout">
        <div className="detail-main">
          <p className="eyebrow">Your destination guide</p>
          <CountryStructuredSections country={country} />
          <CountryEditorialSections sections={sections} variables={{ countryName: country.name, countrySlug: country.slug }} />
          {faqs.length ? (
            <section id="faqs" className="editorial-section">
              <p className="eyebrow">Questions answered</p>
              <h2>Frequently asked questions</h2>
              <div className="faq-list">
                {faqs.map((faq) => (
                  <details key={faq.id}>
                    <summary>{faq.question}</summary>
                    <p>{faq.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          ) : null}
        </div>
        <aside id="facts" className="facts-panel">
          <p className="eyebrow">At a glance</p>
          <h2>{country.name}</h2>
          {factsFor(country).map((fact) => (
            <div className="fact" key={fact.label}>
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
            </div>
          ))}
          <p className="source-note">Facts are calculated from published Universities and University Course Offerings.</p>
        </aside>
      </div>
      <section id="consultation" className="consultation-band">
        <div className="shell consultation-inner">
          <div>
            <p className="eyebrow">Plan with confidence</p>
            <h2>Find study-abroad consultants</h2>
            <p>Browse consultants serving {country.name} and contact the right team for your plans.</p>
          </div>
          <Link className="button light" href={consultantHref}>
            View consultants
          </Link>
        </div>
      </section>
      {consultantCards.length ? (
        <section id="consultants" className="shell consultants">
          <p className="eyebrow">Guidance for your journey</p>
          <h2>Explore consultation options</h2>
          <div className="consultant-grid">
            {consultantCards.map((card) => (
              <article key={card.id} className="consultant-card">
                {card.featuredMedia ? <img className="consultant-media" src={card.featuredMedia.url} alt={card.featuredMedia.alt || card.title} /> : card.iconMedia ? <img className="consultant-icon" src={card.iconMedia.url} alt={card.iconMedia.alt || ''} /> : null}
                <h3>{card.title}</h3>
                <p>{card.shortDescription}</p>
                <Link href={card.ctaUrl && (/^\//.test(card.ctaUrl) || /^#[a-zA-Z0-9_-]+$/.test(card.ctaUrl) || /^https:\/\//.test(card.ctaUrl)) ? card.ctaUrl : consultantHref}>{card.ctaLabel} →</Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      <SiteFooter />
    </main>
  );
}
export function factsFor(country: CountryPage['country']) {
  const values: Array<{ label: string; value: string | number }> = [];
  const derived = country.derived;
  if (derived?.statistics.universitiesCount != null)
    values.push({
      label: 'Universities',
      value: derived.statistics.universitiesCount,
    });
  if (derived?.statistics.coursesCount != null) values.push({ label: 'Courses', value: derived.statistics.coursesCount });
  if (derived?.averageTuition)
    values.push({
      label: 'Average Tuition',
      value: `${derived.averageTuition.currencySymbol ?? derived.averageTuition.currencyCode} ${derived.averageTuition.amount}`,
    });
  if (country.configuration?.intakeMonths.length)
    values.push({
      label: 'Intakes',
      value: country.configuration.intakeMonths.length,
    });
  return values;
}
