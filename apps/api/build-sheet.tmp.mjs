import ExcelJS from 'exceljs';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/* ---------------------------------------------------------------------------
 * Sources. Everything numeric on this sheet is either (a) published by a named
 * authority, (b) a figure for a destination we know first hand, or (c) an
 * indicative band keyed to the World Bank income classification -- and the
 * Columns tab says which of the three each column is. Nothing is invented to
 * fill a cell.
 * ------------------------------------------------------------------------- */

/* Downloads are cached so a rebuild is reproducible and does not hammer the
   World Bank and UNESCO endpoints. Delete the directory to refresh. */
const CACHE = join(tmpdir(), 'universta-country-sheet');

async function cached(name, url, pick = (x) => x) {
  mkdirSync(CACHE, { recursive: true });
  const file = join(CACHE, name);
  if (existsSync(file)) return pick(JSON.parse(readFileSync(file, 'utf8')));
  const body = await fetch(url).then((r) => r.json());
  writeFileSync(file, JSON.stringify(body));
  return pick(body);
}

const world = await cached('world.json', 'https://cdn.jsdelivr.net/npm/world-countries@5.1.0/countries.json');
const byIso = new Map(world.map((e) => [e.cca2, e]));

/* World Bank income classification: the basis for every indicative band. */
const income = await cached('wb.json', 'https://api.worldbank.org/v2/country?format=json&per_page=400', (b) =>
  Object.fromEntries(b[1].filter((r) => r.region.id !== 'NA').map((r) => [r.iso2Code, r.incomeLevel.id])),
);
/* Not in the World Bank list; both are unambiguously high income. */
income.TW ??= 'HIC';
income.VA ??= 'HIC';

/* UNESCO UIS 26637, "Total inbound internationally mobile students". */
const inbound = await cached(
  'uis-26637.json',
  'https://api.uis.unesco.org/api/public/data/indicators?indicator=26637&start=2012&end=2025',
  (b) => {
    const best = {};
    for (const r of b.records) {
      if (!r.value) continue;
      if (!best[r.geoUnit] || r.year > best[r.geoUnit].year)
        best[r.geoUnit] = { year: r.year, value: Math.round(r.value) };
    }
    return best;
  },
);

/* ---------------------------------------------------------------------------
 * Destinations we can speak about precisely. Anything we are not sure of is
 * left null here rather than guessed -- a null falls through to the indicative
 * band for money, and stays empty for a policy fact.
 * ------------------------------------------------------------------------- */

const D = (cur, tuition, living, appFee, intakes, visa, visaFee, proc, psw, work, ielts) =>
  ({ cur, tuition, living, appFee, intakes, visa, visaFee, proc, psw, work, ielts });

const SEP_JAN = 'September | January';
const SEP_FEB = 'September | February intake';

