import Link from 'next/link';
import type { DestinationDirectory } from '@/lib/study-abroad';
import { AssessmentCta } from './AssessmentCta';

/**
 * The homepage's funnel sections, from the approved design's home page.
 *
 * The bands alternate paper and white the whole way down, which is how the
 * design separates one section from the next. That alternation is positional,
 * not per-section, so it had to be re-struck here: the design ran thirteen
 * sections and this page runs eight, and keeping each one's original colour
 * left two paper bands touching, merging them into a single block with no
 * boundary between them.
 *
 * The design published a funnel home page and a destination listing as two
 * pages. They are one page now: these sections wrap the listing, which keeps
 * its own search and filters and sits where the design's "countries" section
 * did.
 *
 * A card whose destination does not exist yet does not link. This is the same
 * rule the directory already applies to a destination with no guide -- a link
 * to nowhere is worse than an honest "Soon" -- so a section can carry the
 * design's full shape while only the parts that work are clickable.
 */

type CardProps = {
  title: string;
  body: string;
  /** Omitted while the destination does not exist; the card then states so. */
  href?: string;
  meta?: string;
};

function HomeCard({ title, body, href, meta }: CardProps) {
  const inner = (
    <>
      <strong className="h-card__t">{title}</strong>
      <span className="h-card__d">{body}</span>
      {meta ? <span className="h-card__m">{meta}</span> : null}
      {href ? null : <span className="h-card__m">Soon</span>}
    </>
  );

  if (!href)
    return (
      <div className="h-card h-card--plain" data-soon="true">
        {inner}
      </div>
    );

  return (
    <Link className="h-card" href={href}>
      {inner}
    </Link>
  );
}

function SectionHead({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="h-head">
      <p className="eyebrow eyebrow--plain">{eyebrow}</p>
      <h2 className="sec-title">{title}</h2>
      {lead ? <p className="sec-lead">{lead}</p> : null}
    </div>
  );
}

/**
 * The hero, with what the platform holds.
 *
 * The figures are summed from the directory this page already loaded rather
 * than counted again, so the headline and the cards below it can never
 * disagree, and the hero costs no extra read.
 */
export type PopularLink = { label: string; href: string };

