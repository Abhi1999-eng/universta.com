import { describe, expect, it } from 'vitest';
import { jobPostingJsonLd } from './job-json-ld';

const role = (extra: Record<string, unknown> = {}) => ({
  id: 'j1',
  slug: 'admissions-analyst',
  title: 'Admissions analyst',
  department: 'Admissions',
  location: 'Kyoto',
  summary: 'Read applications.',
  description: '<p>{jobTitle} in {jobDepartment}, based in {jobLocation}.</p>',
  employmentType: 'Part time',
  remoteStatus: 'HYBRID',
  publishedDate: '2026-10-01T00:00:00.000Z',
  expiryDate: '2026-12-31T00:00:00.000Z',
  ...extra,
});

describe('jobPostingJsonLd', () => {
  it('fills in the description variables (JOB-C3)', () => {
    expect(jobPostingJsonLd(role()).description).toBe('<p>Admissions analyst in Admissions, based in Kyoto.</p>');
    expect(jobPostingJsonLd(role({ description: '<p><br></p>' })).description).toBe('Read applications.');
  });

  it("writes the seeded roles' types as schema.org's values, and leaves out an unknown one (JOB-C5-web, JOB-M1)", () => {
    expect(jobPostingJsonLd(role({ employmentType: 'Part time' })).employmentType).toBe('PART_TIME');
    expect(jobPostingJsonLd(role({ employmentType: 'Full time' })).employmentType).toBe('FULL_TIME');
    expect(jobPostingJsonLd(role({ employmentType: 'Contract' })).employmentType).toBe('CONTRACTOR');
    expect(jobPostingJsonLd(role({ employmentType: 'Internship' })).employmentType).toBe('INTERN');
    expect(jobPostingJsonLd(role({ employmentType: 'FULL_TIME' })).employmentType).toBe('FULL_TIME');
    expect(jobPostingJsonLd(role({ employmentType: 'Volunteer' }))).not.toHaveProperty('employmentType');
  });

  it('places the role at a PostalAddress (JOB-M2)', () => {
    const json = jobPostingJsonLd(
      role({ city: { name: 'Kyoto' }, state: { name: 'Kyoto Prefecture' }, country: { name: 'Japan', slug: 'japan', iso2Code: 'jp' } }),
    );
    expect(json.jobLocation).toEqual({
      '@type': 'Place',
      address: { '@type': 'PostalAddress', addressLocality: 'Kyoto', addressRegion: 'Kyoto Prefecture', addressCountry: 'JP' },
    });
    expect(jobPostingJsonLd(role()).jobLocation).toEqual({ '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: 'Kyoto' } });
  });

  it('marks a remote role TELECOMMUTE in any case, with the country it can be worked from (JOB-M2)', () => {
    const json = jobPostingJsonLd(role({ remoteStatus: 'Remote', country: { name: 'Japan', iso2Code: 'JP' } }));
    expect(json.jobLocationType).toBe('TELECOMMUTE');
    expect(json.applicantLocationRequirements).toEqual({ '@type': 'Country', name: 'Japan' });
    expect(jobPostingJsonLd(role({ remoteStatus: 'REMOTE' })).jobLocationType).toBe('TELECOMMUTE');
    expect(jobPostingJsonLd(role({ remoteStatus: 'REMOTE' }))).not.toHaveProperty('applicantLocationRequirements');
    expect(jobPostingJsonLd(role())).not.toHaveProperty('jobLocationType');
  });
});
