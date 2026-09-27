/**
 * The country mark: the country's own flag.
 *
 * It used to be three colour bands, which can say what a flag is made of and
 * not what it looks like. India's stripes run across and were drawn down the
 * chip, so it read as Ivory Coast; Japan's disc is not a stripe at all, so it
 * came out as three bands of a flag nobody flies. Of the 206 flags in the
 * table, 40 are upright stripes and the bands were right; the other 166 were
 * not. A mark 38 pixels wide has room for the real thing.
 *
 * The artwork is the same MIT-licensed set the band colours are measured
 * from, shipped from this repo rather than fetched, so there is nothing to
 * depend on at runtime and the two can never disagree. The bands stay
 * underneath: they are what a destination outside the reference list gets,
 * and what shows for the moment before the file arrives.
 *
 * The rule under a country's name on its own page is a different mark. Five
 * pixels tall, it is an accent rather than a picture, and it keeps the bands.
 */
const NEUTRAL = ['#0C2038', '#1B3554', '#2A4A70'] as const;

export function FlagMark({
  iso2Code,
  bands,
}: {
  iso2Code: string | null;
  bands: readonly [string, string, string] | null;
}) {
  const colours = bands ?? NEUTRAL;
  const code = iso2Code?.trim().toLowerCase();
  /* Decorative: the country's name is always beside it as real text. */
  return (
    <span className="cchip__mark" aria-hidden="true">
      <span className="cchip__bands">
        {colours.map((colour, index) => (
          <span key={`${colour}-${index}`} style={{ background: colour }} />
        ))}
      </span>
      {code ? (
        /* eslint-disable-next-line @next/next/no-img-element --
           next/image rasterises and would turn a 700-byte vector into a
           request per size; the file is already the right thing to send. */
        <img
          className="cchip__flag"
          src={`/flags/${code}.svg`}
          alt=""
          loading="lazy"
          decoding="async"
        />
      ) : null}
    </span>
  );
}
