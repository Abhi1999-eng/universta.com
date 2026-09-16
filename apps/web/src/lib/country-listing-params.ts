/** Every query parameter the destination listing honours.
 *
 * Shared by the listing, which reads exactly these, and by the /countries
 * redirect in next.config, which sends a URL carrying any of them to the
 * homepage listing instead of the Study Abroad directory -- that directory has
 * none of these filters, so a shared search would otherwise silently widen.
 * One list, so the two cannot drift. */
export const COUNTRY_LISTING_PARAMS = [
  'q',
  'region',
  'budgetBand',
  'ieltsOptional',
  'intake',
  'visaSuccessBand',
  'pathwayStrength',
  'hasTopRankedUniversities',
  // Discovery filters. Each one is shareable, so each one lives in the URL.
  'subjects',
  'intakes',
  'ieltsMax',
  'postStudyWork',
  'postStudyWorkMonthsMin',
  'partTimeWork',
  'workHoursMin',
  'applicationFee',
  'universitiesMin',
  'currency',
  'tuitionMax',
  'livingMax',
  'sort',
  'page',
  // The listing is a shortlist by default. `view=all` opens the same page as
  // the full catalogue, so every filter already in the URL carries straight
  // over and there is no second destinations route to keep in step.
  'view',
] as const;