const CURATED = {
  GB: D('GBP', [11400, 38000], [1140, 1700], '0-30', SEP_JAN, 'Student visa', 'GBP 524', '3 weeks', 24, 20, 6.5),
  US: D('USD', [10000, 60000], [1000, 2500], '50-100', SEP_JAN, 'F-1 student visa', 'USD 185', '3 to 8 weeks', 12, 20, 6.5),
  CA: D('CAD', [15000, 40000], [1200, 2000], '100-250', SEP_JAN, 'Study permit', 'CAD 150', '4 to 12 weeks', 36, 24, 6.5),
  AU: D('AUD', [20000, 50000], [2000, 2800], '50-150', 'February intake | July intake', 'Student visa (subclass 500)', 'AUD 2000', '4 to 12 weeks', 24, 24, 6.5),
  NZ: D('NZD', [22000, 40000], [1500, 2200], '100-200', 'February intake | July intake', 'Student visa', 'NZD 485', '4 to 8 weeks', 36, 20, 6.0),
  IE: D('EUR', [10000, 25000], [1000, 1500], '50-100', SEP_JAN, 'Study visa (D)', 'EUR 60', '4 to 8 weeks', 24, 20, 6.5),
  DE: D('EUR', [0, 20000], [850, 1200], '75', SEP_FEB, 'National visa (D) for study', 'EUR 75', '6 to 12 weeks', 18, 20, 6.0),
  FR: D('EUR', [170, 15000], [800, 1200], '0-100', SEP_JAN, 'VLS-TS etudiant', 'EUR 99', '2 to 4 weeks', 24, 20, 6.0),
  NL: D('EUR', [6000, 20000], [900, 1400], '100', SEP_FEB, 'MVV and residence permit', 'EUR 228', '2 to 8 weeks', 12, 16, 6.5),
  IT: D('EUR', [900, 5000], [700, 1100], '0-50', SEP_FEB, 'Type D student visa', 'EUR 50', '3 to 6 weeks', 12, 20, 6.0),
  ES: D('EUR', [750, 12000], [700, 1100], '0-100', SEP_FEB, 'Student visa (type D)', 'EUR 80', '2 to 4 weeks', 12, 30, 6.0),
  PT: D('EUR', [1000, 7000], [700, 1000], '0-100', SEP_FEB, 'Student visa (type D)', 'EUR 90', '3 to 8 weeks', 12, 20, 6.0),
  AT: D('EUR', [1500, 5000], [900, 1300], '0-100', SEP_FEB, 'Student residence permit', 'EUR 160', '4 to 12 weeks', 12, 20, 6.0),
  BE: D('EUR', [900, 6000], [850, 1200], '0-200', SEP_FEB, 'Type D student visa', 'EUR 250', '4 to 8 weeks', 12, 20, 6.0),
  CH: D('CHF', [1000, 8000], [1600, 2500], '50-150', SEP_FEB, 'National visa (D) for study', 'CHF 100', '8 to 12 weeks', 6, 15, 6.5),
  SE: D('SEK', [80000, 160000], [9000, 12000], '900', SEP_JAN, 'Residence permit for studies', 'SEK 1500', '1 to 3 months', 12, null, 6.0),
  NO: D('NOK', [80000, 500000], [12000, 15000], '0', SEP_JAN, 'Student residence permit', 'NOK 5400', '6 to 12 weeks', 12, 20, 6.0),
  DK: D('DKK', [45000, 120000], [7000, 10000], '0-750', SEP_FEB, 'Student residence permit', 'DKK 2110', '1 to 2 months', null, 20, 6.5),
  FI: D('EUR', [6000, 18000], [700, 1100], '0-100', SEP_JAN, 'Student residence permit', 'EUR 450', '1 to 3 months', 24, 30, 6.0),
  PL: D('PLN', [8000, 30000], [2500, 4000], '0-200', SEP_FEB, 'National visa (D) for study', 'EUR 80', '2 to 6 weeks', 12, null, 6.0),
  CZ: D('CZK', [100000, 350000], [15000, 25000], '500-1500', SEP_FEB, 'Long-stay visa for study', 'CZK 2500', '2 to 3 months', 9, null, 6.0),
  HU: D('HUF', [1500000, 6000000], [200000, 350000], '0-100000', SEP_FEB, 'Student residence permit', 'EUR 60', '3 to 8 weeks', 9, 24, 6.0),
  JP: D('JPY', [535800, 1500000], [80000, 150000], '5000-30000', 'April intake | October intake', 'Student visa (ryugaku)', 'JPY 3000', '1 to 3 months', 12, 28, 6.0),
  KR: D('KRW', [4000000, 12000000], [700000, 1200000], '50000-150000', 'March intake | September', 'D-2 student visa', 'KRW 60000', '2 to 4 weeks', 24, 20, 5.5),
  CN: D('CNY', [20000, 60000], [2000, 4000], '400-800', 'September | March intake', 'X1 student visa', 'CNY 400', '2 to 6 weeks', null, null, 6.0),
  SG: D('SGD', [20000, 45000], [1200, 2000], '20-100', 'August intake | January', "Student's Pass", 'SGD 90', '2 to 4 weeks', 12, 16, 6.5),
  MY: D('MYR', [10000, 40000], [1500, 2500], '100-500', 'September | February intake', 'Student Pass', 'MYR 1000', '4 to 8 weeks', 12, 20, 6.0),
  AE: D('AED', [40000, 100000], [4000, 7000], '200-1000', 'September | January', 'Student residence visa', 'AED 3000', '2 to 4 weeks', 12, null, 6.0),
  IN: D('INR', [25000, 900000], [12000, 35000], '500-3000', 'July intake | January', 'Student Visa (S-1)', null, '2 to 4 weeks', null, null, 6.0),
  ZA: D('ZAR', [40000, 120000], [6000, 11000], '100-500', 'February intake | July intake', 'Study visa', 'ZAR 425', '4 to 8 weeks', null, 20, 6.0),
};

