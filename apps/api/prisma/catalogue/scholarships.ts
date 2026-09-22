import { html } from './content';
import { MORE_SCHOLARSHIPS, MORE_SCHOLARSHIP_PROVIDERS } from './scholarships-more';

/**
 * Long-standing, named scholarship programmes run by governments and national
 * agencies.
 *
 * Award values, deadlines and eligibility thresholds move every cycle, so none
 * are stated here: each entry describes what the programme is and who runs it,
 * and points at the official source for the figures. Nothing invented, and no
 * third-party consultancy is represented as a provider.
 */
export type ScholarshipFacts = {
  title: string;
  slug: string;
  provider: string;
  providerSlug: string;
  providerUrl: string | null;
  countries: string[];
  benefitType: string;
  summary: string;
  what: string;
  who: string;
  applying: string;
  applicationUrl: string | null;
  featured?: boolean;
};

const BASE_SCHOLARSHIP_PROVIDERS: Record<string, { name: string; url: string | null }> = {
  'uk-government-chevening': { name: 'Chevening (UK Government)', url: 'https://www.chevening.org' },
  'commonwealth-scholarship-commission': { name: 'Commonwealth Scholarship Commission in the UK', url: 'https://cscuk.fcdo.gov.uk' },
  'daad': { name: 'German Academic Exchange Service (DAAD)', url: 'https://www.daad.de' },
  'government-of-ireland-hea': { name: 'Higher Education Authority, Ireland', url: 'https://hea.ie' },
  'australia-awards': { name: 'Australia Awards (Australian Government)', url: 'https://www.dfat.gov.au' },
  'nuffic': { name: 'Nuffic', url: 'https://www.studyinnl.org' },
  'vanier-canada': { name: 'Government of Canada', url: 'https://vanier.gc.ca' },
  'a-star-singapore': { name: 'Agency for Science, Technology and Research (A*STAR)', url: 'https://www.a-star.edu.sg' },
  'iccr': { name: 'Indian Council for Cultural Relations', url: 'https://www.iccr.gov.in' },
  'erasmus-mundus': { name: 'European Commission', url: null },
};

