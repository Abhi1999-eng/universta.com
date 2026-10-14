import Link from 'next/link';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { RichText } from '@/components/phase1/RichText';
import { StudentCatalogueActions } from '@/components/student/StudentCatalogueActions';
import { countryScholarshipsHref } from '@/lib/country-scholarship-list';
import { jsonLdString } from '@/lib/json-ld';
import { toScholarshipCard, type ScholarshipCard } from '@/lib/scholarship-card';
import { breadcrumbJsonLd, type Crumb } from '@/lib/university-json-ld';
import { offeringHref, universityHref } from '@/lib/university-links';
import { Crumbs } from './Crumbs';
import { FUNDING_CAVEAT, ScholarshipCards } from './ScholarshipCards';
import { ScholarshipSupport } from './ScholarshipSupport';
import { SectionHead } from './SectionHead';

/**
 * One scholarship, as the client's zip draws an award: the compact hero
 * with the deadline card beside it, then what it covers, who can apply,
 * where it can be used, how to apply, the documents, the support band,
 * the record's own quality notes and the related awards.
 *
 * Every fact is the record's. Where the zip grades fields this product does
 * not hold -- a coverage checklist, an eligibility table -- the page gives
 * the provider's own words instead, and says plainly when the record has
 * none. The steps and the documents are the zip's general guidance, marked
 * as such: the provider's official list decides.
 */

const STEPS = [
  'Check eligibility',
  'Prepare documents',
  'Complete application',
  'Submit',
  'Wait for decision',
  'Accept award',
];
const DOCUMENTS = [
  'Academic transcripts',
  'Degree certificates',
  'CV',
  'Motivation letter',
  'Recommendation letters',
  'Language certificate',
  'Research proposal',
  'Financial documents',
  'Passport / ID',
];

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

