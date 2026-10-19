import { describe, expect, it } from 'vitest';
import { consultantVerification } from './consultant-profile';

describe('a consultant\'s verification, as its pages may state it', () => {
  it('dates a verified record', () => {
    expect(consultantVerification('VERIFIED', '2026-10-01T00:00:00.000Z')).toEqual({
      verified: true,
      verifiedAt: '2026-10-01T00:00:00.000Z',
    });
  });

  it('keeps a verified record without a date verified, and undated', () => {
    expect(consultantVerification('VERIFIED', null)).toEqual({ verified: true, verifiedAt: null });
    expect(consultantVerification('VERIFIED', 'not a date')).toEqual({ verified: true, verifiedAt: null });
  });

  it('never dates a pending or unverified record, whatever date it holds', () => {
    expect(consultantVerification('PENDING', '2026-10-01T00:00:00.000Z')).toEqual({
      verified: false,
      verifiedAt: null,
    });
    expect(consultantVerification('UNVERIFIED', '2026-10-01T00:00:00.000Z').verifiedAt).toBeNull();
    expect(consultantVerification(undefined, undefined)).toEqual({ verified: false, verifiedAt: null });
  });
});