const BASE_SCHOLARSHIPS: ScholarshipFacts[] = [
  {
    title: 'Chevening Scholarships', slug: 'chevening-scholarships',
    provider: 'Chevening (UK Government)', providerSlug: 'uk-government-chevening',
    providerUrl: 'https://www.chevening.org', countries: ['united-kingdom'],
    benefitType: 'FULL_FUNDING', featured: true,
    applicationUrl: 'https://www.chevening.org',
    summary: 'The UK government’s international scholarship programme, for one-year master’s study by people with demonstrated leadership potential.',
    what: 'Chevening is funded by the UK government and supports international students to take a one-year taught master’s degree at a UK university. It is a long-established programme with a substantial global alumni network, and the award is aimed as much at what a candidate is expected to do afterwards as at academic record alone.',
    who: 'Applicants are generally expected to hold an undergraduate degree, to have a defined period of work experience, and to be citizens of an eligible country. Selection weighs leadership, networking and a clear plan for what the scholarship makes possible on return home.',
    applying: 'Applications open annually through the official Chevening website, with a single global deadline and a structured set of essays. Eligible countries, the work experience required and the award terms are published there each cycle and are the only reliable source for them.',
  },
  {
    title: 'Commonwealth Scholarships', slug: 'commonwealth-scholarships',
    provider: 'Commonwealth Scholarship Commission in the UK', providerSlug: 'commonwealth-scholarship-commission',
    providerUrl: 'https://cscuk.fcdo.gov.uk', countries: ['united-kingdom'],
    benefitType: 'FULL_FUNDING',
    applicationUrl: 'https://cscuk.fcdo.gov.uk',
    summary: 'Scholarships for students from Commonwealth countries to study at master’s and doctoral level in the United Kingdom.',
    what: 'Administered by the Commonwealth Scholarship Commission in the UK, these awards support postgraduate study and research by candidates from eligible Commonwealth countries, with a stated emphasis on development impact.',
    who: 'Eligibility is by citizenship of a participating Commonwealth country and by academic standing, and several award streams exist for different levels and purposes.',
    applying: 'Applications are usually made through a nominating body in the applicant’s own country as well as through the Commission’s own system. Start with the Commission’s website, which lists the nominating agencies and current streams.',
  },
  {
    title: 'DAAD Scholarships', slug: 'daad-scholarships',
    provider: 'German Academic Exchange Service (DAAD)', providerSlug: 'daad',
    providerUrl: 'https://www.daad.de', countries: ['germany'],
    benefitType: 'FULL_FUNDING', featured: true,
    applicationUrl: 'https://www.daad.de',
    summary: 'Germany’s national academic exchange organisation, funding study and research in Germany across a very wide range of programmes.',
    what: 'The DAAD is the largest funder of international academic exchange in Germany and runs many distinct scholarship programmes rather than a single award — development-related postgraduate courses, research grants, and subject-specific schemes among them.',
    who: 'Eligibility varies by programme and typically depends on nationality, field of study, level and sometimes professional experience. The searchable database on the DAAD site is the practical starting point.',
    applying: 'Each programme has its own deadline, documents and selection process. Identify the specific programme first, then work to its published requirements — applying to the DAAD in general is not how the system works.',
  },
  {
    title: 'Government of Ireland International Education Scholarships', slug: 'government-of-ireland-international-education-scholarships',
    provider: 'Higher Education Authority, Ireland', providerSlug: 'government-of-ireland-hea',
    providerUrl: 'https://hea.ie', countries: ['ireland'],
    benefitType: 'PARTIAL_FUNDING',
    applicationUrl: 'https://hea.ie',
    summary: 'Awards funded by the Irish government for international students undertaking a year of study at a participating Irish institution.',
    what: 'The scheme is funded by the Department of Further and Higher Education and administered by the Higher Education Authority, supporting a cohort of international students each year for one year of study in Ireland.',
    who: 'Open to students from outside the European Economic Area who hold an offer from a participating Irish higher education institution. Selection is competitive and considers academic merit alongside wider contribution.',
    applying: 'Applications run on an annual cycle through the administering body, and require an offer of a place before applying. Current terms are published on the official site.',
  },
  {
    title: 'Australia Awards Scholarships', slug: 'australia-awards-scholarships',
    provider: 'Australia Awards (Australian Government)', providerSlug: 'australia-awards',
    providerUrl: 'https://www.dfat.gov.au', countries: ['australia'],
    benefitType: 'FULL_FUNDING',
    applicationUrl: 'https://www.dfat.gov.au',
    summary: 'Long-term development awards funded by the Australian government for study at Australian institutions.',
    what: 'Australia Awards are part of Australia’s development cooperation programme, supporting study and research at Australian universities by candidates from partner countries, with the expectation that graduates return and contribute at home.',
    who: 'Eligibility is defined country by country, and the participating countries, priority fields and requirements differ between them. Applicants apply from their own country against its specific profile.',
    applying: 'Applications open annually and are made through the programme’s official channels for the applicant’s country. The country profile is the authoritative source for fields of study, deadlines and conditions.',
  },
  {
    title: 'Orange Tulip Scholarship', slug: 'orange-tulip-scholarship',
    provider: 'Nuffic', providerSlug: 'nuffic',
    providerUrl: 'https://www.studyinnl.org', countries: ['netherlands'],
    benefitType: 'PARTIAL_FUNDING',
    applicationUrl: 'https://www.studyinnl.org',
    summary: 'A scholarship programme for students from selected countries to study at Dutch higher education institutions.',
    what: 'Coordinated by Nuffic, the Dutch organisation for internationalisation in education, the programme brings together awards offered by participating Dutch institutions for students from a defined set of countries.',
    who: 'Eligibility depends on nationality and on the specific participating institution and programme, each of which sets its own criteria within the scheme.',
    applying: 'Applications are made per country and per institution, on deadlines set by each. The programme’s official pages list which institutions participate for which countries in the current cycle.',
  },
  {
    title: 'Vanier Canada Graduate Scholarships', slug: 'vanier-canada-graduate-scholarships',
    provider: 'Government of Canada', providerSlug: 'vanier-canada',
    providerUrl: 'https://vanier.gc.ca', countries: ['canada'],
    benefitType: 'FULL_FUNDING',
    applicationUrl: 'https://vanier.gc.ca',
    summary: 'Doctoral scholarships funded by the Canadian government for students with strong research potential and leadership.',
    what: 'The Vanier programme supports doctoral students at Canadian universities, assessed on academic excellence, research potential and leadership. It is a competitive national award rather than an institutional one.',
    who: 'Candidates are nominated by a Canadian university rather than applying directly, and must be pursuing a doctoral degree. Both domestic and international students are eligible.',
    applying: 'The process begins with the university that would host you: you must secure institutional nomination, which has its own earlier internal deadline. Start the conversation with a prospective supervisor well ahead of the national deadline.',
  },
  {
    title: 'Singapore International Graduate Award', slug: 'singapore-international-graduate-award',
    provider: 'Agency for Science, Technology and Research (A*STAR)', providerSlug: 'a-star-singapore',
    providerUrl: 'https://www.a-star.edu.sg', countries: ['singapore'],
    benefitType: 'FULL_FUNDING',
    applicationUrl: 'https://www.a-star.edu.sg',
    summary: 'A doctoral award for international students undertaking PhD research in science and engineering in Singapore.',
    what: 'Run by A*STAR in partnership with Singapore’s universities, the award supports international students through a PhD in science and engineering, with research carried out in A*STAR research institutes and the degree conferred by a partner university.',
    who: 'Open to international graduates with a strong academic record in science or engineering and a clear research interest matching the available areas.',
    applying: 'Applications are made through A*STAR on an annual cycle and involve identifying a research area and supervisor. Current fields, terms and deadlines are published on the official site.',
  },
  {
    title: 'ICCR Scholarships', slug: 'iccr-scholarships',
    provider: 'Indian Council for Cultural Relations', providerSlug: 'iccr',
    providerUrl: 'https://www.iccr.gov.in', countries: ['india'],
    benefitType: 'FULL_FUNDING',
    applicationUrl: 'https://www.iccr.gov.in',
    summary: 'Scholarships offered by the Indian government for international students to study at Indian universities.',
    what: 'The Indian Council for Cultural Relations administers several scholarship schemes on behalf of the Government of India, covering undergraduate, postgraduate and doctoral study across a wide range of disciplines at Indian institutions.',
    who: 'Eligibility is defined by nationality, with country-specific quotas and schemes, and by the academic requirements of the level applied for. Some schemes exclude particular fields such as medicine.',
    applying: 'Applications are made through the official portal and usually also involve the Indian diplomatic mission in the applicant’s country. Schemes, eligible countries and deadlines are published there each cycle.',
  },
  {
    title: 'Erasmus Mundus Joint Masters', slug: 'erasmus-mundus-joint-masters',
    provider: 'European Commission', providerSlug: 'erasmus-mundus',
    providerUrl: null, countries: ['germany', 'ireland', 'netherlands'],
    benefitType: 'FULL_FUNDING', featured: true,
    applicationUrl: null,
    summary: 'Integrated master’s programmes delivered jointly by universities in several European countries, with scholarships attached.',
    what: 'An Erasmus Mundus Joint Master is a single degree programme taught across a consortium of universities in different countries, so students study in at least two of them during the course. A defined number of scholarships is attached to each programme.',
    who: 'Applicants apply to an individual programme rather than to the scheme as a whole, and are considered for the attached scholarships as part of that application. Requirements are set by each consortium.',
    applying: 'Find the specific joint programme in your field first, then apply directly to that consortium on its own deadline. Each has its own requirements, structure and selection process.',
  },
];

export function scholarshipDescription(s: ScholarshipFacts): string {
  return html([
    s.what,
    '## Who it is for',
    s.who,
    '## Applying',
    s.applying,
    `Award values, eligibility thresholds and deadlines are set by ${s.provider} and change from cycle to cycle. Take the current figures from the official programme pages rather than from any summary, including this one.`,
  ]);
}

export function scholarshipEligibility(s: ScholarshipFacts): string {
  return html([s.who]);
}

export const SCHOLARSHIP_PROVIDERS: Record<string, { name: string; url: string | null }> = {
  ...BASE_SCHOLARSHIP_PROVIDERS,
  ...MORE_SCHOLARSHIP_PROVIDERS,
};
export const SCHOLARSHIPS: ScholarshipFacts[] = [...BASE_SCHOLARSHIPS, ...MORE_SCHOLARSHIPS];
