/**
 * Regenerates the country reference table: every country's ISO codes, its
 * currency, and the colours its flag is actually made of.
 *
 * Run it when a country changes its flag or its currency -- both rare, a
 * handful a decade -- and commit the diff:
 *
 *     node scripts/country-table/generate.mjs
 *
 * It writes two files, because the API and the Admin cannot import from each
 * other and a currency list that disagrees between them is worse than one
 * copy. Generating both from the same pass is what keeps them the same.
 *
 * Where the facts come from
 * -------------------------
 * ISO codes and currencies: `world-countries` (mledoze/countries), the same
 * data ISO 3166 and 4217 publish. Checked against the 83 destinations this
 * project had already curated by hand: every ISO code and currency code
 * matched, which is the evidence for trusting it on the rest.
 *
 * Flag colours: the `flag-icons` SVGs (MIT), rendered and counted by pixel.
 * Reading `fill` attributes instead gets the wrong answer often enough to be
 * useless -- German red is written `fill="red"`, plenty of flags use short
 * hex, and the order attributes appear in says nothing about how much of the
 * flag a colour covers. Denmark is three quarters red with a white cross, not
 * three equal stripes, and only rendering it says so.
 *
 * Currency symbols already curated here win over the dataset's. The dataset
 * calls the Kenyan, Tanzanian and Ugandan shillings all "Sh"; "KSh", "TSh"
 * and "USh" tell a reader which country they are looking at.
 */

import { chromium } from '@playwright/test';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = new URL('../../', import.meta.url).pathname;
const WORLD = 'https://cdn.jsdelivr.net/npm/world-countries@5.1.0/countries.json';
const FLAGS = 'https://registry.npmjs.org/flag-icons/-/flag-icons-7.5.0.tgz';

/** A colour under this share of the flag is an edge, not a band. */
const NOISE = 0.02;
const MAX_BANDS = 3;

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/**
 * Whether a colour is just the seam between two the flag already has.
 *
 * Rendering leaves a line of blended pixels wherever two colours meet, and a
 * long seam can out-count a small real detail: Denmark's white cross on red
 * produces enough pink along its edges to look like a third band, and then
 * its mark reads as a washed-out tricolour instead of a flag. A blend sits on
 * the line between the two colours it came from, which is what this asks.
 */
function isSeam(candidate, chosen) {
  const c = rgb(candidate);
  for (let i = 0; i < chosen.length; i += 1)
    for (let j = i + 1; j < chosen.length; j += 1) {
      const a = rgb(chosen[i]);
      const b = rgb(chosen[j]);
      const ab = b.map((v, k) => v - a[k]);
      const denominator = ab.reduce((sum, v) => sum + v * v, 0) || 1;
      const t = c.reduce((sum, v, k) => sum + (v - a[k]) * ab[k], 0) / denominator;
      /* Near either end it is the colour itself, not a blend of the pair. */
      if (t <= 0.12 || t >= 0.88) continue;
      const point = a.map((v, k) => v + t * ab[k]);
      const distance = Math.hypot(...c.map((v, k) => v - point[k]));
      if (distance < 34) return true;
    }
  return false;
}

/* The dataset leaves four entries without a currency -- Antarctica, Bouvet,
   Heard and Micronesia -- and only the last is a place anyone studies in. */
const CURRENCY_GAPS = { FM: { code: 'USD', name: 'United States dollar', symbol: '$' } };

const read = (path) => readFileSync(join(ROOT, path), 'utf8');

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}

function downloadFlags() {
  const dir = mkdtempSync(join(tmpdir(), 'flags-'));
  execFileSync('sh', ['-c', `curl -sL "${FLAGS}" | tar xz -C "${dir}"`]);
  return join(dir, 'package/flags/4x3');
}

/** The countries the directory offers, by ISO code, with the name it uses. */
function listedCountries() {
  const source = read('apps/api/src/countries/directory-world.ts');
  const found = new Map();
  for (const match of source.matchAll(
    /\[\s*'([^']+)',\s*'([^']+)',\s*'([^']{2})'\s*\]/g,
  ))
    found.set(match[3], { name: match[1], region: match[2] });
  /* Nothing to write is never the right answer, and an empty table type-checks
     and lints perfectly happily -- it only fails much later, where it is read.
     This is the shape of the world list changing under the regex above. */
  if (found.size < 150)
    throw new Error(
      `read only ${found.size} countries from the world list; the file's shape has changed`,
    );
  return found;
}

