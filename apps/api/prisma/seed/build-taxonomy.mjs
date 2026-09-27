import ExcelJS from 'exceljs';
import { writeFileSync } from 'node:fs';

const txt = (v) =>
  v === null || v === undefined
    ? ''
    : String(typeof v === 'object' ? (v.text ?? v.result ?? '') : v).replace(/\s+/g, ' ').trim();

const slugify = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const book = new ExcelJS.Workbook();
await book.xlsx.readFile(process.argv[2]);
const sheet = book.getWorksheet('Sheet2');

let current = null;
const subjects = new Map();           // subject name -> Set of spec names
for (let r = 1; r <= sheet.rowCount; r++) {
  const row = sheet.getRow(r);
  const head = txt(row.getCell(1).value);
  const spec = txt(row.getCell(2).value);
  if (head) { current = head; if (!subjects.has(current)) subjects.set(current, new Map()); }
  if (spec && current) {
    const key = spec.toLowerCase();
    if (!subjects.get(current).has(key)) subjects.get(current).set(key, spec);
  }
}

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
const lines = [];
lines.push('-- Subjects and specializations, generated from Subjects.xlsx.');
lines.push('-- Run AFTER the schema migration that scopes a specialization slug');
lines.push('-- to its subject and creates country_sub_subjects.');
lines.push('');
lines.push('START TRANSACTION;');
lines.push('');

let subjectOrder = 0;
let specTotal = 0;
const subjectValues = [];
const specBlocks = [];

for (const [name, specs] of subjects) {
  subjectOrder += 1;
  const slug = slugify(name);
  subjectValues.push(
    `(UUID(), ${q(name)}, ${q(slug)}, 'PUBLISHED', ${subjectOrder}, NOW(3), NOW(3), NOW(3))`,
  );
  let specOrder = 0;
  const rows = [];
  for (const spec of specs.values()) {
    specOrder += 1;
    specTotal += 1;
    rows.push(
      `(UUID(), (SELECT id FROM subjects WHERE slug = ${q(slug)}), ${q(spec)}, ${q(slugify(spec))}, 'PUBLISHED', ${specOrder}, NOW(3), NOW(3), NOW(3))`,
    );
  }
  specBlocks.push({ slug, rows });
}

lines.push('-- 1. The 30 subjects. Re-running updates the name and order rather');
lines.push('--    than failing, so this file is safe to apply twice.');
lines.push('INSERT INTO subjects (id, name, slug, status, display_order, published_at, created_at, updated_at) VALUES');
lines.push(subjectValues.join(',\n'));
lines.push('ON DUPLICATE KEY UPDATE name = VALUES(name), status = VALUES(status), display_order = VALUES(display_order), updated_at = NOW(3);');
lines.push('');

lines.push('-- 2. Subjects that are no longer part of the taxonomy.');
lines.push(`DELETE FROM subjects WHERE slug NOT IN (${[...subjects.keys()].map((n) => q(slugify(n))).join(', ')});`);
lines.push('');

lines.push(`-- 3. The ${specTotal} specializations, each under its own subject.`);
for (const { slug, rows } of specBlocks) {
  lines.push(`-- ${slug}`);
  lines.push('INSERT INTO sub_subjects (id, subject_id, name, slug, status, display_order, published_at, created_at, updated_at) VALUES');
  lines.push(rows.join(',\n'));
  lines.push('ON DUPLICATE KEY UPDATE slug = VALUES(slug), status = VALUES(status), display_order = VALUES(display_order), updated_at = NOW(3);');
  lines.push('');
}

lines.push('-- 4. Link every subject and every specialization to every country.');
lines.push('--    This is the agreed default; the admin is what narrows it later.');
lines.push('INSERT IGNORE INTO country_subjects (id, country_id, subject_id, display_order, created_at)');
lines.push('SELECT UUID(), c.id, s.id, s.display_order, NOW(3) FROM countries c CROSS JOIN subjects s WHERE c.deleted_at IS NULL;');
lines.push('');
lines.push('INSERT IGNORE INTO country_sub_subjects (id, country_id, sub_subject_id, display_order, created_at)');
lines.push('SELECT UUID(), c.id, ss.id, ss.display_order, NOW(3) FROM countries c CROSS JOIN sub_subjects ss WHERE c.deleted_at IS NULL;');
lines.push('');
lines.push('-- 5. Check before committing.');
lines.push("SELECT 'subjects' AS what, COUNT(*) AS n FROM subjects");
lines.push("UNION ALL SELECT 'specializations', COUNT(*) FROM sub_subjects");
lines.push("UNION ALL SELECT 'country_subjects', COUNT(*) FROM country_subjects");
lines.push("UNION ALL SELECT 'country_sub_subjects', COUNT(*) FROM country_sub_subjects;");
lines.push('');
lines.push('-- COMMIT;   -- run this once the counts look right');
lines.push('-- ROLLBACK; -- or this if they do not');

writeFileSync(process.argv[3], lines.join('\n'));
console.log(`subjects        : ${subjects.size}`);
console.log(`specializations : ${specTotal}`);
console.log(`written         : ${process.argv[3]}`);
