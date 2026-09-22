import Link from 'next/link';
import type { ReactNode } from 'react';
import { RichText, richTextToPlainText } from '@/components/phase1/RichText';
import type { CountryPage } from '@/lib/countries';
import type { Destination } from '@/lib/study-abroad';
import {
  costBreakdown,
  guideIntakes,
  intakeCards,
  languageRows,
  monthNames,
  type WorkCard,
} from '@/lib/study-abroad-view';
import { DocumentChecklist } from './DocumentChecklist';
import { FlagMark } from './FlagMark';
import { Longform } from './Longform';
import { SectionHead } from './SectionHead';

/**
 * The country guide's sections, built on the approved design's markup.
 *
 * Every section opens with the same split head and is numbered by its place
 * in the run. Every figure, row and card comes from what an editor published
 * for the country; where the design's export filled a slot with copy written
 * for one country, the lead here says the same thing for any country, and a
 * section with nothing published behind it is left out rather than shown
 * empty.
 */

type Country = CountryPage['country'];
type Profiles = CountryPage['profiles'];

function Section({
  id,
  alt,
  navy,
  narrow,
  children,
}: {
  id: string;
  alt?: boolean;
  navy?: boolean;
  narrow?: boolean;
  children: ReactNode;
}) {
  const band = navy ? 'sec--navy' : alt ? 'sec--paper' : 'sec--white';
  return (
    <section className={`sec ${band}`} id={id}>
      <div className={narrow ? 'wrap wrap--narrow' : 'wrap'}>{children}</div>
    </section>
  );
}

function AssessmentLink({ intent, children }: { intent: string; children: ReactNode }) {
  return (
    <div className="btn-row sec-head__cta">
      <button className="linkcta" type="button" data-open-assessment data-intent={intent}>
        {children}{' '}
        <span className="linkcta__arrow" aria-hidden="true">
          &rarr;
        </span>
      </button>
    </div>
  );
}

