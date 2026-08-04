import { describe, expect, it, vi } from 'vitest';
import { fieldsForError, firstFieldError, mergeBackendError, scrollToAndFocusField } from './field-errors';

describe('fieldsForError', () => {
  it('maps a known typed code to its field(s)', () => {
    expect(fieldsForError({ code: 'COURSE_MAPPING_SOURCE_REQUIRED', message: 'x' })).toEqual([
      'sourceReference',
      'verifiedAt',
    ]);
  });

  it('falls back to a message-fragment hint when the code is unknown', () => {
    expect(fieldsForError({ code: 'UNKNOWN_CODE', message: 'A university is required' })).toEqual([
      'universityId',
    ]);
  });

  it('returns no fields for a genuine global error', () => {
    expect(fieldsForError({ code: 'INTERNAL_ERROR', message: 'Internal server error' })).toEqual([]);
  });

  it('returns no fields for a null/undefined error', () => {
    expect(fieldsForError(null)).toEqual([]);
    expect(fieldsForError(undefined)).toEqual([]);
  });
});

describe('mergeBackendError', () => {
  it('attaches the message to every mapped field and reports the first one', () => {
    const { next, firstField } = mergeBackendError({}, { code: 'COURSE_MAPPING_SOURCE_REQUIRED', message: 'Needs a source' });
    expect(next).toEqual({ sourceReference: 'Needs a source', verifiedAt: 'Needs a source' });
    expect(firstField).toBe('sourceReference');
  });

  it('preserves existing field errors when the new error is unmapped', () => {
    const current = { slug: 'Slug already exists' };
    const { next, firstField } = mergeBackendError(current, { code: 'INTERNAL_ERROR', message: 'boom' });
    expect(next).toBe(current);
    expect(firstField).toBeNull();
  });
});

describe('firstFieldError', () => {
  it('returns the first key or null', () => {
    expect(firstFieldError({})).toBeNull();
    expect(firstFieldError({ slug: 'bad', name: 'bad' })).toBe('slug');
  });
});

describe('scrollToAndFocusField', () => {
  it('scrolls to and focuses the matching data-field element', () => {
    document.body.innerHTML = '<input data-field="sourceReference" />';
    const input = document.querySelector('input') as HTMLInputElement;
    input.scrollIntoView = vi.fn();
    input.focus = vi.fn();
    expect(scrollToAndFocusField('sourceReference')).toBe(true);
    expect(input.scrollIntoView).toHaveBeenCalled();
    expect(input.focus).toHaveBeenCalled();
  });

  it('returns false when no matching element exists', () => {
    document.body.innerHTML = '';
    expect(scrollToAndFocusField('missingField')).toBe(false);
  });
});
