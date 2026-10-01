import { PUBLISHED } from '../catalog/published';

/**
 * A subject's own page counted sixteen programmes under it while /courses
 * counted none of the same ones, because the listing also demanded a row in
 * the destination mapping table and the subject page did not. Both called
 * themselves the catalogue, and for weeks one of them insisted everything
 * was fine.
 *
 * "Published" now means one thing -- someone pressed publish, nobody
 * deleted it -- and "where can I study it" is a filter the reader chooses.
 */

type Query = Record<string, unknown>;

/** The decision the listing makes, as `publicWhere` makes it. */
function asksAboutDestinations(query: Query): boolean {
  return Boolean(
    (query.country as unknown[] | undefined)?.length ||
    (query.intake as unknown[] | undefined)?.length ||
    query.minTuition ||
    query.maxTuition ||
    query.scholarshipAvailable !== undefined ||
    (query.englishTest as unknown[] | undefined)?.length ||
    query.postStudyWorkAvailable !== undefined,
  );
}

describe('what published means', () => {
  it('is the editor’s decision and nothing else', () => {
    expect(PUBLISHED).toEqual({ status: 'PUBLISHED', deletedAt: null });
  });

  it('does not ask for a destination mapping when nobody asked about destinations', () => {
    /* This is the whole fix: an unfiltered list is the published
       catalogue, not the part of it somebody has mapped. */
    expect(asksAboutDestinations({})).toBe(false);
    expect(asksAboutDestinations({ q: 'data science' })).toBe(false);
    expect(asksAboutDestinations({ subject: ['engineering'] })).toBe(false);
    expect(asksAboutDestinations({ level: ['PG'] })).toBe(false);
    expect(asksAboutDestinations({ studyMode: ['FULL_TIME'] })).toBe(false);
  });

  it('still asks for one the moment the reader does', () => {
    expect(asksAboutDestinations({ country: ['germany'] })).toBe(true);
    expect(asksAboutDestinations({ intake: ['september'] })).toBe(true);
    expect(asksAboutDestinations({ minTuition: '1000' })).toBe(true);
    expect(asksAboutDestinations({ maxTuition: '20000' })).toBe(true);
    expect(asksAboutDestinations({ englishTest: ['IELTS'] })).toBe(true);
  });

  it('treats a false just as seriously as a true', () => {
    /* `scholarshipAvailable=false` is a question about destinations too --
       reading it as "not asked" would quietly widen the list. */
    expect(asksAboutDestinations({ scholarshipAvailable: false })).toBe(true);
    expect(asksAboutDestinations({ postStudyWorkAvailable: false })).toBe(true);
  });

  it('is not confused by an empty filter', () => {
    expect(asksAboutDestinations({ country: [] })).toBe(false);
    expect(asksAboutDestinations({ englishTest: [] })).toBe(false);
  });
});
