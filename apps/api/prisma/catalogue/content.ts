/**
 * Content helpers for the production catalogue population.
 *
 * Everything a destination page says is composed here from facts recorded per
 * country rather than written once and copied, so eight destinations read as
 * eight destinations: the paragraphs are built from what is actually true of
 * each one -- what it teaches in, what it costs relative to its neighbours, how
 * its work rules differ -- and the shape of the page stays consistent.
 *
 * Nothing in here invents a figure. Where a number would be a guess (a live
 * ranking, a visa fee, a processing time) the field is left null and the prose
 * says what is stable instead.
 */

export type Paragraphs = string[];

/** Authored rich text, as the editors' own WYSIWYG would store it. */
export function html(paragraphs: Paragraphs): string {
  return paragraphs
    .map((line) =>
      line.startsWith('##')
        ? `<h3>${line.replace(/^##\s*/, '')}</h3>`
        : `<p>${line}</p>`,
    )
    .join('');
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** A visa's name inside a sentence. A common noun loses its capital ("the
 * study permit"); a code or proper name keeps it ("the F-1 student visa", "the
 * Student's Pass"); and a bracketed designation is never touched ("the
 * national (Type D) study visa"). Lowercasing the whole name, as this did,
 * printed "the f-1 student visa" and "(vls-ts)". */
export function visaInSentence(name: string): string {
  const words = name.replace(/\([^)]*\)/g, ' ').trim().split(/\s+/);
  const proper =
    !/^[A-Z][a-z]/.test(words[0] ?? '') ||
    words.slice(1).some((word) => /^[A-Z]/.test(word));
  return proper ? name : name.charAt(0).toLowerCase() + name.slice(1);
}

