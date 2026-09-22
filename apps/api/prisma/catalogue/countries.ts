import type { CountryFacts } from './content';
import { MORE_COUNTRIES } from './countries-more';

/**
 * The eight destinations, each described from what is actually true of it.
 *
 * Numbers that move -- rankings, visa fees, processing times, the current
 * work-hour cap in countries that have revised it recently -- are deliberately
 * absent or null. Ranges that are published as ranges are given as ranges and
 * labelled indicative, because a student planning a budget needs an order of
 * magnitude and is poorly served by a blank.
 */
const BASE_COUNTRIES: CountryFacts[] = [
  {
    // Authored by hand in the Admin. The seed adds cities, universities,
    // subjects, intakes and any genuinely missing FAQ, and leaves every word of
    // the existing prose, features, documents and sections exactly as written.
    preserveAuthored: true,
    name: 'India',
    slug: 'india',
    iso2: 'IN',
    iso3: 'IND',
    continentSlug: 'asia',
    capital: 'New Delhi',
    language: 'Hindi and English',
    currencyName: 'Indian Rupee',
    currencyCode: 'INR',
    currencySymbol: '\u20b9',
    nationality: 'Indian',
    tagline: 'World-class teaching in English, at a cost that leaves your plans intact',
    heading: 'Study in India',
    positioning:
      'India teaches at degree level in English across most of its universities, at a fraction of what the same qualification costs in the English-speaking world.',
    teaching:
      'English is the medium of instruction for most degree programmes, and is widely spoken in academic and professional life.',
    system:
      'Central, state, deemed and private universities sit alongside institutes of national importance such as the IITs and IISc, each with its own admission route.',
    strengths: [
      'engineering and technology',
      'computer science',
      'management',
      'pharmacy and the life sciences',
      'the humanities',
    ],
    costShape:
      'Tuition spans a very wide range, from modest fees at public institutions to substantially more at private and deemed universities, and living costs vary greatly between the largest cities and everywhere else.',
    partTime:
      'What a student may do alongside their course is set by the institution and by visa conditions.',
    postStudy:
      'Options after graduation depend on the route taken and are worth confirming directly.',
    cityLine:
      'Delhi, Mumbai, Bengaluru, Chennai, Hyderabad, Pune, Kolkata and Ahmedabad each host large student populations with very different costs and character.',
    intakeMonths: [1, 7, 8, 9],
    features: [],
    tests: ['IELTS', 'TOEFL', 'PTE', 'DUOLINGO'],
    tuitionMin: '60000',
    tuitionMax: '1200000',
    livingMin: '15000',
    livingMax: '35000',
    partTimeAllowed: true,
    partTimeHours: null,
    postStudyAvailable: true,
    postStudyMinMonths: null,
    postStudyMaxMonths: null,
    pathwayStrength: null,
    visaType: 'Student visa',
    ieltsRequirement: 'OPTIONAL',
    waiverAvailable: true,
    closing: '',
  },
  {
    name: 'United Kingdom',
    slug: 'united-kingdom',
    iso2: 'GB',
    iso3: 'GBR',
    continentSlug: 'europe',
    capital: 'London',
    language: 'English',
    currencyName: 'Pound Sterling',
    currencyCode: 'GBP',
    currencySymbol: '£',
    nationality: 'British',
    tagline: 'Short, intensive degrees at institutions that have been teaching for centuries',
    heading: 'Study in the United Kingdom',
    positioning:
      'The United Kingdom offers the shortest route to a recognised degree of any major English-speaking destination: most taught master’s programmes run for twelve months and most undergraduate degrees for three years. That compression is the single fact that shapes everything else about studying here — one less year of tuition and one less year of living costs against a term that moves faster and expects more independent reading than many students are used to.',
    teaching:
      'Teaching is in English throughout, and there is no parallel system of local-language degrees to navigate.',
    system:
      'Universities set their own entry requirements, write their own curricula and award their own degrees, with quality assured nationally rather than centrally administered. Undergraduate applications for most institutions run through a single national service with one deadline for everyone; postgraduate applications go directly to the university and open and close on the department’s own schedule. The practical consequence is that undergraduate timing is fixed and postgraduate timing is not, so postgraduate applicants benefit from applying early and lose very little by doing so.',
    strengths: [
      'law and politics',
      'economics and finance',
      'engineering',
      'medicine and the life sciences',
      'the creative arts',
    ],
    costShape:
      'The United Kingdom sits at the expensive end for tuition but compresses the total because the degree is shorter, and the honest comparison is total cost to graduation rather than cost per year. London is materially more expensive to live in than anywhere else in the country — enough that the same programme in Manchester, Leeds or Glasgow can cost noticeably less over a year without any difference in the fee.',
    partTime:
      'Students holding a valid study visa for a degree-level course are commonly permitted to work a limited number of hours per week during term and more during vacation periods. The allowance is designed to supplement a budget rather than fund a degree, and institutions expect the timetable to come first.',
    postStudy:
      'A post-study work route allowing graduates to stay and look for work has been available in recent years. Its duration and conditions are set by immigration policy and have been revised more than once, so check the terms that apply to your intake rather than relying on what a previous cohort was granted.',
    cityLine:
      'London concentrates the largest number of institutions and the highest costs in one place. Manchester, Birmingham, Leeds and Bristol offer large student populations at a lower cost of living, and Edinburgh and Glasgow add a distinct Scottish system with its own traditions. The country is small enough that most of it is a few hours away by train, and the rest of Europe is a short flight.',
    intakeMonths: [9, 1],
    features: [
      'TOP_RANKED_UNIVERSITIES',
      'ONE_YEAR_MASTER_S_DEGREES',
      'ENGLISH_TAUGHT_DEGREES',
      'POST_STUDY_WORK_AVAILABLE',
      'PART_TIME_ALLOWED',
      'JANUARY_INTAKE_AVAILABLE',
      'STRONG_RESEARCH_FUNDING',
      'LARGE_GRADUATE_JOB_MARKET',
      'WIDE_SUBJECT_CHOICE',
      'SCHOLARSHIP_FRIENDLY',
    ],
    tests: ['IELTS', 'TOEFL', 'PTE'],
    tuitionMin: '12000',
    tuitionMax: '38000',
    livingMin: '900',
    livingMax: '1600',
    partTimeAllowed: true,
    partTimeHours: '20',
    postStudyAvailable: true,
    postStudyMinMonths: null,
    postStudyMaxMonths: null,
    pathwayStrength: 'MODERATE',
    visaType: 'Student visa',
    ieltsRequirement: 'REQUIRED',
    waiverAvailable: true,
    closing:
      'The United Kingdom rewards students who know what they want to study before they arrive. The degree is short, the reading is heavy from the first week, and there is little room to change direction once a programme begins — so the time you spend choosing the right course is the most valuable preparation you can do.',
  },
  {
    name: 'Canada',
    slug: 'canada',
    iso2: 'CA',
    iso3: 'CAN',
    continentSlug: 'north-america',
    capital: 'Ottawa',
    language: 'English and French',
    currencyName: 'Canadian Dollar',
    currencyCode: 'CAD',
    currencySymbol: 'C$',
    nationality: 'Canadian',
    tagline: 'Co-operative education, and a system built around what happens after the degree',
    heading: 'Study in Canada',
    positioning:
      'Canada built its higher education around a practical idea: that a degree should connect to work. Co-operative education — paid work terms alternating with academic terms, built into the degree rather than bolted on — is genuinely widespread here rather than exceptional, and a co-op graduate typically finishes with a year or more of paid, relevant experience alongside the qualification.',
    teaching:
      'Teaching is in English across most of the country and in French in Quebec, where several institutions also teach in English; outside Quebec you will not need French for your studies.',
    system:
      'Education is a provincial responsibility rather than a federal one, so the rules genuinely differ between provinces: fee structures, the academic calendar and the way institutions are designated all vary. Universities grant degrees, while colleges and institutes concentrate on applied diplomas and career programmes — the distinction matters for admission, for cost, and for what a qualification is recognised as afterwards.',
    strengths: [
      'computer science and artificial intelligence',
      'engineering',
      'environmental and earth sciences',
      'business',
      'health sciences',
    ],
    costShape:
      'Canada is usually cheaper than the United States and Australia for a comparable degree, though Toronto and Vancouver have living costs that erase much of that advantage. Fees are set by province and by programme, and professional programmes cost considerably more than general arts or science degrees at the same institution.',
    partTime:
      'Students holding a valid study permit for a full-time programme at a designated institution are generally permitted to work both on and off campus without a separate work permit, within limits set federally. The off-campus limit has been revised in recent years, so confirm the current figure rather than assuming.',
    postStudy:
      'A post-graduation work permit is available to graduates of eligible programmes at designated institutions, with the length usually tied to the length of the programme studied. Eligibility depends on the specific institution and programme, and the criteria have been tightened at various points — confirm that the course you are choosing qualifies before you enrol, not after.',
    cityLine:
      'Toronto is the largest and most expensive, with the deepest job market. Vancouver trades cost for climate and a Pacific outlook. Montreal is the cheapest of the three major cities by a clear margin and has a distinctly European feel. Waterloo is small but disproportionately important in technology, and Calgary and Ottawa offer lower costs with solid institutions.',
    intakeMonths: [9, 1, 5],
    features: [
      'PR_FRIENDLY',
      'POST_STUDY_WORK_AVAILABLE',
      'PART_TIME_ALLOWED',
      'ENGLISH_TAUGHT_DEGREES',
      'JANUARY_INTAKE_AVAILABLE',
      'TOP_RANKED_UNIVERSITIES',
      'STRONG_RESEARCH_FUNDING',
      'WIDE_SUBJECT_CHOICE',
      'SCHOLARSHIP_FRIENDLY',
    ],
    tests: ['IELTS', 'TOEFL', 'PTE', 'DUOLINGO'],
    tuitionMin: '15000',
    tuitionMax: '45000',
    livingMin: '1000',
    livingMax: '1900',
    partTimeAllowed: true,
    partTimeHours: null,
    postStudyAvailable: true,
    postStudyMinMonths: null,
    postStudyMaxMonths: null,
    pathwayStrength: 'STRONG',
    visaType: 'Study permit',
    ieltsRequirement: 'REQUIRED',
    waiverAvailable: true,
    closing:
      'Canada is the destination where the choice of institution carries the most weight beyond academics, because designation status and programme eligibility shape what you are allowed to do after you graduate. Verify those details for your specific programme at the point of choosing it.',
  },
  {
    name: 'Australia',
    slug: 'australia',
    iso2: 'AU',
    iso3: 'AUS',
    continentSlug: 'australia-new-zealand',
    capital: 'Canberra',
    language: 'English',
    currencyName: 'Australian Dollar',
    currencyCode: 'AUD',
    currencySymbol: 'A$',
    nationality: 'Australian',
    tagline: 'Strong research universities, and consumer protections written specifically for international students',
    heading: 'Study in Australia',
    positioning:
      'Australia is unusual in having written the rights of international students into law. A national framework governs what institutions must tell you before you accept a place, what happens to your fees if a course does not run, and how complaints are handled — protections that exist as enforceable obligations rather than as institutional goodwill. For a student committing several years and a large sum from abroad, that is worth more than it first sounds.',
    teaching:
      'Teaching is in English throughout, and the qualifications sit on a single national framework that makes levels directly comparable between institutions.',
    system:
      'Every qualification is placed on the Australian Qualifications Framework, which means a level from one provider maps cleanly onto the same level from another — a genuinely useful thing when comparing a diploma, a bachelor’s degree and a master’s across institutions. Providers teaching international students must be registered on a national register, and the academic year runs February to November, which is the reverse of the northern hemisphere.',
    strengths: [
      'earth and marine sciences',
      'engineering',
      'medicine and public health',
      'agriculture and environmental science',
      'business',
    ],
    costShape:
      'Australia is expensive on both sides of the ledger: tuition is high and so is the cost of living, particularly in Sydney and Melbourne. Health cover is a compulsory additional cost for the whole duration of the visa rather than an optional extra, and it should be in the budget from the start. Adelaide, Brisbane and Canberra are meaningfully cheaper to live in than Sydney.',
    partTime:
      'Students on a valid study visa are generally permitted to work a capped number of hours per fortnight while their course is in session, with the cap lifted during scheduled breaks. The figure has been changed more than once in recent years, so confirm the limit applying to your visa rather than relying on an older number.',
    postStudy:
      'A temporary graduate visa allows eligible graduates to stay and work after completing a qualification, with the duration usually depending on the level of qualification and sometimes on where it was studied. Both the eligibility rules and the durations have been revised, so treat any specific number you read as needing confirmation.',
    cityLine:
      'Sydney and Melbourne are the two largest student cities and the two most expensive; Melbourne is generally regarded as the more liveable of the two and has a denser concentration of campuses near the centre. Brisbane and Perth cost less and offer a warmer, slower pace. Adelaide is the most affordable of the major cities, and Canberra is small, green and built around its universities and the institutions of government.',
    intakeMonths: [2, 7],
    features: [
      'TOP_RANKED_UNIVERSITIES',
      'POST_STUDY_WORK_AVAILABLE',
      'PART_TIME_ALLOWED',
      'ENGLISH_TAUGHT_DEGREES',
      'PR_FRIENDLY',
      'STRONG_RESEARCH_FUNDING',
      'WIDE_SUBJECT_CHOICE',
      'SCHOLARSHIP_FRIENDLY',
    ],
    tests: ['IELTS', 'TOEFL', 'PTE'],
    tuitionMin: '20000',
    tuitionMax: '50000',
    livingMin: '1400',
    livingMax: '2300',
    partTimeAllowed: true,
    partTimeHours: null,
    postStudyAvailable: true,
    postStudyMinMonths: null,
    postStudyMaxMonths: null,
    pathwayStrength: 'STRONG',
    visaType: 'Student visa',
    ieltsRequirement: 'REQUIRED',
    waiverAvailable: true,
    closing:
      'The reversed academic year is the detail most applicants underestimate. A February start means preparing through the second half of the previous year, and a July start means arriving mid-cycle — plan the timeline around that rather than around a northern-hemisphere calendar.',
  },
  {
    name: 'Germany',
    slug: 'germany',
    iso2: 'DE',
    iso3: 'DEU',
    continentSlug: 'europe',
    capital: 'Berlin',
    language: 'German',
    currencyName: 'Euro',
    currencyCode: 'EUR',
    currencySymbol: '€',
    nationality: 'German',
    tagline: 'Public universities that charge little or no tuition, and engineering with an industrial spine',
    heading: 'Study in Germany',
    positioning:
      'Germany is the one major destination where the headline cost of a degree at a public university is close to nothing. Most public institutions charge no tuition for most programmes, funded instead through a per-semester contribution that is a fraction of what a degree costs elsewhere and usually includes a local transport pass. You still need to fund your living costs, and the authorities require proof that you can — but the fee itself is not the obstacle it is in the English-speaking world.',
    teaching:
      'A large and growing number of master’s programmes are taught entirely in English, particularly in engineering and the sciences; at undergraduate level German-taught programmes still dominate, so check the language of instruction programme by programme rather than assuming.',
    system:
      'The system separates research universities from universities of applied sciences, and the distinction is real rather than a matter of prestige: the former lead towards research and doctoral study, the latter towards practice, with project work and industrial placements built into the curriculum. Choosing between them is a choice about what you want to be doing afterwards. Education is also administered by the federal states, so some details differ across the country.',
    strengths: [
      'mechanical and automotive engineering',
      'electrical engineering',
      'physics and the natural sciences',
      'computer science',
      'philosophy and the humanities',
    ],
    costShape:
      'Tuition at public universities is minimal or absent, so the real budget is living costs — and those vary sharply by city, with Munich among the most expensive places in the country and Leipzig or Aachen far cheaper. Private institutions do charge substantial fees and are a different proposition entirely. The authorities require evidence of funds for living costs, usually held in a blocked account, before a visa is issued.',
    partTime:
      'International students are generally permitted to work a fixed allowance of days per year rather than a weekly quota — a set number of full days or twice that many half days — which is a different shape of rule from most other destinations and worth understanding before you plan around it. Work as a student assistant within a university is often treated separately.',
    postStudy:
      'Graduates of German institutions may apply to extend their residence in order to look for work related to their qualification, and Germany has actively built routes for skilled graduates to remain. The specific permit names and durations are set in immigration law and have been reformed recently, so confirm the current route.',
    cityLine:
      'Berlin is the largest, the most international and the most culturally varied, with living costs that have risen but remain below Munich. Munich is expensive and has the strongest concentration of engineering and industry. Heidelberg is a small classic university town. Aachen and Stuttgart are engineering centres with deep industrial links, and Hamburg is a large northern port city with a broad university.',
    intakeMonths: [10, 4],
    features: [
      'LOW_TUITION_FEES',
      'BUDGET_FRIENDLY',
      'EU_MEMBER_STATE',
      'SCHENGEN_VISA',
      'ENGLISH_TAUGHT_DEGREES',
      'STRONG_ENGINEERING_AND_TECHNOLOGY',
      'STRONG_RESEARCH_FUNDING',
      'POST_STUDY_WORK_AVAILABLE',
      'PART_TIME_ALLOWED',
      'GOVERNMENT_SCHOLARSHIPS_AVAILABLE',
    ],
    tests: ['IELTS', 'TOEFL'],
    tuitionMin: '0',
    tuitionMax: '20000',
    livingMin: '850',
    livingMax: '1300',
    partTimeAllowed: true,
    partTimeHours: null,
    postStudyAvailable: true,
    postStudyMinMonths: null,
    postStudyMaxMonths: null,
    pathwayStrength: 'STRONG',
    visaType: 'National student visa',
    ieltsRequirement: 'VARIES',
    waiverAvailable: true,
    closing:
      'Germany asks for more administrative preparation than most destinations — recognition of your prior qualification, proof of funds, registration after arrival, health insurance — and rewards it with a degree that costs a fraction of the equivalent elsewhere. Start the paperwork earlier than you think you need to.',
  },
  {
    name: 'Ireland',
    slug: 'ireland',
    iso2: 'IE',
    iso3: 'IRL',
    continentSlug: 'europe',
    capital: 'Dublin',
    language: 'English',
    currencyName: 'Euro',
    currencyCode: 'EUR',
    currencySymbol: '€',
    nationality: 'Irish',
    tagline: 'English-speaking, in the European Union, and dense with technology and pharmaceutical employers',
    heading: 'Study in Ireland',
    positioning:
      'Ireland occupies a position no other country quite does: an English-speaking member of the European Union, with the European headquarters of a striking number of the world’s largest technology, pharmaceutical and medical device companies concentrated in a country of under six million people. For a graduate in software, data, pharmaceutical science or medical technology, the employers are not in another country — they are a bus ride away.',
    teaching:
      'Teaching is in English throughout. Irish is an official language and visible on signage, but it is not needed for study or daily life.',
    system:
      'Qualifications sit on a national framework that makes levels comparable across institutions and aligns with the wider European structure, which matters if you may later work or study elsewhere in Europe. Undergraduate admission runs through a central application system; postgraduate applications go directly to the university. Taught master’s programmes are typically one year, as in the United Kingdom.',
    strengths: [
      'computer science and software engineering',
      'pharmaceutical and medical device science',
      'data analytics',
      'business and finance',
      'literature and the humanities',
    ],
    costShape:
      'Tuition sits below the United Kingdom for comparable programmes at most institutions. The difficulty in Ireland is accommodation rather than fees: Dublin has a genuine and well-documented housing shortage, and rents there are among the highest in Europe. Secure accommodation as early as you possibly can, and treat a place in university housing as worth more than its price difference suggests.',
    partTime:
      'Students holding a valid immigration permission for a full-time programme on the approved list are generally allowed to work a limited number of hours per week during term and more during defined holiday periods. It is designed to supplement rather than fund a degree.',
    postStudy:
      'Ireland operates a third level graduate scheme allowing eligible graduates to remain and seek employment after completing a recognised award, with the permitted duration usually depending on the level of the award. Conditions are set by immigration policy, so confirm what applies to your award level.',
    cityLine:
      'Dublin holds most of the employers, most of the institutions and nearly all of the housing pressure. Cork is the second city, considerably cheaper, and has its own concentration of pharmaceutical and technology employers. Galway is small, coastal and well regarded for medical technology, and Limerick is a compact university city with a strong co-operative education tradition.',
    intakeMonths: [9, 1],
    features: [
      'ENGLISH_TAUGHT_DEGREES',
      'EU_MEMBER_STATE',
      'ONE_YEAR_MASTER_S_DEGREES',
      'POST_STUDY_WORK_AVAILABLE',
      'PART_TIME_ALLOWED',
      'SETTLEMENT_PATHWAY_TO_STAMP_4',
      'JANUARY_INTAKE_AVAILABLE',
      'LARGE_GRADUATE_JOB_MARKET',
      'GOVERNMENT_SCHOLARSHIPS_AVAILABLE',
    ],
    tests: ['IELTS', 'TOEFL', 'PTE', 'DUOLINGO'],
    tuitionMin: '10000',
    tuitionMax: '30000',
    livingMin: '900',
    livingMax: '1600',
    partTimeAllowed: true,
    partTimeHours: '20',
    postStudyAvailable: true,
    postStudyMinMonths: null,
    postStudyMaxMonths: null,
    pathwayStrength: 'MODERATE',
    visaType: 'Study visa',
    ieltsRequirement: 'REQUIRED',
    waiverAvailable: true,
    closing:
      'Sort accommodation before anything else. Students who arrive in Dublin without a confirmed place to live spend their first weeks solving that instead of starting their degree, and it is the single most common difficulty reported here.',
  },
  {
    name: 'Netherlands',
    slug: 'netherlands',
    iso2: 'NL',
    iso3: 'NLD',
    continentSlug: 'europe',
    capital: 'Amsterdam',
    language: 'Dutch',
    currencyName: 'Euro',
    currencyCode: 'EUR',
    currencySymbol: '€',
    nationality: 'Dutch',
    tagline: 'Problem-based learning, English-taught degrees, and a country you can cross by bicycle',
    heading: 'Study in the Netherlands',
    positioning:
      'The Netherlands teaches differently, and that is the reason to come here rather than the incidental detail. Problem-based learning — small groups working through real problems with a tutor rather than absorbing lectures — is the house style at several Dutch universities, and it produces graduates who are used to arguing a position, working in a team of people who disagree, and presenting a conclusion. If you want to be taught rather than lectured at, this is the system built for it.',
    teaching:
      'The Netherlands offers more English-taught degree programmes than almost anywhere else in continental Europe, at both undergraduate and postgraduate level, so you can complete an entire degree here without Dutch.',
    system:
      'The system splits into research universities and universities of applied sciences, with a genuine difference of purpose: research universities lead towards academic and doctoral work, applied sciences universities towards professional practice with placements built in. Many programmes admit through a national application portal, and some of the most competitive use a selection procedure with its own earlier deadline — a detail that catches applicants out every year.',
    strengths: [
      'engineering and technology',
      'agriculture and food science',
      'water management and civil engineering',
      'business and economics',
      'design',
    ],
    costShape:
      'Tuition for students from outside the European Union is higher than the Dutch domestic rate but generally below comparable programmes in the United Kingdom or Australia. Housing is the pressure point: student accommodation is in genuinely short supply in Amsterdam and Utrecht in particular, and the search should begin the moment you have an offer rather than after you arrive.',
    partTime:
      'Students from outside the European Union generally need their employer to hold a work permit, and are limited to a set number of hours per week during the year or full-time work during the summer months — but not both in the same period. The employer-permit requirement is the part most people do not expect.',
    postStudy:
      'The Netherlands offers an orientation year for graduates of Dutch institutions, allowing a period of residence to look for work with fewer restrictions than a standard work permit. It is a well-established route, though as with any immigration provision the conditions can change.',
    cityLine:
      'Amsterdam is the largest and most expensive with the most international feel. Delft is a compact technical city that lives around its university. Utrecht sits in the centre of the country and everything is within reach. Eindhoven is the technology and design centre, Rotterdam is modern, working and cheaper than Amsterdam, and Groningen in the north has the youngest population and the lowest costs of the major student cities. Almost everyone cycles, and it is genuinely the fastest way to get anywhere.',
    intakeMonths: [9, 2],
    features: [
      'ENGLISH_TAUGHT_DEGREES',
      'EU_MEMBER_STATE',
      'SCHENGEN_VISA',
      'POST_STUDY_WORK_AVAILABLE',
      'PART_TIME_ALLOWED',
      'TOP_RANKED_UNIVERSITIES',
      'STRONG_RESEARCH_FUNDING',
      'WIDE_SUBJECT_CHOICE',
      'SCHOLARSHIP_FRIENDLY',
    ],
    tests: ['IELTS', 'TOEFL', 'PTE'],
    tuitionMin: '8000',
    tuitionMax: '25000',
    livingMin: '900',
    livingMax: '1500',
    partTimeAllowed: true,
    partTimeHours: '16',
    postStudyAvailable: true,
    postStudyMinMonths: null,
    postStudyMaxMonths: null,
    pathwayStrength: 'MODERATE',
    visaType: 'Residence permit for study',
    ieltsRequirement: 'REQUIRED',
    waiverAvailable: true,
    closing:
      'Watch the deadlines for selective programmes, which close earlier than the general ones and do not reopen. And start looking for housing the day your offer arrives — in Amsterdam and Utrecht it is the binding constraint, not the admission.',
  },
  {
    name: 'Singapore',
    slug: 'singapore',
    iso2: 'SG',
    iso3: 'SGP',
    continentSlug: 'asia',
    capital: 'Singapore',
    language: 'English, Malay, Mandarin and Tamil',
    currencyName: 'Singapore Dollar',
    currencyCode: 'SGD',
    currencySymbol: 'S$',
    nationality: 'Singaporean',
    tagline: 'A small number of very strong universities, at the centre of Asian business',
    heading: 'Study in Singapore',
    positioning:
      'Singapore has concentrated its effort into a handful of universities rather than spreading it across many, and the result is a small system with unusual depth. For a student who wants a rigorous degree with Asia’s business and financial networks immediately outside the campus gates, rather than a continent away, there is no closer equivalent.',
    teaching:
      'English is the medium of instruction throughout the education system and the working language of business and government, so no other language is needed to study or live here.',
    system:
      'The universities are few and admission is correspondingly competitive; there is no large second tier to fall back on, which makes a realistic shortlist more important here than in a country with hundreds of institutions. Programmes are demanding, continuous assessment is the norm, and the academic calendar generally runs from August.',
    strengths: [
      'engineering and computer science',
      'business and finance',
      'biomedical sciences',
      'urban planning and architecture',
      'maritime and supply chain studies',
    ],
    costShape:
      'Tuition is substantial, though the government offers tuition grant schemes to some international students in exchange for a commitment to work in Singapore for a defined period after graduation — a genuinely significant reduction that comes with an obligation worth understanding fully before accepting. Living costs are high by regional standards, with accommodation the largest component; university halls are markedly cheaper than renting privately.',
    partTime:
      'Students at approved institutions holding a valid student pass are generally permitted to work a limited number of hours per week during term and full-time during scheduled vacation, subject to their institution’s rules. Institutions apply their own conditions on top of the national ones.',
    postStudy:
      'Graduates may apply for a pass allowing a period of residence to seek employment, and Singapore’s employment pass framework is oriented towards skilled graduates in demand sectors. The criteria are periodically revised and are tied to salary and qualification thresholds, so confirm the current position.',
    cityLine:
      'Singapore is a city-state, so the choice is not which city but which part of it. Campuses are spread across the island and connected by an efficient rail network, and few students live more than forty minutes from where they study. The island is also a regional travel hub, and much of Southeast Asia is within a short, inexpensive flight.',
    intakeMonths: [8, 1],
    features: [
      'TOP_RANKED_UNIVERSITIES',
      'ENGLISH_TAUGHT_DEGREES',
      'STRONG_STEM_INSTITUTIONS',
      'PART_TIME_ALLOWED',
      'POST_STUDY_WORK_AVAILABLE',
      'GOVERNMENT_SCHOLARSHIPS_AVAILABLE',
      'STRONG_RESEARCH_FUNDING',
      'JANUARY_INTAKE_AVAILABLE',
    ],
    tests: ['IELTS', 'TOEFL'],
    tuitionMin: '17000',
    tuitionMax: '45000',
    livingMin: '1000',
    livingMax: '2000',
    partTimeAllowed: true,
    partTimeHours: '16',
    postStudyAvailable: true,
    postStudyMinMonths: null,
    postStudyMaxMonths: null,
    pathwayStrength: 'MODERATE',
    visaType: 'Student’s Pass',
    ieltsRequirement: 'REQUIRED',
    waiverAvailable: true,
    closing:
      'Because there are so few institutions, apply early and apply realistically. And if you are offered a tuition grant, read the service obligation attached to it carefully — it is a substantial saving and a substantial commitment at the same time.',
  },
];

/** The first eight destinations, then the twelve in `countries-more.ts`. */
export const COUNTRIES: CountryFacts[] = [...BASE_COUNTRIES, ...MORE_COUNTRIES];
