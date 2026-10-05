import { describe, expect, it } from 'vitest';
import {
  countryUniversitiesHref,
  offeringHref,
  universityCoursesHref,
  universityHref,
} from './university-links';

describe('where a university’s pages are', () => {
  it('keeps the profile flat and files everything under it beneath its country', () => {
    expect(universityHref('university-of-oxford')).toBe('/universities/university-of-oxford');
    expect(countryUniversitiesHref('uk')).toBe('/study-abroad/uk/universities');
    expect(universityCoursesHref('uk', 'university-of-oxford')).toBe(
      '/study-abroad/uk/universities/university-of-oxford/courses',
    );
    expect(offeringHref('uk', 'university-of-oxford', 'msc-computer-science')).toBe(
      '/study-abroad/uk/universities/university-of-oxford/courses/msc-computer-science',
    );
  });
});