export function CountryWhy({ country, n, alt }: { country: Country; n: string | null; alt: boolean }) {
  const features = country.configuration?.features ?? [];
  if (!features.length) return null;
  return (
    <Section id="why" alt={alt}>
      <SectionHead
        n={n}
        eyebrow="Why this destination"
        title={`Why study in ${country.name}?`}
        lead={`What sets ${country.name} apart for international students, at a glance.`}
      >
        <AssessmentLink intent="why">Check My Options</AssessmentLink>
      </SectionHead>
      <div className="rulegrid rulegrid--3">
        {features.map((feature, index) => (
          <div className="rulegrid__item" key={feature.code}>
            <span className="rulegrid__n" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="rulegrid__t">{feature.label}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

/**
 * Splits rich text into its first paragraph and the rest, so a long overview
 * can lead with one paragraph and keep the remainder behind "read more".
 */
export function splitLead(html: string): { lead: string; rest: string | null } {
  const match = html.match(/^\s*<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!match) return { lead: richTextToPlainText(html), rest: null };
  const rest = html.slice(match[0].length).trim();
  return { lead: richTextToPlainText(match[0]), rest: rest || null };
}

/**
 * The first sentence of a passage and what follows it. The design's overview
 * lead is set large, so it carries one sentence and the rest reads at body
 * size beneath it.
 */
export function firstSentence(text: string): { first: string; rest: string | null } {
  const match = text.match(/^(.{20,260}?[.!?])\s+(?=[A-Z0-9"“‘(])/);
  if (!match) return { first: text, rest: null };
  return { first: match[1], rest: text.slice(match[0].length).trim() || null };
}

export function CountryOverview({
  country,
  lead,
  n,
  alt,
}: {
  country: Country;
  /** A lead the hero had no room for, shown here instead of lost. */
  lead: string | null;
  n: string | null;
  alt: boolean;
}) {
  if (!country.overview && !lead) return null;
  const split = country.overview ? splitLead(country.overview) : null;
  const opening = lead ?? split?.lead ?? null;
  const sentence = opening ? firstSentence(opening) : null;
  /* With a hero lead standing in, the whole overview goes behind the toggle;
     otherwise its first paragraph is the lead and only the rest does. */
  const body = lead ? country.overview : (split?.rest ?? null);
  return (
    <Section id="overview" alt={alt}>
      <SectionHead n={n} eyebrow="Overview" title={`About studying in ${country.name}`}>
        {sentence ? <p className="ov__lead">{sentence.first}</p> : null}
        {sentence?.rest ? <p className="ov__more">{sentence.rest}</p> : null}
      </SectionHead>
      {body ? (
        <Longform label={`Read more about studying in ${country.name}`}>
          <RichText value={body} />
        </Longform>
      ) : null}
    </Section>
  );
}

export function CountryDocuments({
  country,
  n,
  alt,
}: {
  country: Country;
  n: string | null;
  alt: boolean;
}) {
  const documents = country.documents ?? [];
  if (!documents.length) return null;
  return (
    <Section id="documents" alt={alt}>
      <SectionHead
        n={n}
        eyebrow="Documents"
        title={`Documents required to study in ${country.name}`}
        lead="Get organised before you apply. Most delays come from translations and certification, not from the application itself."
      />
      <DocumentChecklist
        documents={documents.map((document) => ({
          id: document.id,
          name: document.name,
          isRequired: Boolean(document.isRequired),
          details: document.details ?? null,
        }))}
      />
    </Section>
  );
}

export function CountryIntakes({
  country,
  profiles,
  n,
  alt,
}: {
  country: Country;
  profiles: Profiles;
  n: string | null;
  alt: boolean;
}) {
  /* The editor's month selection decides which intakes appear; the intake
     records only add detail to a selected month. The timeline and the cards
     are built from the same list so they can never disagree. */
  const cards = guideIntakes(country.configuration?.intakeMonths, intakeCards(profiles.intakes));
  if (!cards.length) return null;
  const months = cards.flatMap((card) => (card.month ? [card.month] : []));
  const primaryMonths = new Set(
    cards.filter((card) => card.primary && card.month).map((card) => card.month as number),
  );
  const count = cards.length;
  const primaries = cards.filter((card) => card.primary);
  const primaryName = primaries.length === 1 ? primaries[0].name : null;
  return (
    <Section id="intakes" alt={alt}>
      <SectionHead
        n={n}
        eyebrow="Intakes"
        title={`When can you apply to ${country.name}?`}
        lead={`${country.name} runs ${count} ${count === 1 ? 'intake' : 'intakes'} a year.${
          primaryName
            ? ` The ${primaryName}${/intake/i.test(primaryName) ? '' : ' intake'} is the main one.`
            : ''
        } Applications open well ahead of the month teaching begins.`}
      />
      {months.length ? (
        <div className="timeline">
          <div className="timeline__scroll">
            <div className="timeline__months">
              {monthNames([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).map((month, index) => {
                const number = index + 1;
                const open = months.includes(number);
                const state = open ? (primaryMonths.has(number) ? 'primary' : 'secondary') : undefined;
                return (
                  <div className={`tm${open ? ' tm--on' : ''}`} key={month} data-state={state}>
                    <span className="tm__m">{month.slice(0, 3)}</span>
                    <span className="tm__bar" aria-hidden="true" />
                    <span className="sr-only">
                      {month}: {open ? 'intake available' : 'no intake'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          {primaryMonths.size ? (
            <div className="timeline__legend">
              <span>
                <i style={{ background: 'var(--accent)' }} aria-hidden="true" />
                Primary intake
              </span>
              <span>
                <i style={{ background: 'var(--info)' }} aria-hidden="true" />
                Secondary intake
              </span>
              <span>
                <i style={{ background: 'var(--track)' }} aria-hidden="true" />
                No major intake
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
      {cards.length ? (
        <div className="intakes">
          {cards.map((card) => (
            <article className={`intake${card.primary ? ' intake--primary' : ''}`} key={card.id}>
              <div className="intake__head">
                <h3 className="intake__name">{card.name}</h3>
                <span className={`badge ${card.primary ? 'badge--req' : 'badge--neutral'}`}>
                  {card.primary ? 'Primary' : 'Secondary'}
                </span>
              </div>
              {card.starts ? <p className="intake__starts">Classes begin {card.starts}</p> : null}
              {card.opening || card.deadline ? (
                <dl className="intake__rows">
                  {card.opening ? (
                    <div className="intake__row">
                      <dt>Applications open</dt>
                      <dd>{card.opening}</dd>
                    </div>
                  ) : null}
                  {card.deadline ? (
                    <div className="intake__row">
                      <dt>Typical deadline</dt>
                      <dd>{card.deadline}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
              {card.notes ? <p className="intake__note">{card.notes}</p> : null}
            </article>
          ))}
        </div>
      ) : null}
    </Section>
  );
}

export function CountryCost({
  country,
  profiles,
  calculator,
  n,
  alt,
}: {
  country: Country;
  profiles: Profiles;
  /** The interactive calculator, when the country has one configured. */
  calculator: ReactNode;
  n: string | null;
  alt: boolean;
}) {
  const cost = profiles.cost;
  const { total, rows } = costBreakdown(cost);
  const proofOfFunds = profiles.work?.proofOfFundsSummary ?? null;
  if (!rows.length && !calculator && !cost?.tuitionNotes && !cost?.livingCostNotes) return null;
  const currency = country.currency?.name ?? cost?.currencyCode ?? null;
  return (
    <Section id="cost" alt={alt}>
      <SectionHead
        n={n}
        eyebrow="Cost"
        title={`What does it cost to study in ${country.name}?`}
        lead={`Indicative ranges for international students${
          currency ? `, in ${currency}` : ''
        }. Treat every figure here as a starting point, not a quote.`}
      />
      {rows.length ? (
        <div className="cost">
          {total || proofOfFunds ? (
            <aside className="cost__total">
              <div className="cost__total-head">
                <span className="label">{total ? 'Typical total' : 'Before you apply'}</span>
              </div>
              <div className="cost__total-body">
                {total ? (
                  <>
                    <div className="cost__big">{total}</div>
                    <div className="cost__unit">per year, tuition and living</div>
                  </>
                ) : null}
                {proofOfFunds ? (
                  <div className="cost__pof">
                    <div className="label">Proof of funds</div>
                    <div className="snap__n">
                      <RichText value={proofOfFunds} />
                    </div>
                  </div>
                ) : null}
              </div>
            </aside>
          ) : null}
          <div className="costlist">
            {rows.map((row) => (
              <div className="costrow" key={row.label}>
                <div className="costrow__l">{row.label}</div>
                <div className="costrow__v datum">
                  {row.value}
                  {row.unit ? <span className="costrow__u">{row.unit}</span> : null}
                </div>
                {row.label === 'Tuition' && cost?.tuitionNotes ? (
                  <div className="costrow__d">
                    <RichText value={cost.tuitionNotes} />
                  </div>
                ) : null}
                {row.label === 'Living expenses' && cost?.livingCostNotes ? (
                  <div className="costrow__d">
                    <RichText value={cost.livingCostNotes} />
                  </div>
                ) : null}
              </div>
            ))}
            {cost?.disclaimer ? (
              <div className="snap__n cost__disclaimer">
                <RichText value={cost.disclaimer} />
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          {cost?.tuitionNotes ? (
            <div className="prose">
              <RichText value={cost.tuitionNotes} />
            </div>
          ) : null}
          {cost?.livingCostNotes ? (
            <div className="prose">
              <RichText value={cost.livingCostNotes} />
            </div>
          ) : null}
        </>
      )}
      {calculator}
    </Section>
  );
}

export function CountryLanguage({
  country,
  profiles,
  n,
  alt,
}: {
  country: Country;
  profiles: Profiles;
  n: string | null;
  alt: boolean;
}) {
  const language = profiles.language;
  if (!language) return null;
  const rows = languageRows(language);
  const notes = [language.generalNotes, language.languageWaiverAvailable ? language.waiverNotes : null]
    .filter((note): note is string => Boolean(note));
  if (!rows.length && !notes.length) return null;
  /* A notes column with nothing in it is only an empty stripe down the table. */
  const hasNotes = rows.some((row) => row.notes);
  return (
    <Section id="language" alt={alt}>
      <SectionHead
        n={n}
        eyebrow="Language"
        title={`Language requirements for ${country.name}`}
        lead="Requirements are set per programme. Use these as the usual range, and confirm the exact score with each university."
      />
      {rows.length ? (
        <div className="tablewrap">
          <table className="data">
            <caption className="sr-only">English tests accepted in {country.name}</caption>
            <thead>
              <tr>
                <th scope="col">Test</th>
                <th scope="col">Requirement</th>
                <th scope="col">Usual minimum</th>
                {hasNotes ? <th scope="col">Notes</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.test}>
                  <th scope="row">{row.test}</th>
                  <td>
                    <span className={`badge badge--${row.requirement.tone}`}>{row.requirement.label}</span>
                  </td>
                  <td className="data__typical">{row.minimum ?? 'Set by programme'}</td>
                  {hasNotes ? <td>{row.notes ?? ''}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {notes.length ? (
        <ul className="notes">
          {notes.map((note, index) => (
            <li key={index}>
              <RichText value={note} />
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

export function CountryWorkVisa({
  country,
  profiles,
  work,
  n,
}: {
  country: Country;
  profiles: Profiles;
  work: WorkCard[];
  n: string | null;
}) {
  if (!work.length) return null;
  const visa = profiles.work;
  const hasVisaCard = Boolean(visa?.visaType || visa?.visaInformation);
  /* The visa card carries the visa and the proof of funds, so the journey
     above it keeps to the stages after arrival rather than saying both twice. */
  const journey = hasVisaCard
    ? work.filter((item) => item.title !== 'Student visa' && item.title !== 'Proof of funds')
    : work;
  /* A fee in the country's own currency reads as the guide's other money
     does, "€75"; a fee in another currency keeps its code, "USD 160". */
  const feeAmount = visa?.visaFee ? Number(visa.visaFee).toLocaleString('en-US') : null;
  const feeInLocalCurrency =
    !visa?.visaFeeCurrencyCode || visa.visaFeeCurrencyCode === country.currency?.code;
  const visaFee = feeAmount
    ? feeInLocalCurrency && country.currency?.symbol
      ? `${country.currency.symbol}${feeAmount}`
      : `${visa?.visaFeeCurrencyCode ?? ''} ${feeAmount}`.trim()
    : null;
  const visaFacts = [
    visa?.visaProcessingTime ? ['Processing time', visa.visaProcessingTime] : null,
    visaFee ? ['Visa fee', visaFee] : null,
  ].filter((fact): fact is [string, string] => Boolean(fact));
  return (
    <Section id="work-visa" navy>
      <SectionHead
        n={n}
        eyebrow="Work & visa"
        title={`Study, work and stay in ${country.name}`}
        lead="The pathway from your first semester to work after graduation, and the visa conditions attached to each stage."
      />
      {journey.length ? (
      <div className="journey">
        {journey.map((item, index) => (
          <article className="jstep" key={item.title}>
            <span className="jstep__dot" aria-hidden="true" />
            <span className="jstep__n">{String(index + 1).padStart(2, '0')}</span>
            <h3 className="jstep__t">{item.title}</h3>
            {item.body ? (
              <div className="jstep__b">
                <RichText value={item.body} />
              </div>
            ) : null}
            {item.value ? <p className="jstep__m">{item.value}</p> : null}
          </article>
        ))}
      </div>
      ) : null}
      {hasVisaCard && visa ? (
        <div className="visa">
          <div>
            <p className="visa__h">Visa overview</p>
            {visa.visaType ? <p className="visa__type">{visa.visaType}</p> : null}
            {visa.proofOfFundsSummary ? (
              <div className="visa__money">
                <RichText value={visa.proofOfFundsSummary} />
              </div>
            ) : null}
          </div>
          {visa.visaInformation || visaFacts.length ? (
            <div>
              {visaFacts.length ? (
                <>
                  <p className="visa__h">At a glance</p>
                  <ul className="visa__list">
                    {visaFacts.map(([label, value]) => (
                      <li key={label}>
                        {label}: {value}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {visa.visaInformation ? (
                <>
                <p className="visa__h">What to know</p>
                <div className="visa__info">
                  <RichText value={visa.visaInformation} />
                </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </Section>
  );
}

export type GuidanceCard = {
  id: string;
  title: string;
  shortDescription?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
};

export function CountryGuidance({
  cards,
  n,
  alt,
}: {
  cards: GuidanceCard[];
  n: string | null;
  alt: boolean;
}) {
  if (!cards.length) return null;
  return (
    <Section id="guidance" alt={alt}>
      <SectionHead
        n={n}
        eyebrow="How we help"
        title="Need help choosing your path?"
        lead="Routes into the same assessment. Pick the one that matches where you are today."
      />
      <div className="routes">
        {cards.map((card, index) => (
          <article className="route" key={card.id}>
            <span className="route__n">{String(index + 1).padStart(2, '0')}</span>
            <h3 className="route__l">{card.title}</h3>
            {/* Written in the admin's rich text editor, so it arrives as HTML;
                printed as text it showed its <p> tags on the page. */}
            {card.shortDescription ? (
              <div className="route__d">
                <RichText value={card.shortDescription} />
              </div>
            ) : null}
            {card.ctaUrl ? (
              <a className="linkcta route__c" href={card.ctaUrl}>
                {card.ctaLabel ?? 'Find out more'}{' '}
                <span className="linkcta__arrow" aria-hidden="true">
                  &rarr;
                </span>
              </a>
            ) : null}
          </article>
        ))}
      </div>
    </Section>
  );
}

export function CountryOtherDestinations({
  country,
  others,
  alt,
}: {
  country: Country;
  others: Destination[];
  alt: boolean;
}) {
  if (!others.length) return null;
  const first = others[0];
  return (
    <section className={`sec ${alt ? 'sec--paper' : 'sec--white'} sec--tight`} id="other-destinations">
      <div className="wrap">
        <div className="sec-head sec-head--compact">
          <div>
            <p className="eyebrow">Explore other destinations</p>
            <h2 className="sec-title sec-title--sm">Same platform. Different country.</h2>
          </div>
        </div>
        <div className="switcher">
          {others.map((entry) => (
            <Link className="switcher__item" key={entry.name} href={`/study-abroad/${entry.slug}`}>
              <FlagMark name={entry.name} iso2Code={entry.iso2Code} bands={entry.bands} />
              <span className="cchip__name">{entry.name}</span>
              <span className="switcher__arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
          ))}
        </div>
        <div className="compare">
          <div>
            <div className="compare__t">
              Not sure between {country.name} and {first.name}?
            </div>
            <p className="snap__n">Put both against your own profile instead of against each other.</p>
          </div>
          <button className="btn btn--ghost" type="button" data-open-assessment data-intent="compare">
            Compare Countries{' '}
            <span className="btn__arrow" aria-hidden="true">
              &rarr;
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