/** What this project already publishes, which the dataset may not improve on. */
function curated() {
  const source = read('apps/api/src/countries/country-metadata.ts');
  const found = new Map();
  for (const match of source.matchAll(
    /\{\s*name: '([^']+)',\s*iso2Code: '([^']+)',\s*iso3Code: '([^']+)',\s*currencyCode: '([^']+)',\s*currencySymbol: '([^']*)'/g,
  ))
    found.set(match[2], {
      name: match[1],
      iso3: match[3],
      currencyCode: match[4],
      currencySymbol: match[5],
    });
  return found;
}

async function flagColours(dir) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<canvas id="c" width="80" height="60"></canvas>');
  const out = new Map();

  for (const file of readdirSync(dir).filter((name) => name.endsWith('.svg'))) {
    /* No width or height on these, only a viewBox, and a canvas draws such an
       image at nothing at all. */
    const svg = readFileSync(join(dir, file), 'utf8').replace(
      '<svg',
      '<svg width="80" height="60"',
    );
    const counted = await page.evaluate(async (source) => {
      const canvas = document.getElementById('c');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const image = new Image();
      const drawn = await new Promise((resolve) => {
        image.onload = () => resolve(true);
        image.onerror = () => resolve(false);
        image.src =
          'data:image/svg+xml;base64,' +
          btoa(unescape(encodeURIComponent(source)));
      });
      if (!drawn) return [];
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

      /* Bucketed coarsely so anti-aliasing does not invent colours, then each
         bucket reports its own average rather than the rounded key -- that
         keeps the flag's real colour instead of an approximation of it. */
      const buckets = new Map();
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 200) continue;
        const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
        const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
        const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
        bucket.n += 1;
        bucket.r += r;
        bucket.g += g;
        bucket.b += b;
        buckets.set(key, bucket);
      }
      const total = [...buckets.values()].reduce((sum, b) => sum + b.n, 0) || 1;
      return [...buckets.values()]
        .sort((a, b) => b.n - a.n)
        .map((bucket) => ({
          colour:
            '#' +
            [bucket.r, bucket.g, bucket.b]
              .map((sum) =>
                Math.round(sum / bucket.n)
                  .toString(16)
                  .padStart(2, '0'),
              )
              .join(''),
          share: bucket.n / total,
        }));
    }, svg);
    out.set(file.replace('.svg', '').toUpperCase(), counted);
  }

  await browser.close();
  return out;
}

const world = await fetchJson(WORLD);
const byIso = new Map(world.map((entry) => [entry.cca2, entry]));
const listed = listedCountries();
const already = curated();
const colours = await flagColours(downloadFlags());

const rows = [];
const problems = [];
for (const [iso2, { name, region }] of [...listed].sort((a, b) =>
  a[0].localeCompare(b[0]),
)) {
  const entry = byIso.get(iso2);
  const mine = already.get(iso2);
  const currencies = Object.keys(entry?.currencies ?? {}).length
    ? entry.currencies
    : CURRENCY_GAPS[iso2]
      ? { [CURRENCY_GAPS[iso2].code]: CURRENCY_GAPS[iso2] }
      : {};
  const code = Object.keys(currencies)[0] ?? '';

  const row = {
    name,
    region,
    iso2,
    iso3: mine?.iso3 || entry?.cca3 || '',
    currencyCode: mine?.currencyCode || code,
    currencyName: currencies[code]?.name ?? '',
    currencySymbol: mine?.currencySymbol || currencies[code]?.symbol || '',
    bands: (colours.get(iso2) ?? [])
      .filter((band) => band.share >= NOISE)
      .reduce((kept, band) => {
        if (kept.length >= MAX_BANDS) return kept;
        if (kept.length >= 2 && isSeam(band.colour, kept.map((b) => b.colour)))
          return kept;
        kept.push({ colour: band.colour, share: Number(band.share.toFixed(3)) });
        return kept;
      }, []),
  };
  if (!row.bands.length) problems.push(`${name} (${iso2}): no flag artwork`);
  if (!row.currencyCode) problems.push(`${name} (${iso2}): no currency`);
  if (!row.iso3) problems.push(`${name} (${iso2}): no ISO3`);
  rows.push(row);
}

if (problems.length) {
  console.error('Incomplete rows:');
  for (const problem of problems) console.error('  -', problem);
  process.exit(1);
}

const banner = (what) => `/**
 * ${what}
 *
 * Generated by scripts/country-table/generate.mjs -- edit that, not this.
 * ISO codes and currencies from world-countries (ISO 3166 / 4217); flag
 * colours measured from the flag-icons SVGs (MIT) by rendering and counting
 * pixels, so a share is the share of the flag a colour covers.
 */
`;

