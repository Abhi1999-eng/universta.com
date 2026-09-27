/**
 * The countries production does not carry yet, as a bulk-upload workbook.
 *
 * Columns are the importer's own contract, taken from the template rather
 * than written out again here, so a column this sheet fills is a column the
 * importer reads. Everything in it comes from the generated country table --
 * ISO 3166 codes and ISO 4217 currencies -- so nothing has been typed by
 * hand and nothing can disagree with what the site already holds.
 */
import ExcelJS from 'exceljs';
import { readFileSync, writeFileSync } from 'node:fs';

const HEADER = ['uid','slug','title','status','excerpt','content','featured_image','iso_code','iso3_code','capital','currency','language','tagline','tuition_min','tuition_max','tuition_currency','living_min','living_max','application_fee','intakes','visa_type','visa_fee','visa_processing','post_study_work','work_hours','ielts_min','universities_count','intl_students','why_study','admission_process','cost_breakdown','visa_process','flag_image','hero_image','featured','rank_order','faqs','continent','subject','tag'];

/* The directory's regions and the catalogue's continents are two
   vocabularies; production carries the seven on the right. */
const CONTINENT = {
  Africa: 'Africa',
  Asia: 'Asia',
  Europe: 'Europe',
  'Latin America': 'South America',
  'Middle East': 'Middle East',
  'North America': 'North America',
  Oceania: 'Australia & New Zealand',
};

const source = readFileSync(
  '/Users/abhishekchaubey/Developer/universta.com/apps/api/src/countries/country-table.ts',
  'utf8',
);
const table = [];
const row = /\{\s*name: '([^']+)',\s*region: '([^']+)',\s*iso2: '([A-Z]{2})',\s*iso3: '([A-Z]{3})',\s*currencyCode: '([^']*)',\s*currencyName: '([^']*)',\s*currencySymbol: '([^']*)'/g;
for (const m of source.matchAll(row))
  table.push({ name: m[1], region: m[2], iso2: m[3], iso3: m[4], currency: m[5] });
if (table.length < 200) throw new Error(`read only ${table.length} countries`);

const already = new Set(JSON.parse(process.argv[2]).map((n) => n.toLowerCase()));
/* The table spells two of them shorter than the catalogue does. */
const ALIAS = { uk: 'united kingdom', usa: 'united states', 'south korea': 'south korea' };
const has = (name) => {
  const n = name.toLowerCase();
  return already.has(n) || already.has(ALIAS[n] ?? '');
};

const missing = table
  .filter((c) => !has(c.name))
  .sort((a, b) => a.name.localeCompare(b.name));

const book = new ExcelJS.Workbook();
const sheet = book.addWorksheet('countries');
sheet.addRow(HEADER);
sheet.getRow(1).font = { bold: true };
for (const c of missing) {
  const cells = Object.fromEntries(HEADER.map((h) => [h, '']));
  cells.title = c.name;
  cells.iso_code = c.iso2;
  cells.iso3_code = c.iso3;
  cells.currency = c.currency;
  cells.continent = CONTINENT[c.region] ?? '';
  sheet.addRow(HEADER.map((h) => cells[h]));
}
sheet.columns = HEADER.map((h) => ({ width: Math.max(10, h.length + 2) }));

const out = process.argv[3];
await book.xlsx.writeFile(out);
console.log(`already in production : ${already.size}`);
console.log(`in the country table  : ${table.length}`);
console.log(`written to the sheet  : ${missing.length}`);
console.log(`file                  : ${out}`);
console.log(`\nfirst five: ${missing.slice(0, 5).map((c) => `${c.name} (${c.iso2}/${c.currency}/${CONTINENT[c.region]})`).join(', ')}`);
const noContinent = missing.filter((c) => !CONTINENT[c.region]);
if (noContinent.length) console.log(`\nNO CONTINENT: ${noContinent.map((c) => c.name).join(', ')}`);
