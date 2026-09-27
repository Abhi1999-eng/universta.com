import { changedColumns } from './row-diff';
import type { BulkField } from './bulk-resources';

const field = (label: string, type: BulkField['type'] = 'text'): BulkField => ({
  key: label,
  label,
  required: false,
  type,
});

const FIELDS: BulkField[] = [
  field('title'),
  field('ielts_min', 'number'),
  field('featured', 'boolean'),
  field('why_study'),
  field('faqs'),
  field('continent', 'relation'),
  field('subject', 'relation'),
  field('intakes', 'relation'),
];

describe('changedColumns', () => {
  it('reports nothing when the sheet repeats what is stored', () => {
    const row = { title: 'India', ielts_min: '6' };
    const stored = { title: 'India', ielts_min: '6' };
    expect(changedColumns(FIELDS, row, stored)).toEqual([]);
  });

  it('names only the columns that actually moved', () => {
    const row = { title: 'India', ielts_min: '6.5' };
    const stored = { title: 'India', ielts_min: '6' };
    expect(changedColumns(FIELDS, row, stored)).toEqual(['ielts_min']);
  });

  it('treats a decimal and its integer as one number', () => {
    // Prisma hands decimals back as "6.00"; a sheet carries "6".
    const row = { ielts_min: '6' };
    expect(changedColumns(FIELDS, row, { ielts_min: '6.00' })).toEqual([]);
  });

  it('ignores columns the sheet does not carry', () => {
    // Saying nothing about a column is not asking for it to be cleared.
    const row = { title: 'India' };
    const stored = { title: 'India', ielts_min: '6', why_study: '<p>x</p>' };
    expect(changedColumns(FIELDS, row, stored)).toEqual([]);
  });

  it('reads a blank cell as silence, the way every parser here does', () => {
    // Only __CLEAR__ removes a value, so a blank column is not an edit --
    // otherwise a sheet that leaves visa_fee empty would rewrite every row.
    const row = { why_study: '' };
    expect(changedColumns(FIELDS, row, { why_study: '<p>x</p>' })).toEqual([]);
  });

  it('reports a column the sheet explicitly clears', () => {
    const row = { why_study: '__CLEAR__' };
    expect(changedColumns(FIELDS, row, { why_study: '<p>x</p>' })).toEqual([
      'why_study',
    ]);
  });

  it('does not report a clear against something already empty', () => {
    expect(changedColumns(FIELDS, { why_study: '__CLEAR__' }, {})).toEqual([]);
  });

  it('compares booleans by value, not by spelling', () => {
    expect(
      changedColumns(FIELDS, { featured: 'TRUE' }, { featured: 'true' }),
    ).toEqual([]);
    expect(
      changedColumns(FIELDS, { featured: 'false' }, { featured: 'true' }),
    ).toEqual(['featured']);
  });

  it('matches a relation named by slug against one named for display', () => {
    // The sheet writes "North America"; the export writes "north-america".
    const row = { continent: 'North America' };
    expect(changedColumns(FIELDS, row, { continent: 'north-america' })).toEqual(
      [],
    );
  });

  it('does not care what order a relation list arrives in', () => {
    const row = { subject: 'law | engineering' };
    expect(
      changedColumns(FIELDS, row, { subject: 'engineering | law' }),
    ).toEqual([]);
  });

  it('notices a relation that was actually added', () => {
    const row = { subject: 'law | engineering' };
    expect(changedColumns(FIELDS, row, { subject: 'engineering' })).toEqual([
      'subject',
    ]);
  });

  it('compares JSON by structure rather than by formatting', () => {
    const row = {
      faqs: '[{"answer":"Yes.","question":"Can I work?","category":null}]',
    };
    const stored = {
      faqs: '[{"question":"Can I work?","answer":"Yes."}]',
    };
    expect(changedColumns(FIELDS, row, stored)).toEqual([]);
  });

  it('notices a changed answer inside the JSON', () => {
    const row = { faqs: '[{"question":"Can I work?","answer":"No."}]' };
    const stored = { faqs: '[{"question":"Can I work?","answer":"Yes."}]' };
    expect(changedColumns(FIELDS, row, stored)).toEqual(['faqs']);
  });

  it('ignores whitespace that only exists in the file', () => {
    const row = { why_study: '<p>One</p>  <p>Two</p>' };
    const stored = { why_study: '<p>One</p> <p>Two</p>' };
    expect(changedColumns(FIELDS, row, stored)).toEqual([]);
  });

  it('treats an absent stored value and an empty cell as the same', () => {
    expect(changedColumns(FIELDS, { why_study: '' }, {})).toEqual([]);
    expect(
      changedColumns(FIELDS, { why_study: '' }, { why_study: null }),
    ).toEqual([]);
  });

  it('leaves media alone when the sheet carries no id for it', () => {
    // Export writes a public URL where the sheet expects an id; a blank cell
    // must not read as "remove the image".
    const fields = [field('hero_image')];
    const row = { hero_image: '' };
    expect(
      changedColumns(fields, row, { hero_image: 'https://cdn/x.jpg' }),
    ).toEqual([]);
  });

  it('compares intakes by name regardless of spacing around the pipe', () => {
    const row = { intakes: 'September|February intake' };
    const stored = { intakes: 'September | February intake' };
    expect(changedColumns(FIELDS, row, stored)).toEqual([]);
  });
});