writeFileSync(
  join(ROOT, 'apps/api/src/countries/country-table.ts'),
  banner('Every country this catalogue knows: its codes, its money, its flag.') +
    `
export type CountryBand = {
  /** As it appears in the flag. */
  colour: string;
  /** How much of the flag it covers, 0 to 1. */
  share: number;
};

export type CountryTableRow = {
  name: string;
  region: string;
  iso2: string;
  iso3: string;
  currencyCode: string;
  currencyName: string;
  currencySymbol: string;
  /** Most of the flag first. Two colours where the flag has two. */
  bands: readonly CountryBand[];
};

export const COUNTRY_TABLE: readonly CountryTableRow[] = ${JSON.stringify(
      rows,
      null,
      2,
    ).replace(/"([a-zA-Z0-9]+)":/g, '$1:')};

const BY_ISO2 = new Map(COUNTRY_TABLE.map((row) => [row.iso2, row]));

export function countryTableRow(iso2: string | null | undefined) {
  return iso2 ? (BY_ISO2.get(iso2.trim().toUpperCase()) ?? null) : null;
}
`,
);

/* The Admin cannot import from the API, so its currency list is written here
   from the same pass rather than kept by hand beside it. */
const currencies = new Map();
for (const row of rows)
  if (row.currencyCode && !currencies.has(row.currencyCode))
    currencies.set(row.currencyCode, {
      code: row.currencyCode,
      name: row.currencyName || row.currencyCode,
      symbol: row.currencySymbol || row.currencyCode,
    });

writeFileSync(
  join(ROOT, 'apps/admin/src/features/catalog/currency-options.ts'),
  banner(
    "The currency list the Country editor selects from.\n *\n * Currency name, code and symbol used to be three free-text inputs, so\n * nothing stopped \"Euro / USD / £\" being saved. They are one choice now, and\n * this table is that choice's vocabulary.",
  ) +
    `
export type CurrencyOption = { code: string; name: string; symbol: string };

export const CURRENCY_OPTIONS: readonly CurrencyOption[] = ${JSON.stringify(
      [...currencies.values()].sort((a, b) => a.code.localeCompare(b.code)),
      null,
      2,
    ).replace(/"([a-zA-Z0-9]+)":/g, '$1:')};

const BY_CODE = new Map(CURRENCY_OPTIONS.map((row) => [row.code, row]));

export function currencyByCode(code: string | null | undefined) {
  return code ? (BY_CODE.get(code.trim().toUpperCase()) ?? null) : null;
}

/** Matches a stored currency however it was recorded, so legacy rows that hold
 * only a name or only a symbol still select the right option. */
export function matchCurrency(value: {
  code?: string | null;
  name?: string | null;
  symbol?: string | null;
}) {
  const byCode = currencyByCode(value.code);
  if (byCode) return byCode;
  const name = value.name?.trim().toLowerCase();
  if (name) {
    const found = CURRENCY_OPTIONS.find((row) => row.name.toLowerCase() === name);
    if (found) return found;
  }
  const symbol = value.symbol?.trim();
  if (symbol) {
    const matches = CURRENCY_OPTIONS.filter((row) => row.symbol === symbol);
    /* Only when it is unambiguous -- "$" belongs to several currencies, and
     * guessing one would silently rewrite the operator's data. */
    if (matches.length === 1) return matches[0];
  }
  return null;
}

/**
 * The flag is derived from the ISO code rather than uploaded: two regional
 * indicator letters are the flag emoji for that country, so \`MT\` renders as
 * the Maltese flag with nothing to upload and nothing to keep in sync.
 */
export function flagEmojiFromIso(iso2: string | null | undefined) {
  const code = iso2?.trim().toUpperCase() ?? '';
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(
    ...[...code].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65),
  );
}
`,
);

/* The repo's lint rewrites quotes and trailing commas, and CI fails a build
   whose tree is not clean afterwards. Formatting the output here means
   generating and then linting leaves nothing to commit twice. */
for (const [workspace, file] of [
  ['apps/api', 'src/countries/country-table.ts'],
  ['apps/admin', 'src/features/catalog/currency-options.ts'],
])
  execFileSync(
    'npx',
    ['eslint', '--fix', '--no-ignore', file],
    { cwd: join(ROOT, workspace), stdio: 'ignore' },
  );

console.log(`countries   : ${rows.length}`);
console.log(`currencies  : ${currencies.size}`);
console.log(`with bands  : ${rows.filter((row) => row.bands.length).length}`);
