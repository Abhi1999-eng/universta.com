import { html } from './content';
import type { CourseFacts } from './academics';
import type { UniversityFacts } from './universities';
import { MORE_OFFERINGS } from './offerings-more';

/**
 * Which generic courses each institution actually offers.
 *
 * Chosen to match what each university is genuinely known for, so an offering
 * is a real relationship rather than a row created to raise a count. Tuition is
 * deliberately left unset at this level: a fee for one named programme at one
 * named university is the most fragile claim on the site, and the indicative
 * range on the destination's cost profile carries the honest version instead.
 */
const BASE_OFFERINGS: Record<string, string[]> = {
  // United Kingdom
  'university-of-oxford': ['msc-computer-science', 'ba-economics'],
  'university-of-cambridge': ['bsc-mathematics', 'msc-machine-learning'],
  'imperial-college-london': ['msc-artificial-intelligence', 'beng-mechanical-engineering'],
  'university-college-london': ['msc-data-science', 'march-architecture'],
  'university-of-manchester': ['bsc-computer-science', 'beng-chemical-engineering'],
  'university-of-edinburgh': ['msc-artificial-intelligence', 'bsc-computer-science'],
  // Canada
  'university-of-toronto': ['msc-machine-learning', 'bsc-computer-science'],
  'university-of-british-columbia': ['msc-environmental-science', 'bsc-computer-science'],
  'mcgill-university': ['msc-biomedical-science', 'llm-international-law'],
  'university-of-waterloo': ['bsc-computer-science', 'bsc-mathematics'],
  'university-of-alberta': ['msc-machine-learning', 'beng-chemical-engineering'],
  // Australia
  'university-of-melbourne': ['master-of-public-health', 'llb-bachelor-of-laws'],
  'university-of-sydney': ['beng-civil-engineering', 'llb-bachelor-of-laws'],
  'australian-national-university': ['ma-international-relations', 'bsc-physics'],
  'university-of-queensland': ['msc-biotechnology', 'msc-environmental-science'],
  'monash-university': ['mpharm-pharmacy', 'beng-mechanical-engineering'],
  // Germany
  'technical-university-of-munich': ['msc-mechanical-engineering', 'msc-robotics-and-autonomous-systems'],
  'ludwig-maximilian-university-of-munich': ['msc-physics', 'msc-economics'],
  'heidelberg-university': ['msc-biomedical-science', 'msc-physics'],
  'rwth-aachen-university': ['msc-mechanical-engineering', 'msc-electrical-engineering'],
  'humboldt-university-of-berlin': ['ma-sociology', 'bsc-mathematics'],
  // Ireland
  'trinity-college-dublin': ['msc-computer-science', 'msc-biomedical-science'],
  'university-college-dublin': ['msc-data-science', 'beng-civil-engineering'],
  'university-of-galway': ['msc-biomedical-science', 'msc-environmental-science'],
  'university-college-cork': ['msc-biotechnology', 'mpharm-pharmacy'],
  // Netherlands
  'delft-university-of-technology': ['beng-civil-engineering', 'msc-aerospace-engineering'],
  'university-of-amsterdam': ['msc-artificial-intelligence', 'msc-economics'],
  'utrecht-university': ['msc-environmental-science', 'msc-biotechnology'],
  'eindhoven-university-of-technology': ['msc-electrical-engineering', 'ma-user-experience-design'],
  'university-of-groningen': ['msc-environmental-science', 'ba-economics'],
  'erasmus-university-rotterdam': ['msc-finance', 'master-of-public-health'],
  // Singapore
  'national-university-of-singapore': ['msc-computer-science', 'msc-urban-planning'],
  'nanyang-technological-university': ['msc-electrical-engineering', 'msc-data-science'],
  'singapore-management-university': ['msc-finance', 'bba-business-administration'],
  // India
  'indian-institute-of-technology-bombay': ['btech-engineering', 'msc-computer-science'],
  'indian-institute-of-technology-delhi': ['btech-engineering', 'msc-electrical-engineering'],
  'indian-institute-of-technology-madras': ['btech-engineering', 'msc-mechanical-engineering'],
  'indian-institute-of-science': ['msc-physics', 'phd-computer-science'],
  'university-of-delhi': ['ba-economics', 'bsc-chemistry'],
  'jawaharlal-nehru-university': ['ma-international-relations', 'ma-sociology'],
  'manipal-academy-of-higher-education': ['bsc-nursing', 'mpharm-pharmacy'],
};

export function offeringOverview(u: UniversityFacts, c: CourseFacts): string {
  return html([
    `${c.name} at ${u.name}, taught in ${u.city}.`,
    c.covers,
    '## Why here',
    `${u.character} Its recognised strengths include ${u.strengths.slice(0, 3).join(', ')}, which is the context this programme is taught in.`,
    '## How it runs',
    c.work,
    '## Careers',
    c.careers,
    `Entry requirements, fees, module choices and intake dates for this programme are set by ${u.name} and are revised from time to time. Confirm the current details with the university before applying.`,
  ]);
}

export function offeringShortDescription(u: UniversityFacts, c: CourseFacts): string {
  return `<p>${c.qualification} in ${c.name.replace(/^(BSc|MSc|BA|MA|BEng|BTech|BDes|LLB|LLM|MArch|BArch|MPharm|PhD)\s+/, '')} at ${u.name}, ${u.city}.</p>`;
}

export const OFFERINGS: Record<string, string[]> = { ...BASE_OFFERINGS, ...MORE_OFFERINGS };
