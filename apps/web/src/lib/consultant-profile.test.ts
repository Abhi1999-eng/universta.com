import { describe, expect, it } from 'vitest';
import { consultantVerification, displayUrl, externalHttpUrl } from './consultant-profile';

describe('a consultant\'s website and source, as links', () => {
  it('links an absolute http or https address', () => {
    expect(externalHttpUrl('https://lindenhall.example/admissions')).toBe(
      'https://lindenhall.example/admissions',
    );
    expect(externalHttpUrl('  http://lindenhall.example ')).toBe('http://lindenhall.example');
    expect(externalHttpUrl('HTTPS://LINDENHALL.EXAMPLE')).toBe('HTTPS://LINDENHALL.EXAMPLE');
  });

  it('leaves a bare domain, a note or another scheme unlinked', () => {
    expect(externalHttpUrl('www.audit-consultant.test')).toBeNull();
    expect(externalHttpUrl('Checked by phone with the office')).toBeNull();
    expect(externalHttpUrl('javascript:alert(1)')).toBeNull();
    expect(externalHttpUrl('mailto:hello@example.test')).toBeNull();
    expect(externalHttpUrl('https://')).toBeNull();
    expect(externalHttpUrl(null)).toBeNull();
  });

  it('reads an address without its scheme', () => {
    expect(displayUrl('https://lindenhall.example')).toBe('lindenhall.example');
    expect(displayUrl('www.audit-consultant.test')).toBe('www.audit-consultant.test');
  });
});

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