/** The regional indicator pair for an ISO code, matching the Admin editor. */
export function flagEmoji(iso2: string): string {
  return String.fromCodePoint(
    ...[...iso2.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

export type CountryFacts = {
  /**
   * Set where an editor has already written this country by hand. The seed then
   * only ever adds what is missing -- it never rewrites prose, features,
   * documents or sections that a person authored.
   */
  preserveAuthored?: boolean;
  name: string;
  slug: string;
  iso2: string;
  iso3: string;
  continentSlug: string;
  capital: string;
  language: string;
  currencyName: string;
  currencyCode: string;
  currencySymbol: string;
  nationality: string;
  tagline: string;
  heading: string;
  /** One clause that says what this destination is for. */
  positioning: string;
  /** What the teaching language situation actually is. */
  teaching: string;
  /** How the system is organised -- the sentence a prospectus would not write. */
  system: string;
  /** Subjects it is genuinely known for. */
  strengths: string[];
  /** Honest cost framing relative to its peers. */
  costShape: string;
  /** Work-during-study reality. */
  partTime: string;
  /** What happens after graduation. */
  postStudy: string;
  /** The cities a student would actually consider. */
  cityLine: string;
  /** Intake months, 1-12. */
  intakeMonths: number[];
  /** Feature labels the editor would tick. */
  features: string[];
  /** Accepted English tests. */
  tests: string[];
  /** Cost profile: min/max where genuinely publishable, else null. */
  tuitionMin: string | null;
  tuitionMax: string | null;
  livingMin: string | null;
  livingMax: string | null;
  /** Work profile. */
  partTimeAllowed: boolean;
  partTimeHours: string | null;
  postStudyAvailable: boolean;
  postStudyMinMonths: number | null;
  postStudyMaxMonths: number | null;
  pathwayStrength: 'LIMITED' | 'MODERATE' | 'STRONG' | null;
  visaType: string;
  /** English requirement shape. */
  ieltsRequirement: 'REQUIRED' | 'OPTIONAL' | 'NOT_REQUIRED' | 'VARIES';
  waiverAvailable: boolean;
  /** A distinctive closing note used in the overview. */
  closing: string;
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const monthName = (m: number) => MONTHS[m - 1];

function list(values: string[]): string {
  if (values.length <= 1) return values[0] ?? '';
  return `${values.slice(0, -1).join(', ')} and ${values[values.length - 1]}`;
}

/**
 * The country overview: eight to ten blocks built from the facts above.
 *
 * The structure is shared so every destination page answers the same questions
 * in the same order; the sentences are the country's own.
 */
export function countryOverview(f: CountryFacts): Paragraphs {
  return [
    `## ${f.heading.replace(/^Study in /, 'Why ')}`,
    f.positioning,
    f.teaching,
    '## How the system is organised',
    f.system,
    `Qualifications follow the pattern most international applicants will recognise: an undergraduate degree, a taught postgraduate degree of one to two years, and research degrees beyond that. What varies between institutions is the credit structure and how much of the final year is given over to a project or dissertation, so it is worth reading the actual module list rather than assuming two degrees with the same title are the same degree.`,
    '## What it is known for',
    `${f.name} has real depth in ${list(f.strengths)}. Strength is concentrated by department rather than spread evenly across an institution, so a mid-sized university can host a genuinely leading group in one field while being unremarkable in another. Read the faculty list and recent work of the department you are applying to, not the institution's own summary of itself.`,
    '## What it costs',
    f.costShape,
    `Budget separately for arrival. The flight, a deposit, the first instalment of fees, setting up a room, a local phone number and the documentation you need in your first weeks all land at once, and students consistently under-budget that period while over-budgeting the months that follow.`,
    '## Working, during and after',
    f.partTime,
    f.postStudy,
    '## Where you would live',
    f.cityLine,
    '## Applying',
    `Applications run well ahead of the start date and are set institution by institution rather than nationally. Work backwards from the month teaching begins: allow time for documents and any translations, for an English test if you need one, for the decision itself, for the visa, and for accommodation, which often runs on its own deadline. ${f.intakeMonths.length > 1 ? `Entry is offered in ${list(f.intakeMonths.map(monthName))}, and the main intake carries the widest choice of programmes.` : `Entry is offered in ${monthName(f.intakeMonths[0])}, so the deadlines around it matter.`}`,
    f.closing,
  ];
}

export function countryShortDescription(f: CountryFacts): string {
  return `<p>${f.positioning} ${f.teaching.split('. ')[0]}. ${f.costShape.split('. ')[0]}.</p>`;
}

/** Eight or more documents, with the country's own specifics woven in. */
export function countryDocuments(f: CountryFacts) {
  return [
    {
      name: 'Passport',
      required: true,
      details: html([
        `A passport valid well beyond your intended arrival is the document everything else hangs on. The offer letter, the visa and your enrolment record are all tied to the name, number and date of birth printed in it, so the spelling there is the spelling to use everywhere else.`,
        `Check the expiry date before you begin. Renewing mid-application is one of the most common reasons a student misses an intake, because a visa cannot be issued into a document that is about to expire.`,
        `Bring the original and keep photocopies of the identity pages separately — you will be asked for them repeatedly during enrolment, accommodation and banking.`,
      ]),
    },
    {
      name: 'Academic transcripts',
      required: true,
      details: html([
        `Provide transcripts for every year of the qualification you are applying on, not only the final summary. Admissions assess subject-by-subject performance, and a single consolidated grade does not give them that.`,
        `Where your transcripts are issued in a language other than English, an official translation is submitted alongside the original rather than instead of it. If your grading scale is not widely used internationally, include the official grading key — this is routinely overlooked and is the easiest way to have a strong application undervalued.`,
      ]),
    },
    {
      name: 'Degree or school leaving certificate',
      required: true,
      details: html([
        `The certificate awarding your qualification, as distinct from the transcript showing the marks. Postgraduate applicants need their undergraduate certificate; undergraduate applicants need their school leaving certificate.`,
        `Applying before final results are published is normal: most institutions accept a provisional certificate or an official letter confirming expected completion, and make the offer conditional on the final document.`,
      ]),
    },
    {
      name: 'English language evidence',
      required: f.ieltsRequirement === 'REQUIRED',
      details: html([
        f.waiverAvailable
          ? `Many institutions in ${f.name} waive the English test where your previous qualification was taught and examined in English, against a medium of instruction letter on official letterhead. Ask the admissions office directly whether yours qualifies, and get the answer in writing before deciding not to sit a test.`
          : `Evidence of English is part of the application for most programmes in ${f.name}.`,
        `Where a test is required, ${list(f.tests)} are the commonly accepted options. The score is set by the institution and often by the programme, and where a requirement names minimums for each component as well as an overall score, both halves matter — the component that catches people out is usually writing.`,
        `Results take time to be issued and reported. Sit the test early enough that the result reaches the admissions office before the deadline rather than just after it.`,
      ]),
    },
    {
      name: 'Statement of purpose',
      required: true,
      details: html([
        `Why this subject, why this programme, why now. It is read closely for postgraduate admission and increasingly for competitive undergraduate programmes.`,
        `Write it specifically. A statement that could have been sent to any university in any country reads exactly like that. Name the modules, the research groups or the faculty whose work drew you here and connect them to something you have actually done.`,
      ]),
    },
    {
      name: 'Letters of recommendation',
      required: true,
      details: html([
        `Most programmes ask for two; research programmes often ask for three. They should come from people who have taught or supervised you directly and can write about your work in specific terms.`,
        `A referee who knows your work well is worth more than a senior one who does not. Approach them early and give them your transcript, your statement and the programme description — referees write better letters when they can see what you are applying for.`,
      ]),
    },
    {
      name: 'CV or résumé',
      required: true,
      details: html([
        `Education, research, projects, internships, employment, publications and technical skills, in reverse chronological order. Two pages is plenty at this stage.`,
        `For technical programmes, list what you built and the tools you used. For management programmes, quantify what you were responsible for.`,
      ]),
    },
    {
      name: 'Proof of funds',
      required: true,
      details: html([
        `Evidence that tuition and living costs can be met for the period of study. It is assessed twice in practice: by the institution at admission, and again as part of the visa application.`,
        `Recent bank statements stamped by the bank, a solvency certificate, a loan sanction letter, or a sponsor's documents with proof of relationship are all commonly accepted. Funds should sit in an account with a settled history rather than one that received a single large deposit shortly before the application.`,
        `Assemble this early. It is the document most often requested again at short notice and the slowest to obtain in a hurry.`,
      ]),
    },
    {
      name: 'Passport photographs',
      required: false,
      details: html([
        `A set of recent photographs to the standard photographic specification, used across the visa application, enrolment, your student card, library and building access and opening a bank account. Keep a digital copy of the same image for the online steps.`,
      ]),
    },
    {
      name: 'Offer letter',
      required: true,
      details: html([
        `The offer from your institution is the document the student visa is issued against, and it should state your name, the programme, the level, the duration and the start date exactly as they appear in your records.`,
        `Read it for conditions. A conditional offer lists what still has to be satisfied and does not become firm until those conditions are cleared in writing.`,
      ]),
    },
  ];
}

/** Eight or more FAQs per country, answered from that country's facts. */
export function countryFaqs(f: CountryFacts) {
  return [
    {
      question: `Do I need to speak ${f.language.split(' and ')[0]} to study in ${f.name}?`,
      category: 'English',
      answer: html([
        f.teaching,
        `Outside the classroom the picture is more varied, and most international students pick up enough of the local language in their first term to shop, travel and make friends beyond the university. Many institutions run free or low-cost classes. It adds to the experience rather than being a requirement of it.`,
      ]),
    },
    {
      question: `How much does it cost to study in ${f.name}?`,
      category: 'Cost',
      answer: html([
        f.costShape,
        `Compare fee structures rather than headline numbers. Look for what is charged once at admission and what recurs, for separate line items covering examinations, the library, insurance and refundable deposits, and for whether the figure quoted is per year or per term. Ask directly whether the fee is fixed for the duration of the programme or revised annually.`,
      ]),
    },
    {
      question: `Can I work part-time while studying in ${f.name}?`,
      category: 'Work',
      answer: html([
        f.partTime,
        `Rules in this area are set by immigration policy, can differ by nationality and are revised from time to time. Confirm the position that applies to you with your institution's international office and the authority that issued your visa before accepting any paid engagement.`,
      ]),
    },
    {
      question: `Can I stay and work in ${f.name} after I graduate?`,
      category: 'Work',
      answer: html([
        f.postStudy,
        `Whatever the route, recruitment does not begin the day you graduate. Engage with your institution's careers service in the year before you finish, and ask specifically which employers sponsor and which roles are open to international graduates.`,
      ]),
    },
    {
      question: `What are the intakes, and when should I apply?`,
      category: 'Intakes',
      answer: html([
        `${f.name} offers entry in ${list(f.intakeMonths.map(monthName))}. ${f.intakeMonths.length > 1 ? 'The main intake carries the widest choice of programmes and the fullest cohort; the others are narrower.' : 'Everything is built around that single entry point, so the deadlines matter more than they would elsewhere.'}`,
        `Timelines run well ahead of the start date and are set institution by institution. Work backwards rather than forwards: documents and translations, an English test if you need one, the application, the decision, the visa, and accommodation, which often has its own separate deadline.`,
      ]),
    },
    {
      question: `Where will I live?`,
      category: 'Accommodation',
      answer: html([
        f.cityLine,
        `University accommodation is the simplest way to start and is usually allocated separately from admission, often on its own deadline — apply as early as you are allowed rather than waiting until you arrive. Renting privately costs more and varies enormously by city; if you go that way, arrange something short-term for your first weeks and find a longer-term place once you can see neighbourhoods yourself.`,
      ]),
    },
    {
      question: `Do I need an IELTS or TOEFL score?`,
      category: 'English',
      answer: html([
        f.waiverAvailable
          ? `Often not. Many institutions waive the test where your previous qualification was taught and examined in English, against a medium of instruction letter from that institution.`
          : `Usually yes, for most programmes.`,
        `Where a test is required, ${list(f.tests)} are the commonly accepted options, and the score is set by the institution and the programme rather than nationally. Check two details that are easy to miss: whether minimum scores are required in each component as well as overall, and whether the specific test you plan to take is accepted. Get both answers in writing before booking.`,
      ]),
    },
    {
      question: `What documents do I need to apply?`,
      category: 'Documents',
      answer: html([
        `The core set is your passport, complete academic transcripts, the degree or school leaving certificate, a statement of purpose, letters of recommendation, a CV and proof of funds.`,
        `Two additions are frequently needed and frequently forgotten: certified translations where your documents are not in English, and the official grading key where your scale is not widely used internationally. Start assembling everything before the portal opens — writing the application takes days, obtaining a duplicate transcript takes weeks.`,
      ]),
    },
    {
      question: `How does the student visa work?`,
      category: 'Visa',
      answer: html([
        `You apply for the ${visaInSentence(f.visaType)} once you hold an offer from a recognised institution. It is the only appropriate category for a full-time programme, and arriving on a visitor visa intending to convert it is not a workable route.`,
        `Take the document checklist from the mission responsible for your area rather than from a general guide — requirements genuinely differ by nationality and location. When the visa is issued, check every printed detail against your passport and your offer letter before booking a flight.`,
      ]),
    },
    {
      question: `How do I choose between institutions?`,
      category: 'University selection',
      answer: html([
        `Start with the department rather than the institution. Strength is concentrated rather than evenly distributed, so a mid-sized university can host a leading group in one field while being ordinary in another. Read the faculty list and recent work before the prospectus.`,
        `Then compare the actual degrees rather than the titles: credit weightings, the balance of core and elective modules, whether a project or dissertation is compulsory, and whether a placement is built into the curriculum. Finally ask what happens at the end — which employers recruit on campus, and where recent graduates from your specific programme have gone.`,
      ]),
    },
  ];
}

/** Four or more editorial sections, in the keys the public page renders. */
export function countrySections(f: CountryFacts) {
  return [
    {
      key: 'why-study',
      type: 'RICH_TEXT',
      eyebrow: `The case for ${f.name}`,
      heading: `Why students choose ${f.name}`,
      body: {
        paragraphs: [
          `<p>${f.positioning}</p>`,
          `<p>${f.teaching}</p>`,
          `<p>${f.name} has genuine depth in ${list(f.strengths)}, and the institutions that lead in those fields are open to international applicants rather than nominally so.</p>`,
          `<p>${f.costShape}</p>`,
          `<p>${f.cityLine}</p>`,
        ],
      },
    },
    {
      key: 'cost-of-study',
      type: 'FACT_GRID',
      eyebrow: 'Money',
      heading: `What shapes the cost of studying in ${f.name}`,
      body: {
        items: [
          { label: 'Currency', value: `${f.currencyName} (${f.currencySymbol})` },
          { label: 'Language of instruction', value: f.teaching.includes('English') ? 'English' : f.language },
          { label: 'Biggest cost variable', value: 'Whether the institution is publicly funded or private' },
          { label: 'Second biggest', value: 'The city you live in' },
          { label: 'Cheapest way to live', value: 'University accommodation, applied for early' },
          { label: 'Fees usually paid', value: 'By term or by year, rarely in one sum' },
          { label: 'Budget separately for', value: 'Arrival — deposit, first instalment, setting up a room' },
          { label: 'Main intake', value: list(f.intakeMonths.map(monthName)) },
        ],
      },
    },
    {
      key: 'application-steps',
      type: 'STEPS',
      eyebrow: 'Applying',
      heading: 'From shortlist to enrolment',
      body: {
        items: [
          { step: '1', title: 'Shortlist programmes, not just universities', description: `<p>Read the credit structure, the module list and the department's research interests rather than the institution's name. Build a shortlist with a realistic spread rather than several equally competitive choices.</p>` },
          { step: '2', title: 'Check entry requirements one programme at a time', description: `<p>Requirements are set at programme level, so two courses at the same university can ask for different things. Confirm the qualification required and what evidence of English is accepted.</p>` },
          { step: '3', title: 'Assemble your documents first', description: `<p>Transcripts for every year, the certificate, certified translations and a grading key where needed, your statement, your CV, and referees briefed and ready. Getting a translation takes weeks; writing the application takes days.</p>` },
          { step: '4', title: 'Apply and track what each institution asks next', description: `<p>Several programmes add a test, a portfolio or an interview. Keep a simple record of what each application needs and what stage it is at — follow-ups arrive on different timetables.</p>` },
          { step: '5', title: 'Accept an offer and read the conditions', description: `<p>A conditional offer lists exactly what still has to be satisfied. Check that your name, programme, level, duration and start date are printed correctly, because the visa is issued against this document.</p>` },
          { step: '6', title: 'Prepare your finances', description: `<p>Stamped statements covering several months, a loan sanction letter, or a sponsor's documents with proof of relationship. Pay whatever admission instalment your institution requires and keep every receipt.</p>` },
          { step: '7', title: `Apply for the ${visaInSentence(f.visaType)}`, description: `<p>Apply from your home country using the checklist published by the mission responsible for your area. Bring the originals, and check every printed detail on the visa before you travel.</p>` },
          { step: '8', title: 'Arrange accommodation and arrival', description: `<p>Apply for university accommodation as early as you are allowed — allocation usually runs on its own deadline. Confirm arrival dates with the international office.</p>` },
        ],
      },
    },
    {
      key: 'student-life',
      type: 'CARD_GRID',
      eyebrow: 'Living here',
      heading: `What student life is actually like in ${f.name}`,
      body: {
        items: [
          { title: 'Societies run most of it', description: `<p>Departments and students' unions run societies covering everything from robotics and debating to theatre, photography and sport. Joining two or three in your first term is the normal way to build a life outside your timetable.</p>` },
          { title: 'The academic rhythm', description: `<p>Continuous assessment through the term rather than everything resting on one examination at the end. Most students find the rhythm within their first term, but it is a real adjustment if you have come from a system built around final exams.</p>` },
          { title: 'Food and daily costs', description: `<p>Cooking for yourself is materially cheaper than eating out, and the weekly shop is where most students find the savings that make the monthly figure work.</p>` },
          { title: 'Getting around', description: `<p>Student travel discounts are worth arranging in your first week rather than your second month — most cities have a scheme, and over a year the difference is not small.</p>` },
          { title: 'The first fortnight', description: `<p>Registration, a bank account, a local phone number and any required reporting to the authorities all land at once. Doing them in the first two weeks makes the rest of the year straightforward.</p>` },
          { title: 'Travel', description: `<p>${f.cityLine.split('. ').slice(-1)[0]}</p>` },
        ],
      },
    },
    {
      key: 'visa-process',
      type: 'RICH_TEXT',
      eyebrow: 'Visa',
      heading: `The ${visaInSentence(f.visaType)}, start to finish`,
      body: {
        paragraphs: [
          `<p>The ${visaInSentence(f.visaType)} is applied for after you hold an offer from a recognised institution, and it is the only appropriate category for a full-time programme. Arriving on a visitor visa intending to convert it is not a workable plan.</p>`,
          `<p>The application begins online and is completed at an appointment with the mission responsible for your area. Take the document checklist from that mission rather than from a general description — requirements genuinely differ by nationality and by location.</p>`,
          `<p>Bring the originals of everything you uploaded, expect to give biometrics, and expect a short set of questions about your course, your institution and how your studies are funded. They are answered from knowledge of your own plans, which is the point of asking.</p>`,
          `<p>When the visa is issued, check every printed detail against your passport and your offer letter before you book a flight: name, date of birth, passport number, the institution named, the validity dates and any conditions. An error found now is corrected easily; one found at an airport is not.</p>`,
        ],
      },
    },
  ];
}