function dateLabel(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

type Place = { name: string; slug: string };

export function ScholarshipGuide({
  record,
  card,
  related,
  guides,
}: {
  record: AnyRecord;
  card: ScholarshipCard;
  /** Other awards for the same destination, already as cards. */
  related: ScholarshipCard[];
  /** The destinations with a guide of their own, by slug: only those have
   * a "Study in" page and a funding page to link to. */
  guides: ReadonlySet<string>;
}) {
  /* The detail endpoint's row carries more than the typed record names. */
  const raw = record as Record<string, unknown>;
  const provider = raw.provider as { name?: unknown; websiteUrl?: unknown } | null | undefined;
  const providerName = text(provider?.name);
  const providerSite = text(provider?.websiteUrl);
  const applicationUrl = text(raw.applicationUrl);
  const source = text(raw.sourceReference);
  const verifiedAt = dateLabel(raw.verifiedAt);
  const updatedAt = dateLabel(raw.updatedAt);
  const description = text(raw.description);
  const eligibility = text(raw.eligibility);

  /* Whether the closing date has passed, judged once here on the server
     against the end of that day, as the finder's "open" filter judges it. */
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const deadlineAt = text(raw.deadline) ? new Date(String(raw.deadline)).getTime() : Number.NaN;
  const closed = Number.isFinite(deadlineAt) && deadlineAt < today;

  const countries = card.countries.filter((place) => place.slug);
  const universities = card.universities.filter((place) => place.slug);
  /* A course on the record is a university's offering; its page lives
     under the university's country, which the record names by id only. */
  const countryByid = new Map(
    (Array.isArray(raw.countries) ? (raw.countries as Array<{ country?: { id?: unknown; slug?: unknown } }>) : []).flatMap(
      (link) => (text(link.country?.id) && text(link.country?.slug) ? [[String(link.country!.id), String(link.country!.slug)] as const] : []),
    ),
  );
  const universityById = new Map(
    (Array.isArray(raw.universities)
      ? (raw.universities as Array<{ university?: { id?: unknown; slug?: unknown; countryId?: unknown } }>)
      : []
    ).flatMap((link) =>
      text(link.university?.id) && text(link.university?.slug)
        ? [[String(link.university!.id), { slug: String(link.university!.slug), countryId: text(link.university!.countryId) }] as const]
        : [],
    ),
  );
  const courses = (Array.isArray(raw.offerings)
    ? (raw.offerings as Array<{ offering?: { name?: unknown; slug?: unknown; universityId?: unknown } }>)
    : []
  ).flatMap((link) => {
    const name = text(link.offering?.name);
    const slug = text(link.offering?.slug);
    if (!name) return [];
    const university = universityById.get(String(link.offering?.universityId ?? ''));
    const countrySlug = university?.countryId ? countryByid.get(university.countryId) : null;
    return [{ name, href: slug && university && countrySlug ? offeringHref(countrySlug, university.slug, slug) : null }];
  });

  /* Home / Scholarships / the destination's funding, where the award names
     exactly one with a guide / this award. */
  const home: Place | null = countries.length === 1 && guides.has(countries[0]!.slug) ? countries[0]! : null;
  const self = `/scholarships/${card.slug}`;
  const trail: Crumb[] = [
    { label: 'Home', href: '/' },
    { label: 'Scholarships', href: '/scholarships' },
    ...(home ? [{ label: home.name, href: countryScholarshipsHref(home.slug) }] : []),
    { label: card.title },
  ];
  const whereHas = countries.length || universities.length || courses.length;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd(trail, self)) }} />

      <section className="hero hero--compact schdetail">
        <div className="wrap">
          <Crumbs trail={trail} />
          <div className="coursehero__grid">
            <div>
              <p className="hero__eyebrow">
                Scholarship
                {card.benefit ? (
                  <>
                    <b>·</b>
                    {card.benefit}
                  </>
                ) : null}
              </p>
              <h1 className="schdetail__name">{card.title}</h1>
              {countries.length || providerName ? (
                <div className="schdetail__meta">
                  {countries.slice(0, 4).map((place) => (
                    <span className="flagchip flagchip--lg" key={place.slug}>
                      {place.iso2 ? <span className="flagchip__code">{place.iso2}</span> : null}
                      {place.name}
                    </span>
                  ))}
                  {countries.length > 4 ? <span className="flagchip flagchip--lg">+{countries.length - 4} more</span> : null}
                  {providerName ? (
                    <span className="schdetail__provider">
                      <span className="label">Provider</span>
                      {providerSite ? (
                        <a href={providerSite} rel="nofollow noopener" target="_blank">
                          {providerName}
                        </a>
                      ) : (
                        providerName
                      )}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {card.summary ? <p className="hero__sub">{card.summary}</p> : null}
              <div className="btn-row" style={{ marginTop: 22 }}>
                <button className="btn btn--lg" type="button" data-open-assessment data-intent="scholarships">
                  Check my eligibility{' '}
                  <span className="btn__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </button>
                {applicationUrl ? (
                  <a className="btn btn--lg btn--ghost" href={applicationUrl} rel="nofollow noopener" target="_blank">
                    Official scholarship page{' '}
                    <span className="btn__arrow" aria-hidden="true">
                      &#8599;
                    </span>
                  </a>
                ) : null}
                <Link className="btn btn--lg btn--ghost" href={`/counselling?source=scholarships&from=${encodeURIComponent(self)}`}>
                  Talk to a counsellor
                </Link>
              </div>
              <div className="schactions">
                <StudentCatalogueActions kind="scholarships" entityId={card.id} scholarshipId={card.id} variant="heart" label={card.title} />
              </div>
            </div>

            <aside className="deadlinecard" aria-label="Application deadline">
              <span className="label">Application deadline</span>
              {card.deadline ? (
                <b className="deadlinecard__date datum">{card.deadline}</b>
              ) : (
                <b className="deadlinecard__varies">Not published</b>
              )}
              <div className="deadlinecard__row">
                <span className="label">Status</span>
                <span className={`badge ${!card.deadline || closed ? 'badge--neutral' : 'badge--ok'}`}>
                  {card.deadline ? (closed ? 'Deadline passed' : 'Open') : 'Check official website'}
                </span>
              </div>
              <div className="deadlinecard__row">
                <span className="label">Verified</span>
                <span>{verifiedAt ? `On ${verifiedAt}` : 'Not yet verified'}</span>
              </div>
              {applicationUrl ? (
                <a className="btn btn--block" href={applicationUrl} rel="nofollow noopener" target="_blank">
                  Apply on the official website{' '}
                  <span className="btn__arrow" aria-hidden="true">
                    &#8599;
                  </span>
                </a>
              ) : null}
              <p className="deadlinecard__note">
                Deadlines are set by the provider and change between rounds. Confirm on the official website before
                planning around one.
              </p>
            </aside>
          </div>
        </div>
      </section>

      <section className="sec sec--white" id="coverage">
        <div className="wrap">
          <SectionHead eyebrow="Funding" title="What does this scholarship cover?">
            {card.award ? (
              <p className="schamount datum">{card.award}</p>
            ) : card.benefit ? (
              <p className="schamount schamount--text">{card.benefit}</p>
            ) : null}
            <p className="sec-lead">
              Only what the scholarship record states. Anything it does not record is for the official website, not a
              guess.
            </p>
          </SectionHead>
          {description ? (
            <RichText value={description} className="schbody" />
          ) : (
            <p className="examtests__note">
              The provider has not published further detail on this record. The official scholarship page has the full
              terms.
            </p>
          )}
          {!verifiedAt ? (
            <p className="unverified">
              Universta has not yet verified this award against the official source. Confirm it on the official
              scholarship website before relying on it.
            </p>
          ) : null}
        </div>
      </section>

      <section className="sec sec--paper" id="eligibility">
        <div className="wrap">
          <SectionHead eyebrow="Eligibility" title="Who can apply?" lead={FUNDING_CAVEAT} />
          {eligibility ? (
            <RichText value={eligibility} className="schbody" />
          ) : (
            <p className="examtests__note">
              The record does not state who can apply. The official scholarship page lists the requirements.
            </p>
          )}
        </div>
      </section>

      {whereHas ? (
        <section className="sec sec--white" id="where">
          <div className="wrap">
            <SectionHead
              eyebrow="Where"
              title="Where can you use this scholarship?"
              lead="The destinations, universities and courses this award is linked to on Universta."
            />
            <div className="wheregrid">
              {countries.length ? (
                <div>
                  <p className="path__h">{countries.length === 1 ? 'Destination' : 'Destinations'}</p>
                  <ul className="linklist">
                    {countries.map((place) => (
                      <li key={place.slug}>
                        {guides.has(place.slug) ? (
                          <>
                            <Link href={`/study-abroad/${place.slug}`}>Study in {place.name}</Link> &middot;{' '}
                            <Link href={countryScholarshipsHref(place.slug)}>{place.name} scholarships</Link>
                          </>
                        ) : (
                          <Link href={`/scholarships?country=${place.slug}#scholarships`}>{place.name} scholarships</Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {universities.length ? (
                <div>
                  <p className="path__h">{universities.length === 1 ? 'University' : 'Universities'}</p>
                  <p className="wheregrid__rel">
                    Linked on the award&rsquo;s record. A link here is not a confirmed partnership.
                  </p>
                  <ul className="linklist">
                    {universities.map((place) => (
                      <li key={place.slug}>
                        <Link href={universityHref(place.slug)}>{place.name}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {courses.length ? (
                <div>
                  <p className="path__h">{courses.length === 1 ? 'Course' : 'Courses'}</p>
                  <ul className="linklist">
                    {courses.map((course) => (
                      <li key={course.href ?? course.name}>
                        {course.href ? <Link href={course.href}>{course.name}</Link> : course.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className="sec sec--paper" id="apply">
        <div className="wrap">
          <SectionHead
            eyebrow="Process"
            title="How to apply"
            lead="The usual route for an award like this. The provider's official instructions take precedence."
          />
          <ol className="prepsteps">
            {STEPS.map((step, index) => (
              <li className="prepsteps__step" key={step}>
                <span className="prepsteps__n">{String(index + 1).padStart(2, '0')}</span>
                <b>{step}</b>
              </li>
            ))}
          </ol>
          {applicationUrl ? (
            <div className="btn-row" style={{ marginTop: 22 }}>
              <a className="btn btn--ghost" href={applicationUrl} rel="nofollow noopener" target="_blank">
                Official application page{' '}
                <span className="btn__arrow" aria-hidden="true">
                  &#8599;
                </span>
              </a>
            </div>
          ) : null}
        </div>
      </section>

      <section className="sec sec--white" id="documents">
        <div className="wrap">
          <SectionHead
            eyebrow="Documents"
            title="Documents you may need"
            lead="What scholarship applications commonly ask for. This award's official list decides what is actually required."
          />
          <div className="pillrow">
            {DOCUMENTS.map((document) => (
              <span className="pill" key={document}>
                {document}
              </span>
            ))}
          </div>
        </div>
      </section>

      <ScholarshipSupport countrySlug={home?.slug ?? null} />

      <section className="sec sec--white sec--tight" id="record">
        <div className="wrap">
          <div className="quality">
            <p className="path__h">About this record</p>
            <dl className="quality__grid">
              <div>
                <dt>Verification</dt>
                <dd>
                  {verifiedAt ? (
                    <span className="badge badge--ok">Verified {verifiedAt}</span>
                  ) : (
                    <span className="badge badge--cond">Needs verification</span>
                  )}
                </dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>
                  {source ? (
                    <a href={source} rel="nofollow noopener" target="_blank">
                      Official source &#8599;
                    </a>
                  ) : (
                    'Not recorded'
                  )}
                </dd>
              </div>
              {providerName ? (
                <div>
                  <dt>Provider</dt>
                  <dd>{providerName}</dd>
                </div>
              ) : null}
              {updatedAt ? (
                <div>
                  <dt>Last updated</dt>
                  <dd>{updatedAt}</dd>
                </div>
              ) : null}
            </dl>
          </div>
          {related.length ? (
            <>
              <p className="path__h" style={{ marginTop: 34 }}>
                {home ? `More scholarships for ${home.name}` : 'Related scholarships'}
              </p>
              <ScholarshipCards scholarships={related} columns={3} />
            </>
          ) : null}
        </div>
      </section>
    </>
  );
}

/** The record as the card reads it, or null when it has no page of its own. */
export function scholarshipCardOf(record: AnyRecord): ScholarshipCard | null {
  return toScholarshipCard(record);
}
