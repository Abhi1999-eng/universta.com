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

type Form = {
  name: string; slug: string; displayOrder: string;
  iconMediaId?: string; listingMediaId?: string; heroMediaId?: string;
};

const optional = (value: string) => (value.trim() ? value.trim() : undefined);

function buildPayload(form: Form) {
  return {
    ...form,
    slug: optional(form.slug),
    iconMediaId: optional(form.iconMediaId ?? ''),
    listingMediaId: optional(form.listingMediaId ?? ''),
    heroMediaId: optional(form.heroMediaId ?? ''),
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

  /* The same empty-string problem applies to the three optional media pickers.
   * Creating a subject without choosing any media sent iconMediaId: "" and the
   * API replied "iconMediaId must be a UUID", so a default creation could not
   * succeed at all. */
  it('omits every unset media id, which the API types as an optional UUID', () => {
    const body = sent({
      name: 'Applied Physics', slug: 'applied-physics', displayOrder: '0',
      iconMediaId: '', listingMediaId: '', heroMediaId: '',
    });
    expect('iconMediaId' in body).toBe(false);
    expect('listingMediaId' in body).toBe(false);
    expect('heroMediaId' in body).toBe(false);
  });

  it('keeps a media id that was actually chosen', () => {
    const id = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
    const body = sent({
      name: 'Applied Physics', slug: 'applied-physics', displayOrder: '0',
      iconMediaId: id, listingMediaId: '', heroMediaId: '',
    });
    expect(body.iconMediaId).toBe(id);
    expect('listingMediaId' in body).toBe(false);
  });
});