/* Indicative bands, by World Bank income group, quoted in USD. These describe
   what an international student typically pays across a group; they are a
   planning range, never a quote, and the public page labels them as such. */
const BAND = {
  HIC: { tuition: [6000, 25000], living: [900, 1800], appFee: '50-120', ielts: 6.0 },
  UMC: { tuition: [3000, 12000], living: [450, 1000], appFee: '30-80', ielts: 6.0 },
  LMC: { tuition: [1500, 7000], living: [300, 700], appFee: '20-60', ielts: 6.0 },
  LIC: { tuition: [800, 4000], living: [200, 500], appFee: '10-40', ielts: 6.0 },
};

const EU = new Set('AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE'.split(' '));
const SCHENGEN = new Set('AT BE BG CZ HR DK EE FI FR DE GR HU IS IT LV LI LT LU MT NL NO PL PT RO SK SI ES SE CH'.split(' '));

/* ------------------------------------------------------------------------ */

const list = (a) => (a.length <= 1 ? a[0] ?? '' : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const money = (n) => Number(n).toLocaleString('en-US');
const NAME = { GB: 'United Kingdom', US: 'United States' };

const BY_SUB = { 'South America': 'South America', 'Central America': 'North America', 'North America': 'North America', Caribbean: 'North America', 'Northern America': 'North America', 'Western Asia': 'Middle East', 'Australia and New Zealand': 'Australia & New Zealand', Melanesia: 'Australia & New Zealand', Micronesia: 'Australia & New Zealand', Polynesia: 'Australia & New Zealand' };
const BY_REGION = { Africa: 'Africa', Asia: 'Asia', Europe: 'Europe', Americas: 'North America', Oceania: 'Australia & New Zealand', Antarctic: '' };
const continentOf = (e) => BY_SUB[e?.subregion] ?? BY_REGION[e?.region] ?? '';

/** Everything a row's copy is written from. */
function facts(c) {
  const e = byIso.get(c.iso2);
  const languages = Object.values(e?.languages ?? {});
  const tier = income[c.iso2] ?? 'LMC';
  const cur = CURATED[c.iso2] ?? null;
  const band = BAND[tier];
  const students = inbound[c.iso3] ?? null;
  return {
    ...c,
    e,
    capital: e?.capital?.[0] ?? '',
    languages,
    languageText: list(languages),
    english: languages.includes('English'),
    where: e?.subregion || e?.region || '',
    north: (e?.latlng?.[0] ?? 0) >= 0,
    eu: EU.has(c.iso2),
    schengen: SCHENGEN.has(c.iso2),
    tier,
    cur,
    band,
    students,
    priced: (() => {
      const m = e?.currencies?.[c.currency];
      return m ? `${m.name}${m.symbol ? ` (${m.symbol})` : ''}` : '';
    })(),
    /* The currency every fee on the row is quoted in. A curated destination is
       quoted the way it publishes its own fees; everything else is quoted in
       USD, because converting an indicative band through an exchange rate we
       did not look up would only add false precision. */
    costCurrency: cur?.cur ?? 'USD',
    tuition: cur?.tuition ?? band.tuition,
    living: cur?.living ?? band.living,
    appFee: cur?.appFee ?? band.appFee,
    ielts: cur?.ielts ?? band.ielts,
    indicative: !cur,
  };
}

/* --- the four prose columns ---------------------------------------------- */

const TIER_TEXT = {
  HIC: 'high-income',
  UMC: 'upper-middle-income',
  LMC: 'lower-middle-income',
  LIC: 'low-income',
};

/** A zero floor is a real fact in places like Germany, and reads as a mistake
 *  unless it is said out loud rather than printed as "0 to 20,000". */
function tuitionSentence(f) {
  const [lo, hi] = f.tuition;
  return lo === 0
    ? `public universities charge no tuition to most students, and the range runs up to ${money(hi)} ${f.costCurrency} a year at private institutions`
    : `tuition runs ${money(lo)} to ${money(hi)} ${f.costCurrency} a year`;
}

const SYSTEM = {
  HIC: 'a mature, well-funded university system',
  UMC: 'a large university system that has grown quickly',
  LMC: 'a university system that is expanding fast and prices itself accordingly',
  LIC: 'a small university system where places at the established institutions go quickly',
};

function whyStudy(f) {
  const p = [];
  p.push(
    `<p>${f.name} sits in ${f.where}${f.capital ? `, with ${f.capital} as its capital` : ''}, and offers ${SYSTEM[f.tier]}.` +
      (f.eu ? ' It is a member of the European Union, so degrees carry recognition across the bloc and Erasmus+ mobility is open to you once you are enrolled.' : '') +
      (!f.eu && f.schengen ? ' It is part of the Schengen area, so a residence permit here lets you travel across most of Europe without a further visa.' : '') +
      '</p>',
  );
  p.push(
    f.english
      ? `<p>English is an official language, which removes the single largest obstacle most international students face: teaching, assessment and day-to-day administration all happen in a language you already work in, and a language test is often waived outright if your previous study was in English.</p>`
      : `<p>${f.languageText} ${f.languages.length > 1 ? 'are the official languages' : 'is the official language'}, and that is the first thing to check against any programme you shortlist. English-taught degrees exist here, but they are a subset of the catalogue rather than the default, and the ones that exist concentrate at master's level.</p>`,
  );
  p.push(
    `<p>On cost, ${f.name} sits in the ${TIER_TEXT[f.tier]} group, which shapes your budget more than any single university does: ${tuitionSentence(f)}; living costs run ${money(f.living[0])} to ${money(f.living[1])} ${f.costCurrency} a month.` +
      (f.students ? ` UNESCO counted ${money(f.students.value)} international students here in ${f.students.year}.` : '') +
      '</p>',
  );
  return p.join('');
}

function admissionProcess(f) {
  const steps = [
    `<li><strong>Shortlist and check entry equivalence.</strong> Ask each institution how it maps your qualification onto its own entry level before you pay an application fee${f.eu ? '; inside the EU the Bologna cycles make this quicker than it looks' : ''}.</li>`,
    f.english
      ? `<li><strong>Language evidence.</strong> English is official here, so a medium-of-instruction certificate usually does the job. Where a test is asked for, ${f.ielts} IELTS is the band most institutions publish.</li>`
      : `<li><strong>Language evidence.</strong> For an English-taught programme, expect to show around ${f.ielts} IELTS or the equivalent. For a programme taught in ${f.languages[0] ?? 'the local language'}, you will be asked for proficiency in that instead, and that requirement is rarely waived.</li>`,
    `<li><strong>Apply.</strong> Applications go to the institution directly unless it tells you otherwise; send certified translations of transcripts with the first submission rather than waiting to be asked.</li>`,
    `<li><strong>Offer and acceptance.</strong> An offer arrives with a fee schedule and a deadline. This is the point to ask about scholarships, waivers and housing, while the institution still wants your answer.</li>`,
    `<li><strong>Funds and visa.</strong> Assemble proof of funds as soon as the offer is in hand${f.cur?.proc ? `, and allow ${f.cur.proc} for the visa itself` : ', because the visa is the step with the least flexible timeline'}.</li>`,
    `<li><strong>Arrival and registration.</strong> Most destinations require you to register your address or residence permit within weeks of landing. Treat it as part of enrolment, not paperwork you can leave.</li>`,
  ];
  return `<p>The sequence below is the one that works for ${f.name}. Dates move, the order does not.</p><ol>${steps.join('')}</ol>`;
}

function costBreakdown(f) {
  const basis = f.indicative
    ? `<p>The figures here are an indicative band for the ${TIER_TEXT[f.tier]} group ${f.name} belongs to, quoted in US dollars. They are a planning range for building a shortlist, not a quote: confirm the actual number with the university before you commit to anything.</p>`
    : `<p>The figures here are quoted in ${f.costCurrency}, the currency ${f.name} publishes its own fees in. They are a planning range rather than a quote.</p>`;
  return (
    basis +
    `<ul>` +
    `<li><strong>Tuition:</strong> ${f.tuition[0] === 0 ? `none at public universities for most students, up to ${money(f.tuition[1])} ${f.costCurrency} a year privately` : `${money(f.tuition[0])} to ${money(f.tuition[1])} ${f.costCurrency} a year`}. The spread is mostly public versus private and undergraduate versus postgraduate, not one university being better than another.</li>` +
    `<li><strong>Living:</strong> ${money(f.living[0])} to ${money(f.living[1])} ${f.costCurrency} a month. Rent moves this figure more than everything else combined, so a university room in a smaller city is the single biggest saving available to you.</li>` +
    `<li><strong>Application fees:</strong> ${f.appFee} ${f.costCurrency} per application, which is worth counting if you are applying to six places.</li>` +
    `<li><strong>Health cover:</strong> budget for it separately. ${f.eu ? 'EU and EEA students can often rely on an EHIC; everyone else buys a policy, and enrolment is usually conditional on holding one.' : 'Most destinations make proof of cover a condition of the visa or of enrolment.'}</li>` +
    `<li><strong>One-off costs:</strong> flights, a deposit on housing, document translation and certification, and the visa fee itself. These land before any stipend or part-time work does.</li>` +
    `</ul>`
  );
}

function visaProcess(f) {
  const route = f.cur?.visa ?? 'a student visa';
  const lead = f.schengen
    ? `<p>${f.name} is in the Schengen area, so study longer than 90 days runs on a national long-stay visa rather than a short Schengen one. You apply at the mission that covers your country, and convert it into a residence permit after arrival.</p>`
    : f.eu
      ? `<p>${f.name} is in the European Union. EU and EEA nationals need no visa and simply register once they arrive; everyone else applies for a national student visa before travelling.</p>`
      : `<p>Study in ${f.name} runs on ${route}, applied for before you travel and granted against a confirmed place.</p>`;
  const steps = [
    `<li>Hold an unconditional offer or a confirmed enrolment. No mission will open a student file without it.</li>`,
    `<li>Assemble the file: passport valid well beyond the course, the offer, proof of funds, health cover and, where asked, a criminal record certificate and a medical.</li>`,
    `<li>Book the appointment early. Slots are the bottleneck in the weeks before the main intake, not the decision itself.</li>`,
    f.cur?.visaFee ? `<li>Pay the fee, currently ${f.cur.visaFee}, and allow ${f.cur.proc ?? 'several weeks'} for a decision.</li>` : `<li>Pay the fee set by the mission that covers your country, and allow several weeks for a decision. Student visa fees are commonly reciprocal, so the amount depends on your nationality.</li>`,
    `<li>After arrival, complete registration: a residence permit, an address registration, or both, usually inside the first few weeks.</li>`,
  ];
  return lead + `<ol>${steps.join('')}</ol><p>Rules change without much notice. Confirm the current requirement with the ${f.name} mission in your country before you book travel or pay anything.</p>`;
}

function faqs(f) {
  const out = [
    {
      question: `What language will I be taught in?`,
      answer: f.english
        ? `English is an official language of ${f.name}, and it is the language of instruction across most of the catalogue. If your earlier study was in English, a medium-of-instruction certificate usually replaces a test.`
        : `${f.languageText} ${f.languages.length > 1 ? 'are official' : 'is official'}. English-taught programmes exist, most of them at master's level, but they are a subset rather than the default — check the language of instruction on each programme page.`,
      category: 'Language',
      isFeatured: true,
      displayOrder: 10,
    },
    {
      question: `How much should I budget for a year?`,
      answer: `${tuitionSentence(f)[0].toUpperCase()}${tuitionSentence(f).slice(1)}; living costs run ${money(f.living[0])} to ${money(f.living[1])} ${f.costCurrency} a month${f.indicative ? ', as an indicative band for countries in the same income group' : ''}. Rent is the variable that moves the total most, so compare cities as well as universities.`,
      category: 'Cost',
      isFeatured: true,
      displayOrder: 20,
    },
    {
      question: `When can I start?`,
      answer: `The intakes listed for ${f.name} are ${(f.cur?.intakes ?? (f.north ? SEP_FEB : 'February intake | July intake')).replace(/ intake/g, '').replace(' | ', ' and ')}. Applications usually open several months ahead, so the intake you are aiming at decides when your documents need to be ready.`,
      category: 'Admissions',
      isFeatured: false,
      displayOrder: 30,
    },
    {
      question: `Do I need a student visa?`,
      answer: f.eu
        ? `EU and EEA nationals do not; they register after arrival. Everyone else applies for a national student visa before travelling, against a confirmed place.`
        : `Yes, for study of any length beyond a short course. It is applied for before you travel and granted against a confirmed offer${f.cur?.proc ? `, and ${f.cur.proc} is the normal wait` : ''}.`,
      category: 'Visa',
      isFeatured: true,
      displayOrder: 40,
    },
  ];
  if (f.students)
    out.push({
      question: `How many international students study in ${f.name}?`,
      answer: `${money(f.students.value)}, on the most recent count published by UNESCO (${f.students.year}). It is a measure of how used the system is to international students — support services, English-taught provision, visa processing — rather than anything about your own chances.`,
      category: 'About',
      isFeatured: false,
      displayOrder: 50,
    });
  return JSON.stringify(out);
}

/* ------------------------------------------------------------------------ */

const COLUMNS = [
  ['uid', 'Your own stable id for the row. Matched before the slug when you re-upload, so a renamed country still updates the same record.', 'Optional', 'Any text', 'AF', 'Filled — the ISO2 code'],
  ['slug', 'The address the country page lives at: /study-abroad/<slug>. Left blank, it is generated from the title.', 'Optional', 'lowercase-with-hyphens', 'afghanistan', 'Filled'],
  ['title', 'The country name. The only column the importer refuses a row without.', 'REQUIRED', 'Text', 'Afghanistan', 'Filled'],
  ['status', 'DRAFT keeps it out of the public site. PUBLISHED puts the guide live.', 'Optional', 'DRAFT / PUBLISHED', 'PUBLISHED', 'Filled'],
  ['excerpt', 'The short line under the page title, and the line on the destination card.', 'Optional', 'Plain text, 1-2 sentences', 'Afghanistan is a study destination in Southern Asia.', 'Filled'],
  ['content', 'The overview section. HTML is kept, so <p> paragraphs render as paragraphs.', 'Optional', 'HTML', '<p>…</p>', 'Filled'],
  ['featured_image', 'Media library id for the card image.', 'Optional', 'Media id', '', 'EMPTY — needs an id from your media library; a sheet cannot invent one'],
  ['iso_code', 'ISO 3166-1 alpha-2. Drives the flag shown on the chip and in the editor.', 'Optional', '2 letters', 'AF', 'Filled'],
  ['iso3_code', 'ISO 3166-1 alpha-3.', 'Optional', '3 letters', 'AFG', 'Filled'],
  ['capital', 'Capital city.', 'Optional', 'Text', 'Kabul', 'Filled'],
  ['currency', 'ISO 4217 code for the country.', 'Optional', '3 letters', 'AFN', 'Filled'],
  ['language', 'Official language(s).', 'Optional', 'Text', 'Pashto and Dari', 'Filled'],
  ['tagline', 'The bold line under the short description.', 'Optional', 'Short text', 'Southern Asia · Kabul · Pashto and Dari', 'Filled'],
  ['tuition_min', 'Lowest published international tuition, per year, in tuition_currency.', 'Optional', 'Number', '4500', 'Filled — real figure for 30 major destinations, otherwise an indicative World Bank income-group band in USD'],
  ['tuition_max', 'Highest published international tuition, per year.', 'Optional', 'Number', '22000', 'Filled — same basis as tuition_min'],
  ['tuition_currency', 'Currency every cost on the row is quoted in: tuition, living and application fee.', 'Optional', '3 letters', 'USD', 'Filled — the local currency for the 30 curated destinations, USD for the indicative bands'],
  ['living_min', 'Lowest monthly living cost.', 'Optional', 'Number', '400', 'Filled — same basis as tuition'],
  ['living_max', 'Highest monthly living cost.', 'Optional', 'Number', '900', 'Filled — same basis as tuition'],
  ['application_fee', 'Typical application fee, in tuition_currency.', 'Optional', 'Number or range ("60-120")', '50-120', 'Filled — same basis as tuition'],
  ['intakes', 'Intake months the country runs. Must already be an ACTIVE intake in the admin.', 'Optional', 'Names separated by |', 'September | February intake', 'Filled — real academic calendar; southern-hemisphere countries get February and July'],
  ['visa_type', 'Name of the student visa or permit.', 'Optional', 'Text', 'Student visa', 'Filled — the real route name for the 30 curated destinations, the generic "Student visa" elsewhere'],
  ['visa_fee', 'Visa fee.', 'Optional', 'Number, may carry a currency', 'USD 110', 'Filled for the 30 curated destinations only — EMPTY elsewhere, because the fee is set per nationality and inventing it would misinform a student'],
  ['visa_processing', 'How long the visa takes.', 'Optional', 'Text', '4-8 weeks', 'Filled for the 30 curated destinations only — EMPTY elsewhere'],
  ['post_study_work', 'Months you may stay to work after finishing.', 'Optional', 'Number', '24', 'Filled for the 30 curated destinations only — EMPTY elsewhere; a wrong number here is a false promise'],
  ['work_hours', 'Hours a week you may work during term.', 'Optional', 'Number', '20', 'Filled for the 30 curated destinations only — EMPTY elsewhere, and deliberately empty where the country allows no work at all'],
  ['ielts_min', 'Minimum IELTS the destination usually asks for.', 'Optional', 'Number', '6.0', 'Filled — 6.5 for the competitive Anglophone destinations, 6.0 as the band English-taught programmes usually publish'],
  ['universities_count', 'How many universities the country has. Left blank, the site counts the ones published on Universta.', 'Optional', 'Number', '40', 'EMPTY on purpose — this is the documented default, and no authority publishes a comparable count for every country'],
  ['intl_students', 'International students in the country.', 'Optional', 'Number', '80000', 'Filled for 146 countries from UNESCO UIS indicator 26637, latest year available — EMPTY where UNESCO publishes nothing'],
  ['why_study', 'The "Why study here" section.', 'Optional', 'HTML', '<p>…</p>', 'Filled — written per country from its region, language, income group and UNESCO figure'],
  ['admission_process', 'The admissions section.', 'Optional', 'HTML', '<ol>…</ol>', 'Filled — six real steps, tailored by language and EU membership'],
  ['cost_breakdown', 'The cost section.', 'Optional', 'HTML', '<ul>…</ul>', 'Filled — states its own basis, so a reader knows an indicative band when they see one'],
  ['visa_process', 'The visa section.', 'Optional', 'HTML', '<ol>…</ol>', 'Filled — Schengen, EU and third-country routes each described correctly'],
  ['flag_image', 'Media id for a flag image. Not needed — the site draws the flag from iso_code.', 'Optional', 'Media id', '', 'EMPTY by design — leave it that way'],
  ['hero_image', 'Media id for the hero image.', 'Optional', 'Media id', '', 'EMPTY — needs an id from your media library'],
  ['featured', 'Whether the country is featured on listings.', 'Optional', 'true / false', 'false', 'Filled'],
  ['rank_order', 'Sort position in listings. Lower shows first.', 'Optional', 'Number', '1', 'Filled — alphabetical'],
  ['faqs', 'Questions and answers for the FAQ section.', 'Optional', 'JSON array', '[{"question":"…","answer":"…"}]', 'Filled — four or five per country, written from that country’s own facts'],
  ['continent', 'Which continent it is filed under. Must match one already in the admin.', 'Optional', 'Exact name', 'Asia', 'Filled'],
  ['subject', 'Subjects offered, as slugs separated by |. Must already exist in the admin.', 'Optional', 'slug | slug', 'computer-science | engineering', 'Filled — all 10 subjects'],
  ['tag', 'Country tags, as slugs separated by |. Must already exist in the admin.', 'Optional', 'slug | slug', '', 'EMPTY — no country tags exist yet, so any value here would fail the import'],
];
const HEADER = COLUMNS.map((c) => c[0]);

const SUBJECTS = ['architecture-and-built-environment', 'business-and-management', 'computer-science', 'data-science-and-analytics', 'design-and-creative-arts', 'engineering', 'health-and-medicine', 'law', 'natural-sciences', 'social-sciences'].join(' | ');

const source = readFileSync(
  new URL('./src/countries/country-table.ts', import.meta.url),
  'utf8',
);
const table = [];
for (const m of source.matchAll(/\{\s*name: '([^']+)',\s*region: '([^']+)',\s*iso2: '([A-Z]{2})',\s*iso3: '([A-Z]{3})',\s*currencyCode: '([^']*)'/g))
  table.push({ name: NAME[m[3]] ?? m[1], iso2: m[3], iso3: m[4], currency: m[5] });
if (table.length < 200) throw new Error(`read only ${table.length} countries`);

const already = new Set(JSON.parse(process.argv[2]).map((n) => n.toLowerCase()));
const ALIAS = { uk: 'united kingdom', usa: 'united states' };
const has = (n) => already.has(n.toLowerCase()) || already.has(ALIAS[n.toLowerCase()] ?? '');
const rowsFor = table.filter((c) => !has(c.name)).sort((a, b) => a.name.localeCompare(b.name));
const STATUS = process.argv[4] ?? 'PUBLISHED';

const book = new ExcelJS.Workbook();
book.creator = 'Universta';

// ---- Tab 1: what each column is for
const guide = book.addWorksheet('Columns');
guide.addRow(['Column', 'What it is', 'Required', 'Format', 'Example', 'Status in this sheet']);
for (const c of COLUMNS) guide.addRow(c);
guide.columns = [{ width: 20 }, { width: 68 }, { width: 11 }, { width: 26 }, { width: 38 }, { width: 62 }];
guide.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
guide.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1657CF' } };
guide.views = [{ state: 'frozen', ySplit: 1 }];
guide.eachRow((row, n) => {
  if (n === 1) return;
  row.alignment = { vertical: 'top', wrapText: true };
  const state = String(row.getCell(6).value ?? '');
  if (state.startsWith('EMPTY')) row.getCell(6).font = { color: { argb: 'FFB42318' }, bold: true };
  else if (state.startsWith('Filled')) row.getCell(6).font = { color: { argb: 'FF027A48' } };
  if (row.getCell(3).value === 'REQUIRED') row.getCell(3).font = { bold: true, color: { argb: 'FFB42318' } };
});

// ---- Tab 2: the data.
/* Named "Data", not "Countries": the importer picks `getWorksheet('Data')` and
   only falls back to the first sheet in the book. With any other name the
   documentation tab in front of it is what would get parsed. */
const data = book.addWorksheet('Data');
data.addRow(HEADER);
rowsFor.forEach((c, i) => {
  const f = facts(c);
  const cells = {
    uid: c.iso2,
    slug: slugify(c.name),
    title: c.name,
    status: STATUS,
    excerpt: [
      `${c.name} is a study destination in ${f.where}.`,
      f.capital && `Its capital is ${f.capital}.`,
      f.languageText && `${f.languageText} ${f.languages.length > 1 ? 'are' : 'is'} official.`,
      f.priced && `Costs are quoted in ${f.priced}.`,
    ].filter(Boolean).join(' '),
    content: whyStudy(f),
    iso_code: c.iso2,
    iso3_code: c.iso3,
    capital: f.capital,
    currency: c.currency,
    language: f.languageText,
    tagline: [f.where, f.capital, f.languageText].filter(Boolean).join(' · '),
    tuition_min: f.tuition[0],
    tuition_max: f.tuition[1],
    tuition_currency: f.costCurrency,
    living_min: f.living[0],
    living_max: f.living[1],
    application_fee: f.appFee,
    intakes: f.cur?.intakes ?? (f.north ? SEP_FEB : 'February intake | July intake'),
    visa_type: f.cur?.visa ?? 'Student visa',
    visa_fee: f.cur?.visaFee ?? null,
    visa_processing: f.cur?.proc ?? null,
    post_study_work: f.cur?.psw ?? null,
    work_hours: f.cur?.work ?? null,
    ielts_min: f.ielts,
    intl_students: f.students?.value ?? null,
    why_study: whyStudy(f),
    admission_process: admissionProcess(f),
    cost_breakdown: costBreakdown(f),
    visa_process: visaProcess(f),
    featured: 'false',
    rank_order: i + 1,
    faqs: faqs(f),
    continent: continentOf(f.e),
    subject: SUBJECTS,
  };
  const values = HEADER.map((h) => cells[h] ?? null);
  values[values.length - 1] = '';
  data.addRow(values);
});
data.columns = HEADER.map((h) => ({ width: Math.max(12, Math.min(34, h.length + 6)) }));
data.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
data.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1657CF' } };
data.views = [{ state: 'frozen', ySplit: 1, xSplit: 3 }];

await book.xlsx.writeFile(process.argv[3]);

const filledIn = (h) => rowsFor.filter((_, i) => {
  const v = data.getRow(i + 2).getCell(HEADER.indexOf(h) + 1).value;
  return v !== null && v !== undefined && String(v).trim() !== '';
}).length;
const everywhere = HEADER.filter((h) => filledIn(h) === rowsFor.length);
const partial = HEADER.filter((h) => filledIn(h) > 0 && filledIn(h) < rowsFor.length);
const empty = HEADER.filter((h) => filledIn(h) === 0);
console.log(`countries        : ${rowsFor.length}`);
console.log(`status           : ${STATUS}`);
console.log(`filled on every row (${everywhere.length}): ${everywhere.join(', ')}`);
console.log(`partly filled (${partial.length}): ${partial.map((h) => `${h} ${filledIn(h)}/${rowsFor.length}`).join(', ')}`);
console.log(`empty (${empty.length}): ${empty.join(', ')}`);
