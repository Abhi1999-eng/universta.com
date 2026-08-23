import Link from 'next/link';
import type { Country } from '@/lib/countries';

export type StructuredNavItem = { id: string; label: string };

const monthName = new Intl.DateTimeFormat('en', { month: 'long' });
const month = (value: number) => monthName.format(new Date(2020, value - 1, 1));

export function structuredNavItems(country: Country): StructuredNavItem[] {
  const items: StructuredNavItem[] = [];
  if (country.configuration?.features.length) items.push({ id: 'country-features', label: 'Why study here' });
  if (country.configuration?.acceptedTests.length || country.configuration?.intakeMonths.length) items.push({ id: 'country-admissions', label: 'Admissions' });
  if (country.derived?.averageTuition || country.derived?.statistics) items.push({ id: 'country-statistics', label: 'Statistics' });
  if (country.derived?.topRankedUniversities.length || country.derived?.popularUniversities.length) items.push({ id: 'country-universities', label: 'Universities' });
  if (country.derived?.popularCourses.length) items.push({ id: 'country-courses', label: 'Courses' });
  return items;
}

export function CountryStructuredSections({ country }: { country: Country }) {
  const configuration = country.configuration;
  const derived = country.derived;
  const tuition = derived?.averageTuition;
  return (
    <>
      {configuration?.features.length ? (
        <section id="country-features" className="structured-section editorial-section">
          <SectionHeading eyebrow="Destination overview" title={`Why study in ${country.name}`} />
          <div className="flex flex-wrap gap-2">
            {configuration.features.map((feature) => (
              <span key={feature.code} className="rounded-full border border-[#D9E0EA] bg-[#F8FAFC] px-3 py-2 text-sm font-semibold text-[#344054]">{feature.label}</span>
            ))}
          </div>
        </section>
      ) : null}
      {configuration && (configuration.acceptedTests.length || configuration.intakeMonths.length || configuration.postStudyWorkPermitMonths !== null) ? (
        <section id="country-admissions" className="structured-section editorial-section">
          <SectionHeading eyebrow="Destination guidance" title="Admissions at a glance" />
          <div className="structured-grid">
            {configuration.acceptedTests.length ? <Fact label="Accepted English tests" value={configuration.acceptedTests.join(', ')} /> : null}
            {configuration.intakeMonths.length ? <Fact label="Available intakes" value={configuration.intakeMonths.map(month).join(', ')} /> : null}
            {configuration.postStudyWorkPermitMonths !== null ? <Fact label="Post-study work permit" value={`Up to ${configuration.postStudyWorkPermitMonths} months`} /> : null}
          </div>
        </section>
      ) : null}
      {derived?.statistics ? (
        <section id="country-statistics" className="structured-section editorial-section">
          <SectionHeading eyebrow="Published catalogue data" title="Study destination statistics" />
          <div className="structured-grid">
            <Fact label="Universities" value={derived.statistics.universitiesCount} />
            <Fact label="Public universities" value={derived.statistics.publicUniversitiesCount} />
            <Fact label="University courses" value={derived.statistics.coursesCount} />
            {tuition ? <Fact label="Average Tuition" value={`${tuition.currencySymbol ?? tuition.currencyCode} ${tuition.amount}`} /> : null}
          </div>
        </section>
      ) : null}
      {derived?.topRankedUniversities.length || derived?.popularUniversities.length ? (
        <section id="country-universities" className="structured-section editorial-section">
          <SectionHeading eyebrow="Published university data" title="Universities to explore" />
          <div className="structured-grid">
            {[...derived.popularUniversities, ...derived.topRankedUniversities.filter((university) => !derived.popularUniversities.some((popular) => popular.id === university.id))].slice(0, 10).map((university) => (
              <Link className="structured-fact" key={university.id} href={`/universities/${university.slug}`}>
                <span>{university.name}</span>
                <strong>{university.qsRanking ? `QS #${university.qsRanking}` : 'View university'}</strong>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      {derived?.popularCourses.length ? (
        <section id="country-courses" className="structured-section editorial-section">
          <SectionHeading eyebrow="Curated courses" title="Popular courses" />
          <div className="structured-grid">
            {derived.popularCourses.map((course) => (
              <Link className="structured-fact" key={course.id} href={`/courses/${course.slug}`}>
                <span>{course.name}</span>
                <strong>{course.shortDescription ?? 'View course'}</strong>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="section-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
    </div>
  );
}
function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="structured-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
