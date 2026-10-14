import Link from 'next/link';
import { countryConsultantsHref } from '@/lib/country-consultant-list';

/**
 * The design's "Need help applying?" band, on the finder and on each award.
 *
 * The reference opens a lead form from each option; here the first opens
 * the assessment and the rest go where the help is, each narrowed to the
 * award's destination when the page knows one with a guide of its own.
 */
export function ScholarshipSupport({ countrySlug = null }: { countrySlug?: string | null }) {
  const counselling = countrySlug
    ? `/counselling?source=scholarships&country=${countrySlug}`
    : '/counselling?source=scholarships';
  return (
    <section className="sec sec--paper" id="help">
      <div className="wrap">
        <div className="schsupport">
          <div className="schsupport__head">
            <p className="eyebrow eyebrow--plain">Application support</p>
            <h2 className="sec-title schsupport__title">Need help applying?</h2>
            <p className="sec-lead">
              Universta helps you understand the requirements and plan the application, and
              connects you with a relevant consultant where that helps.
            </p>
          </div>
          <div className="schsupport__opts">
            <button className="schopt" type="button" data-open-assessment data-intent="scholarships">
              <b>Understand eligibility</b>
              <span>Check what the requirements mean for your profile.</span>
              <i aria-hidden="true">&rarr;</i>
            </button>
            <Link className="schopt" href={counselling}>
              <b>Prepare documents</b>
              <span>Plan transcripts, references and statements in time.</span>
              <i aria-hidden="true">&rarr;</i>
            </Link>
            <Link className="schopt" href={countrySlug ? `/courses?country=${countrySlug}` : '/courses'}>
              <b>Choose university and course</b>
              <span>Many awards need an admission offer first.</span>
              <i aria-hidden="true">&rarr;</i>
            </Link>
            <Link
              className="schopt"
              href={countrySlug ? countryConsultantsHref(countrySlug) : '/study-abroad-consultants'}
            >
              <b>Find a relevant consultant</b>
              <span>Independent consultants who list the destination and its universities.</span>
              <i aria-hidden="true">&rarr;</i>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
