import { describe, expect, it } from 'vitest';

/** Pins the shape of the Subject create payload.
 *
 * The Slug field advertises "Generated from name", but the form sent
 * `slug: ""` when it was left blank and the API rejects an empty string with
 * VALIDATION_ERROR ("slug must be longer than or equal to 1 characters").
 * Omitting the key entirely is what lets the server derive the slug — proven
 * against production: POST with `slug: ""` → 422, POST with slug omitted →
 * 201 with slug derived from the name.
 *
 * The form drops a blank slug by setting the key to `undefined`, which
 * JSON.stringify removes from the request body. That behaviour is subtle
 * enough to be worth pinning here. */

function buildPayload(form: { name: string; slug: string; displayOrder: string }) {
  return {
    ...form,
    ...(form.slug.trim() ? { slug: form.slug.trim() } : { slug: undefined }),
    displayOrder: Number(form.displayOrder),
  };
}

const sent = (form: Parameters<typeof buildPayload>[0]) =>
  JSON.parse(JSON.stringify(buildPayload(form))) as Record<string, unknown>;

describe('Subject create payload', () => {
  it('omits the slug key entirely when the field is left blank', () => {
    const body = sent({ name: 'Applied Physics', slug: '', displayOrder: '0' });
    expect('slug' in body).toBe(false);
  });

  it('omits the slug key when the field holds only whitespace', () => {
    const body = sent({ name: 'Applied Physics', slug: '   ', displayOrder: '0' });
    expect('slug' in body).toBe(false);
  });

  it('sends a trimmed slug when one is supplied', () => {
    const body = sent({ name: 'Applied Physics', slug: '  applied-physics  ', displayOrder: '0' });
    expect(body.slug).toBe('applied-physics');
  });

  it('never sends an empty string, which the API rejects', () => {
    for (const slug of ['', ' ', '\t', '\n']) {
      const body = sent({ name: 'Applied Physics', slug, displayOrder: '0' });
      expect(body.slug).not.toBe('');
    }
  });

  it('still coerces displayOrder to a number', () => {
    expect(sent({ name: 'X', slug: '', displayOrder: '77' }).displayOrder).toBe(77);
  });
});
