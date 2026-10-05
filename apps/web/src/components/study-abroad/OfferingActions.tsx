'use client';

import { useEffect, useState } from 'react';
import { useStudyAbroadShell } from './StudyAbroadShell';

/**
 * The course page's two controls that need the browser.
 *
 * "Check my eligibility" opens the route family's assessment with the
 * course's destination already answered -- the shell only works the country
 * out for itself on a country guide, and a course page sits five levels
 * below one. The sticky bar is the design's "Is this course right for you?"
 * line, which slides up once the hero and its own eligibility button have
 * scrolled away.
 */

export function EligibilityButton({
  className,
  intent,
  countrySlug,
  countryName,
  children,
}: {
  className: string;
  intent: string;
  countrySlug: string;
  countryName: string;
  children: React.ReactNode;
}) {
  const { openAssessment } = useStudyAbroadShell();
  return (
    <button
      className={className}
      type="button"
      onClick={() => openAssessment({ countrySlug, countryName, intent })}
      data-testid={`assessment-cta-${intent}`}
    >
      {children}{' '}
      <span className="btn__arrow" aria-hidden="true">
        &rarr;
      </span>
    </button>
  );
}

export function CourseSticky({
  mark,
  name,
  university,
  countrySlug,
  countryName,
  /** The element whose passing shows the bar: the page's hero. */
  after,
}: {
  mark: string;
  name: string;
  university: string;
  countrySlug: string;
  countryName: string;
  after: string;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const target = document.getElementById(after);
    if (!target || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) =>
      setShow(!entry!.isIntersecting && entry!.boundingClientRect.top < 0),
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [after]);

  return (
    /* Off screen until the hero has gone, and out of the tab order with it. */
    <div className="coursesticky" data-show={String(show)} inert={!show}>
      <div className="wrap coursesticky__inner">
        <div className="coursesticky__id">
          <span className="unimark unimark--xs" aria-hidden="true">
            {mark}
          </span>
          <span>
            <b>Is this course right for you?</b>
            <em>
              {name} · {university}
            </em>
          </span>
        </div>
        <EligibilityButton
          className="btn btn--sm"
          intent="course-sticky"
          countrySlug={countrySlug}
          countryName={countryName}
        >
          Check my eligibility
        </EligibilityButton>
      </div>
    </div>
  );
}
