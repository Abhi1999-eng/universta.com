/**
 * The filter rail asks for one count per option. Narrowing the options to
 * the ones a published course actually carries is what keeps that from
 * being 1,340 queries -- but the narrowing has to be made of the same
 * thing the count is made of.
 *
 * It is not ids. `publicWhere` matches a specialization by `slug`, and a
 * specialization slug is unique only inside its subject (`subjectId_slug`).
 * Two rows can therefore share "machine-learning", and a count for that
 * slug covers both. Narrowing on the id alone dropped the sibling whose own
 * id no course carried, even though its count would have come back above
 * zero and the reader had been seeing it.
 */

type Option = { id?: string; value: string; label: string };

/** The narrowing exactly as `counted` performs it. */
function worthCounting(
  options: Option[],
  inUse: Set<string> | undefined,
  selected: string[] = [],
) {
  const valuesInUse = inUse
    ? new Set(
        options
          .filter((option) => !option.id || inUse.has(option.id))
          .map((option) => option.value),
      )
    : null;
  return (
    valuesInUse
      ? options.filter(
          (option) =>
            valuesInUse.has(option.value) || selected.includes(option.value),
        )
      : options
  ).map((option) => option.value);
}

const ML_COMPUTING: Option = {
  id: 'spec-1',
  value: 'machine-learning',
  label: 'Machine Learning',
};
const ML_ENGINEERING: Option = {
  id: 'spec-2',
  value: 'machine-learning',
  label: 'Machine Learning',
};
const UNUSED: Option = { id: 'spec-3', value: 'basket-weaving', label: 'BW' };

describe('narrowing the options before counting them', () => {
  it('drops an option nothing is filed under', () => {
    expect(worthCounting([ML_COMPUTING, UNUSED], new Set(['spec-1']))).toEqual([
      'machine-learning',
    ]);
  });

  it('keeps a same-slug sibling whose own id is unused', () => {
    /* `spec-2` is carried by nothing, but it shares its slug with `spec-1`,
       which is -- and the count is made on the slug, so it is above zero. */
    expect(
      worthCounting([ML_COMPUTING, ML_ENGINEERING], new Set(['spec-1'])),
    ).toEqual(['machine-learning', 'machine-learning']);
  });

  it('still drops a shared slug when neither side is carried', () => {
    expect(
      worthCounting([ML_COMPUTING, ML_ENGINEERING, UNUSED], new Set(['x'])),
    ).toEqual([]);
  });

  it('keeps a selected value even when nothing carries it', () => {
    /* The rail has to be able to show the filter just ticked, at zero. */
    expect(
      worthCounting([UNUSED], new Set(['spec-1']), ['basket-weaving']),
    ).toEqual(['basket-weaving']);
  });

  it('keeps every option for a facet with no in-use set', () => {
    /* Intakes and English tests are short lists that do not hang off the
       course row; narrowing them would cost more than it saves. */
    expect(worthCounting([ML_COMPUTING, UNUSED], undefined)).toEqual([
      'machine-learning',
      'basket-weaving',
    ]);
  });

  it('keeps an option that carries no id at all', () => {
    const noId: Option = { value: 'IELTS', label: 'IELTS' };
    expect(worthCounting([noId], new Set())).toEqual(['IELTS']);
  });
});
