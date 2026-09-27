/**
 * The country mark from the approved design: colour bands, rather than a flag
 * image.
 *
 * There is no asset to host and no licence to check, and it renders the same
 * offline. The ISO code used to be printed across the bands, which meant
 * holding them at a third of their opacity to keep the letters readable --
 * eight washed-out rectangles, each labelled with two letters the country's
 * own name already said beside it. A destination outside the reference list
 * (a test record, say) falls back to the neutral navy bands so the card keeps
 * its shape instead of collapsing.
 */
const NEUTRAL = ['#0C2038', '#1B3554', '#2A4A70'] as const;

export function FlagMark({
  bands,
}: {
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
    </span>
  );
}
