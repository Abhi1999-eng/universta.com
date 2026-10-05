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
  sourcePagePath,
  children,
}: {
  className: string;
  intent: string;
  countrySlug: string;
  countryName: string;
  /** The course page's own address. The lead is filed under it, so a
   *  counsellor can see which course the student was reading; without it
   *  the assessment files the lead under the country. */
  sourcePagePath: string;
  children: React.ReactNode;
}) {
  const { openAssessment } = useStudyAbroadShell();
  return (
    <button
      className={className}
      type="button"
      onClick={() =>
        openAssessment({ countrySlug, countryName, intent, sourcePagePath })
      }
      data-testid={`assessment-cta-${intent}`}
    >
      {children}{' '}
      <span className="btn__arrow" aria-hidden="true">
        &rarr;
      </span>
    </button>
  );
}

/** How near the foot of a page with no footer the bar stands down: the
 *  design's own script uses the same distance. */
const END_ZONE = 360;

export function CourseSticky({
  mark,
  name,
  university,
  countrySlug,
  countryName,
  sourcePagePath,
  after,
}: {
  mark: string;
  name: string;
  university: string;
  countrySlug: string;
  countryName: string;
  sourcePagePath: string;
  /** The element whose passing shows the bar: the page's hero. */
  after: string;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const target = document.getElementById(after);
    if (!target) return;
    /* Up once the hero has gone, and down again at the end of the page, as
       the design's script has it. Fixed to the foot of the screen, the bar
       would otherwise sit over the site's footer for good once a reader
       reached it, hiding its last line. */
    const update = () => {
      const footer = document.querySelector<HTMLElement>('footer.footer');
      const end = footer
        ? footer.getBoundingClientRect().top < window.innerHeight
        : window.innerHeight + window.scrollY >=
          document.documentElement.scrollHeight - END_ZONE;
      setShow(target.getBoundingClientRect().bottom < 0 && !end);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
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
          sourcePagePath={sourcePagePath}
        >
          Check my eligibility
        </EligibilityButton>
      </div>
    </div>
  );
}