export function HomeHero({
  directory,
  popular = [],
}: {
  directory: DestinationDirectory;
  /** Destinations and subjects to offer as one-tap starting points. */
  popular?: PopularLink[];
}) {
  const totals = directory.available.reduce(
    (sum, entry) => ({
      universities: sum.universities + entry.counts.universities,
      courses: sum.courses + entry.counts.courses,
      scholarships: sum.scholarships + entry.counts.scholarships,
    }),
    { universities: 0, courses: 0, scholarships: 0 },
  );

  const stats: Array<{ value: number; label: string }> = [
    { value: directory.counts.available, label: 'countries' },
    { value: totals.universities, label: 'universities' },
    { value: totals.courses, label: 'courses' },
    { value: totals.scholarships, label: 'scholarships' },
  ].filter((stat) => stat.value > 0);

  return (
    <section className="hero h-home">
      <div className="wrap">
        <div className="hero__lead h-home__lead">
          <p className="hero__eyebrow">Study abroad, connected</p>
          <h1 className="hero__h1">Your Study Abroad Journey, Connected.</h1>
          <p className="hero__sub">
            Discover countries, courses, universities, scholarships and trusted consultants —
            all in one connected platform.
          </p>

          <div className="btn-row hero__actions">
            <AssessmentCta className="btn btn--lg" intent="home-hero" arrow={false}>
              Start My Journey{' '}
              <span className="btn__arrow" aria-hidden="true">
                →
              </span>
            </AssessmentCta>
            <Link className="btn btn--lg btn--ghost" href="/universities">
              Explore Universities{' '}
              <span className="btn__arrow" aria-hidden="true">
                →
              </span>
            </Link>
            <Link className="btn btn--lg btn--ghost" href="/scholarships">
              Find Scholarships{' '}
              <span className="btn__arrow" aria-hidden="true">
                →
              </span>
            </Link>
          </div>

          {/* The design's box searched everything through a /search page this
              site does not have. It searches courses here, the largest part
              of the catalogue, and says so; destinations have their own
              search a screen below, and the chips reach both. */}
          <form className="bigsearch h-bigsearch" action="/courses" method="get" role="search">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#667085"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              className="bigsearch__input"
              type="search"
              name="q"
              placeholder="Search courses, e.g. Computer Science"
              aria-label="Search courses"
              autoComplete="off"
            />
            <button className="btn btn--sm" type="submit">
              Search
            </button>
          </form>
          {popular.length ? (
            <p className="bigsearch__ex">
              <span className="label">Popular</span>
              {popular.map((link) => (
                <Link className="chipbtn chipbtn--sm" href={link.href} key={link.href}>
                  {link.label}
                </Link>
              ))}
            </p>
          ) : null}

          {stats.length ? (
            <ul className="h-stats" aria-label="On Universta">
              {stats.map((stat) => (
                <li key={stat.label}>
                  <b>{stat.value}</b> {stat.label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** "Where would you like to start?" -- one card per way in. */
export function StartPaths({ alt = false }: { alt?: boolean } = {}) {
  return (
    <section className={`sec ${alt ? 'sec--paper' : 'sec--white'} sec--tight h-sec`} id="paths">
      <div className="wrap">
        <SectionHead
          eyebrow="Start anywhere"
          title="Where would you like to start?"
          lead="Every path connects to the rest of your journey."
        />
        <div className="h-grid h-grid--paths">
          <div className="h-path">
            <strong className="h-card__t">I know where I want to study</strong>
            <span className="h-card__d">
              Start with a destination, then see its universities, courses and scholarships.
            </span>
            <Link className="linkcta" href="#directory">
              Choose a country{' '}
              <span className="linkcta__arrow" aria-hidden="true">
                →
              </span>
            </Link>
          </div>
          <div className="h-path">
            <strong className="h-card__t">I know what I want to study</strong>
            <span className="h-card__d">
              Start with a subject and see where it is taught and at which level.
            </span>
            <Link className="linkcta" href="/subjects">
              Browse subjects{' '}
              <span className="linkcta__arrow" aria-hidden="true">
                →
              </span>
            </Link>
          </div>
          <div className="h-path">
            <strong className="h-card__t">I am not sure yet</strong>
            <span className="h-card__d">
              Answer a few questions and see courses and countries that fit your profile.
            </span>
            <AssessmentCta className="linkcta" intent="home-paths">
              Start My Journey
            </AssessmentCta>
          </div>
          <div className="h-path">
            <strong className="h-card__t">I need funding</strong>
            <span className="h-card__d">
              Find scholarships by country, study level and subject, with eligibility shown
              clearly.
            </span>
            <Link className="linkcta" href="/scholarships">
              Find Scholarships{' '}
              <span className="linkcta__arrow" aria-hidden="true">
                →
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** "Plan with free tools". */
export function HomeTools({ alt = false }: { alt?: boolean } = {}) {
  return (
    <section className={`sec ${alt ? 'sec--paper' : 'sec--white'} sec--tight h-sec`} id="tools">
      <div className="wrap">
        <SectionHead
          eyebrow="Tools"
          title="Plan with free tools"
          lead="Filter what is published, and compare it side by side."
        />
        <div className="h-grid h-grid--4">
          <HomeCard
            href="/courses"
            title="Course Finder"
            body="Filter courses by country, subject, level and university."
          />
          <HomeCard
            href="/universities"
            title="University Finder"
            body="Filter universities by country, subject and type."
          />
          <HomeCard
            href="/scholarships"
            title="Scholarship Finder"
            body="Filter scholarships by country, level, subject and funding."
          />
          <HomeCard
            href="/compare/universities"
            title="Compare Universities"
            body="Side-by-side university comparison."
          />
          <HomeCard
            href="/compare/courses"
            title="Compare Courses"
            body="Side-by-side course comparison."
          />
          <HomeCard
            href="/compare/countries"
            title="Compare Countries"
            body="Side-by-side destination comparison."
          />
          <HomeCard
            title="Eligibility Checker"
            body="Compare your profile with a course's published requirements."
          />
          <HomeCard
            title="Document Checklist"
            body="Build a checklist from a course and its country."
          />
        </div>
      </div>
    </section>
  );
}

/** "Coaching and consultants". */
export function HomeSupport({ alt = false }: { alt?: boolean } = {}) {
  return (
    <section className={`sec ${alt ? 'sec--paper' : 'sec--white'} sec--tight h-sec`} id="support">
      <div className="wrap">
        <SectionHead
          eyebrow="Guidance"
          title="Coaching and consultants"
          lead="Verification badges appear only when Universta has completed checks."
        />
        <div className="h-grid h-grid--4">
          <HomeCard
            href="/study-abroad-consultants"
            title="Study abroad consultants"
            body="Compare consultants by destination, service and location."
          />
          <HomeCard
            href="/counselling"
            title="Talk to Universta"
            body="Not sure who to ask? A Universta advisor can point you in the right direction."
          />
          <HomeCard
            title="Coaching institutes"
            body="Compare exam preparation by exam, city and mode."
          />
          <HomeCard
            title="Exams"
            body="See which tests your target courses list, and what each one measures."
          />
        </div>
      </div>
    </section>
  );
}

/** "Guides for every stage". */
export function HomeGuides({ alt = false }: { alt?: boolean } = {}) {
  return (
    <section className={`sec ${alt ? 'sec--paper' : 'sec--white'} sec--tight h-sec`} id="resources">
      <div className="wrap">
        <SectionHead
          eyebrow="Resources"
          title="Guides for every stage"
          lead="Plain-language guides from choosing a country to preparing to leave."
        />
        <div className="h-grid h-grid--4">
          <HomeCard
            title="Study Abroad Guide"
            body="A step-by-step overview of planning to study abroad, from choosing a destination to arriving."
            meta="Planning"
          />
          <HomeCard
            title="Application Guide"
            body="How university applications usually work and how to keep them organised."
            meta="Applications"
          />
          <HomeCard
            title="Documents Guide"
            body="The documents study abroad applications commonly ask for, and how to prepare them."
            meta="Documents"
          />
          <HomeCard
            title="Statement of Purpose (SOP) Guide"
            body="How to plan and write a clear, honest statement of purpose."
            meta="Applications"
          />
        </div>
      </div>
    </section>
  );
}

/** "Universities, providers, coaching institutes and consultants". */
export function HomeInstitutions({ alt = false }: { alt?: boolean } = {}) {
  return (
    <section className={`sec ${alt ? 'sec--paper' : 'sec--white'} sec--tight h-sec`} id="institutions">
      <div className="wrap">
        <SectionHead
          eyebrow="For institutions"
          title="Universities, providers, coaching institutes and consultants"
          lead="Manage your public profile, respond to students through Universta and keep your information accurate."
        />
        <div className="h-grid h-grid--4">
          <HomeCard
            title="Universities"
            body="Keep your university and course information accurate, and respond to interested students through Universta."
          />
          <HomeCard
            title="Scholarship providers"
            body="Publish scholarships with clear eligibility and reach students who fit them."
          />
          <HomeCard
            title="Coaching institutes"
            body="List exam preparation courses, batches and branches, and receive demo and enquiry requests."
          />
          <HomeCard
            title="Consultants"
            body="Show your services, destinations and verified credentials, and receive guidance requests from students who chose you."
          />
        </div>
      </div>
    </section>
  );
}

/**
 * "How Universta keeps information honest".
 *
 * Every card here is a statement rather than a link, so this section carries
 * the design's full copy with nothing left to build behind it.
 */
export function HomeTrust({ alt = false }: { alt?: boolean } = {}) {
  return (
    <section className={`sec ${alt ? 'sec--paper' : 'sec--white'} sec--tight h-sec`} id="trust">
      <div className="wrap">
        <SectionHead eyebrow="Trust" title="How Universta keeps information honest" />
        <div className="h-grid h-grid--4">
          <div className="h-card h-card--plain">
            <strong className="h-card__t">Official sources first</strong>
            <span className="h-card__d">
              Fees, deadlines and requirements come from official sources. When a detail is
              not confirmed we say so and ask you to check the official website.
            </span>
          </div>
          <div className="h-card h-card--plain">
            <strong className="h-card__t">No invented numbers</strong>
            <span className="h-card__d">
              We do not create fees, deadlines, reviews, ratings, rankings or statistics that
              the source does not publish.
            </span>
          </div>
          <div className="h-card h-card--plain">
            <strong className="h-card__t">No guarantees</strong>
            <span className="h-card__d">
              No one on Universta can guarantee admission, a visa, a test score or a
              scholarship. Listings that promise this are removed.
            </span>
          </div>
          <div className="h-card h-card--plain">
            <strong className="h-card__t">Verification you can see</strong>
            <span className="h-card__d">
              Verified badges appear only after Universta completes checks, with the date they
              were last verified.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * The catalogue previews: six of each, from what is published, each handing
 * on to the full listing. A section with nothing published stands down.
 * ------------------------------------------------------------------------- */

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function MoreLinks({ links }: { links: Array<{ href: string; label: string }> }) {
  return (
    <p className="h-more">
      {links.map((link) => (
        <Link className="linkcta" href={link.href} key={link.href}>
          {link.label}{' '}
          <span className="linkcta__arrow" aria-hidden="true">
            →
          </span>
        </Link>
      ))}
    </p>
  );
}

export type HomeSubject = {
  id: string;
  name: string;
  slug: string;
  shortDescription?: string | null;
  publishedCourseCount?: number | null;
  publishedSubSubjectCount?: number | null;
};

export function HomeSubjects({ subjects, alt = false }: { subjects: HomeSubject[]; alt?: boolean }) {
  if (!subjects.length) return null;
  return (
    <section className={`sec ${alt ? 'sec--paper' : 'sec--white'} sec--tight h-sec`} id="subjects">
      <div className="wrap">
        <SectionHead
          eyebrow="Subjects"
          title="Explore by subject"
          lead="Every subject connects to its specializations, courses, universities and scholarships."
        />
        <div className="h-grid h-grid--six">
          {subjects.map((subject) => (
            <HomeCard
              key={subject.id}
              title={subject.name}
              body={
                subject.publishedSubSubjectCount
                  ? plural(subject.publishedSubSubjectCount, 'specialization', 'specializations')
                  : (subject.shortDescription ?? '')
              }
              meta={
                subject.publishedCourseCount
                  ? plural(subject.publishedCourseCount, 'course', 'courses')
                  : undefined
              }
              href={`/subjects/${subject.slug}`}
            />
          ))}
        </div>
        <MoreLinks links={[{ href: '/subjects', label: 'All subjects' }]} />
      </div>
    </section>
  );
}

export type HomeUniversity = {
  id: string;
  name: string;
  slug: string;
  country?: { name: string } | null;
  campuses?: Array<{ city?: { name?: string | null } | null }> | null;
  _count?: { offerings?: number } | null;
};

export function HomeUniversities({
  universities,
  alt = false,
}: {
  universities: HomeUniversity[];
  alt?: boolean;
}) {
  if (!universities.length) return null;
  return (
    <section className={`sec ${alt ? 'sec--paper' : 'sec--white'} sec--tight h-sec`} id="universities">
      <div className="wrap">
        <SectionHead
          eyebrow="Universities"
          title="Universities on Universta"
          lead="Profiles built from official sources. No paid rankings."
        />
        <div className="h-grid h-grid--six">
          {universities.map((university) => {
            const city = university.campuses?.find((campus) => campus.city?.name)?.city?.name;
            const where = [city, university.country?.name].filter(Boolean).join(', ');
            const offerings = university._count?.offerings ?? 0;
            return (
              <HomeCard
                key={university.id}
                title={university.name}
                body={where}
                meta={offerings ? `${plural(offerings, 'course', 'courses')} on Universta` : undefined}
                href={`/universities/${university.slug}`}
              />
            );
          })}
        </div>
        <MoreLinks
          links={[
            { href: '/universities', label: 'Explore Universities' },
            { href: '/compare/universities', label: 'Compare universities' },
          ]}
        />
      </div>
    </section>
  );
}

export type HomeCourse = {
  id: string;
  name: string;
  slug: string;
  subject?: { name: string } | null;
  subSubject?: { name: string } | null;
  courseLevel?: { name: string } | null;
};

export function HomeCourses({ courses, alt = false }: { courses: HomeCourse[]; alt?: boolean }) {
  if (!courses.length) return null;
  return (
    <section className={`sec ${alt ? 'sec--paper' : 'sec--white'} sec--tight h-sec`} id="courses">
      <div className="wrap">
        <SectionHead
          eyebrow="Courses"
          title="Courses to explore"
          lead="Each course shows eligibility, documents, intakes and fees, or tells you to check the official website when a detail is not confirmed."
        />
        <div className="h-grid h-grid--six">
          {courses.map((course) => (
            <HomeCard
              key={course.id}
              title={course.name}
              body={[course.subSubject?.name ?? course.subject?.name].filter(Boolean).join('')}
              meta={course.courseLevel?.name}
              href={`/courses/${course.slug}`}
            />
          ))}
        </div>
        <MoreLinks links={[{ href: '/courses', label: 'Find courses' }]} />
      </div>
    </section>
  );
}

export type HomeScholarship = {
  id: string;
  title: string;
  slug: string;
  summary?: string | null;
  benefitType?: string | null;
  provider?: { name?: string | null } | null;
};

/** "PARTIAL_TUITION" -> "Partial tuition". The field is free text, not a list. */
function benefitLabel(value: string | null | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const words = value.trim().toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function HomeScholarships({
  scholarships,
  alt = false,
}: {
  scholarships: HomeScholarship[];
  alt?: boolean;
}) {
  if (!scholarships.length) return null;
  return (
    <section className={`sec ${alt ? 'sec--paper' : 'sec--white'} sec--tight h-sec`} id="scholarships">
      <div className="wrap">
        <SectionHead
          eyebrow="Scholarships"
          title="Funding to look into"
          lead="Eligibility is shown as published by the provider. A match is never a guarantee of an award."
        />
        <div className="h-grid h-grid--six">
          {scholarships.map((scholarship) => (
            <HomeCard
              key={scholarship.id}
              title={scholarship.title}
              body={scholarship.summary ?? scholarship.provider?.name ?? ''}
              meta={benefitLabel(scholarship.benefitType) ?? scholarship.provider?.name ?? undefined}
              href={`/scholarships/${scholarship.slug}`}
            />
          ))}
        </div>
        <MoreLinks links={[{ href: '/scholarships', label: 'Find Scholarships' }]} />
      </div>
    </section>
  );
}
