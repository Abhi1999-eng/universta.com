/**
 * The country mark from the approved design: three colour bands and the ISO
 * code, rather than a flag image.
 *
 * There is no asset to host and no licence to check, and it renders the same
 * offline. A destination outside the reference list (a test record, say) falls
 * back to the neutral navy bands so the card keeps its shape instead of
 * collapsing.
 */
const NEUTRAL = ['#0C2038', '#1B3554', '#2A4A70'] as const;

export function FlagMark({
  name,
  iso2Code,
  bands,
}: {
  name: string;
  iso2Code: string | null;
  bands: readonly [string, string, string] | null;
}) {
  const colours = bands ?? NEUTRAL;
  /* Decorative: the country's name is always beside it as real text. */
  return (
    <span className="cchip__mark" aria-hidden="true">
      <span className="cchip__bands">
        {colours.map((colour, index) => (
          <span key={`${colour}-${index}`} style={{ background: colour }} />
        ))}
      </span>
      <span className="cchip__code">{iso2Code ?? name.slice(0, 2).toUpperCase()}</span>
    </span>
  );
}
