import { html } from './content';
import { MORE_UNIVERSITIES } from './universities-more';

export type UniversityFacts = {
  name: string;
  slug: string;
  countrySlug: string;
  /** City name, matching an entry in CITIES for that country. */
  city: string;
  institutionType: string;
  /** Year of foundation -- a stable historical fact, unlike a ranking. */
  founded: number;
  /** What this institution is, in one or two sentences. */
  character: string;
  /** The fields it is genuinely known for. */
  strengths: string[];
  /** What being taught here is like. */
  teaching: string;
  /** The physical place. */
  campus: string;
  /** What tends to happen afterwards. */
  afterwards: string;
  /** Named campuses beyond the main one, if any. */
  extraCampuses?: { name: string; city: string; note: string }[];
  featured?: boolean;
};

const F = (list: string[]) =>
  list.length <= 1 ? list[0] : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;

/** Plain text: the admin edits a university's short summary in a plain input,
 * and the public pages print it as text, so markup here showed as "<p>". */
export function universityShortDescription(u: UniversityFacts): string {
  return u.character;
}

/** Five to seven paragraphs, composed from what is true of this institution. */
export function universityOverview(u: UniversityFacts): string {
  return html([
    u.character,
    `Founded in ${u.founded}, it operates as ${u.institutionType.toLowerCase() === 'public' ? 'a publicly funded institution' : `a ${u.institutionType.toLowerCase()} institution`} in ${u.city}.`,
    '## What it is strong in',
    `Its recognised strengths lie in ${F(u.strengths)}. As anywhere, that strength is concentrated by department rather than spread evenly across the institution, so read the faculty list and recent work of the specific department you are applying to before you decide.`,
    '## Being taught here',
    u.teaching,
    '## The campus',
    u.campus,
    '## Afterwards',
    u.afterwards,
    `Entry requirements, the structure of each degree and the documents needed are set programme by programme rather than institution-wide, so check them against the specific course you intend to apply for.`,
  ]);
}

const BASE_UNIVERSITIES: UniversityFacts[] = [
  // ---------------------------------------------------------------- United Kingdom
  {
    name: 'University of Oxford', slug: 'university-of-oxford', countrySlug: 'united-kingdom',
    city: 'Oxford', institutionType: 'Public', founded: 1096, featured: true,
    character:
      'Oxford is the oldest university in the English-speaking world, and it still teaches in a way almost no other institution does: through the tutorial, where one or two students meet an academic each week to defend an essay they have written.',
    strengths: ['philosophy, politics and economics', 'law', 'medicine', 'the classics and history', 'mathematics and computer science'],
    teaching:
      'The tutorial system is the defining experience. You write, you present, and you are questioned closely on what you have argued — weekly, for the length of the degree. It is demanding in a way that lectures are not, and it produces graduates who can hold an argument under pressure. Terms are short and intense, with a great deal of reading expected between them.',
    campus:
      'There is no single campus. The university is a federation of colleges scattered through the city centre, each with its own hall, library and accommodation, and students belong to a college as much as to the university. The city and the university are effectively the same place.',
    afterwards:
      'Graduates move in large numbers into law, finance, the civil service, academia and journalism, and the alumni network is unusually active in those fields.',
    extraCampuses: [{ name: 'Oxford city colleges', city: 'Oxford', note: 'The collegiate sites that make up the university across the city centre.' }],
  },
  {
    name: 'University of Cambridge', slug: 'university-of-cambridge', countrySlug: 'united-kingdom',
    city: 'Cambridge', institutionType: 'Public', founded: 1209, featured: true,
    character:
      'Cambridge shares Oxford’s collegiate structure and its supervision-based teaching, with a historic weighting towards mathematics and the natural sciences that still shapes the place.',
    strengths: ['mathematics', 'physics and the natural sciences', 'engineering', 'medicine', 'computer science'],
    teaching:
      'Supervisions — small-group teaching with an academic, weekly — sit alongside lectures and laboratory work. The mathematical tradition runs deep enough that it shapes how several other subjects are taught here, and the pace assumes a strong quantitative background.',
    campus:
      'A collegiate university spread through a small city, with colleges along the river and science and engineering departments concentrated on sites to the west and south. Much of the city is walkable or, more commonly, cycled.',
    afterwards:
      'A strong route into research and doctoral study, alongside technology, engineering, finance and consulting. The surrounding technology and biotechnology cluster has grown up directly around the university.',
  },
  {
    name: 'Imperial College London', slug: 'imperial-college-london', countrySlug: 'united-kingdom',
    city: 'London', institutionType: 'Public', founded: 1907, featured: true,
    character:
      'Imperial is unusual among major British universities in teaching only science, engineering, medicine and business — there is no arts faculty, and the focus shows in everything the institution does.',
    strengths: ['engineering', 'medicine', 'computing', 'physics and chemistry', 'business for technical graduates'],
    teaching:
      'Quantitative and laboratory-heavy from the first term, with a strong emphasis on practical and project work and close involvement from industry. Programmes assume mathematical fluency rather than building it.',
    campus:
      'The main campus sits in South Kensington among the major London museums, with medical campuses attached to teaching hospitals across the city and a newer research campus to the west.',
    afterwards:
      'Graduates go predominantly into engineering, technology, medicine, consulting and quantitative finance. The college runs an active programme for spinning research out into companies.',
    extraCampuses: [
      { name: 'South Kensington', city: 'London', note: 'The main campus, alongside the museum quarter.' },
      { name: 'White City', city: 'London', note: 'A newer research and innovation campus to the west of the city.' },
    ],
  },
  {
    name: 'University College London', slug: 'university-college-london', countrySlug: 'united-kingdom',
    city: 'London', institutionType: 'Public', founded: 1826, featured: true,
    character:
      'UCL was founded to admit students regardless of religion, at a time when the older universities did not, and that founding intent as England’s first secular university still colours its self-image.',
    strengths: ['architecture and the built environment', 'medicine and neuroscience', 'economics', 'computer science', 'education'],
    teaching:
      'Very large and very broad, which means genuine range in what you can study and a scale that rewards students who seek things out. Research-led throughout, with departments that are often the leading group in the country for their field.',
    campus:
      'Centred on Bloomsbury in central London, with buildings woven into the surrounding streets rather than gathered behind a gate, and associated hospitals and institutes across the city.',
    afterwards:
      'A wide spread reflecting the breadth of the institution — medicine and health, technology, architecture, policy, finance and academia.',
  },
  {
    name: 'University of Manchester', slug: 'university-of-manchester', countrySlug: 'united-kingdom',
    city: 'Manchester', institutionType: 'Public', founded: 1824,
    character:
      'One of the largest universities in the United Kingdom by student numbers, with a research record that includes the splitting of the atom and the isolation of graphene.',
    strengths: ['materials science', 'engineering', 'computer science', 'medicine and health', 'business and economics'],
    teaching:
      'Large cohorts, a very wide choice of subjects and substantial laboratory and research facilities. The scale means resources that smaller institutions cannot match, and rewards students who make use of them.',
    campus:
      'A single continuous campus along a corridor running south from the city centre, so teaching, libraries, the students’ union and much of the accommodation are all within a walk.',
    afterwards:
      'Strong recruitment into engineering, technology, healthcare, finance and the public sector, supported by one of the largest graduate employer fairs in the country.',
  },
  {
    name: 'University of Edinburgh', slug: 'university-of-edinburgh', countrySlug: 'united-kingdom',
    city: 'Edinburgh', institutionType: 'Public', founded: 1583,
    character:
      'Edinburgh has been central to Scottish intellectual life since the sixteenth century and remains one of the strongest research universities in the United Kingdom, with particular prominence in informatics.',
    strengths: ['informatics and artificial intelligence', 'medicine and veterinary medicine', 'philosophy', 'linguistics', 'earth sciences'],
    teaching:
      'The Scottish four-year undergraduate degree keeps the first two years broader than the English equivalent, which suits students not yet certain of their specialism. Research-led teaching throughout, with informatics unusually strong.',
    campus:
      'Distributed across the city, with the central area around the old town and George Square, a science and engineering campus to the south, and the veterinary and medical facilities further out.',
    afterwards:
      'A strong pipeline into research and doctoral study, alongside technology, healthcare, finance and the public sector.',
  },
  // ---------------------------------------------------------------------- Canada
  {
    name: 'University of Toronto', slug: 'university-of-toronto', countrySlug: 'canada',
    city: 'Toronto', institutionType: 'Public', founded: 1827, featured: true,
    character:
      'Canada’s largest and most research-intensive university, where insulin was isolated and where much of the foundational work in modern deep learning was done.',
    strengths: ['computer science and machine learning', 'medicine and life sciences', 'engineering', 'economics', 'law'],
    teaching:
      'Large first-year cohorts that narrow considerably in later years, with a collegiate structure at the downtown campus giving students a smaller community within a very large institution. Academically demanding, with a reputation for tough grading.',
    campus:
      'Three campuses: the historic downtown site in central Toronto, and two suburban campuses to the east and west with their own programmes and character.',
    afterwards:
      'Deep links into Toronto’s finance, technology, health and legal sectors, alongside one of the strongest routes into doctoral study in North America.',
    extraCampuses: [
      { name: 'St. George', city: 'Toronto', note: 'The original downtown campus, and the largest of the three.' },
      { name: 'Scarborough', city: 'Toronto', note: 'An eastern campus with a substantial co-operative education programme.' },
      { name: 'Mississauga', city: 'Mississauga', note: 'A western campus set on parkland along the Credit River.' },
    ],
  },
  {
    name: 'University of British Columbia', slug: 'university-of-british-columbia', countrySlug: 'canada',
    city: 'Vancouver', institutionType: 'Public', founded: 1908, featured: true,
    character:
      'UBC sits on a forested peninsula surrounded on three sides by ocean, and combines that setting with a serious research record in the environmental and life sciences.',
    strengths: ['forestry and environmental science', 'earth and ocean sciences', 'computer science', 'medicine', 'business'],
    teaching:
      'Research-led with strong undergraduate research opportunities, and a co-operative education programme across several faculties. Class sizes are large early on and shrink substantially in upper years.',
    campus:
      'The main campus is effectively its own town on Point Grey, with beaches, forest and a botanical garden within its boundaries, twenty-five minutes by bus from downtown Vancouver.',
    afterwards:
      'Graduates move into technology, environmental consulting, health, forestry and resource industries, and the campus has a well-developed start-up and research commercialisation programme.',
    extraCampuses: [{ name: 'Okanagan', city: 'Kelowna', note: 'A smaller interior campus with its own faculties and a more intimate scale.' }],
  },
  {
    name: 'McGill University', slug: 'mcgill-university', countrySlug: 'canada',
    city: 'Montreal', institutionType: 'Public', founded: 1821, featured: true,
    character:
      'An English-language university in a French-speaking city, with a long-standing reputation in medicine and one of the most international student bodies in Canada.',
    strengths: ['medicine and neuroscience', 'law', 'engineering', 'linguistics', 'management'],
    teaching:
      'Traditional and academically rigorous, with a strong research culture and teaching hospitals attached to the medical faculty. Teaching is in English throughout, though the city around it operates in French.',
    campus:
      'The main campus sits at the foot of Mount Royal in downtown Montreal, with a second agricultural and environmental campus outside the city.',
    afterwards:
      'Strong routes into medicine, law, research and international organisations, supported by an alumni network that is unusually global.',
    extraCampuses: [{ name: 'Macdonald', city: 'Sainte-Anne-de-Bellevue', note: 'The agricultural, food and environmental sciences campus west of the island.' }],
  },
  {
    name: 'University of Waterloo', slug: 'university-of-waterloo', countrySlug: 'canada',
    city: 'Waterloo', institutionType: 'Public', founded: 1957, featured: true,
    character:
      'Waterloo built itself around co-operative education, and runs one of the largest such programmes anywhere: students alternate study terms with paid work terms throughout the degree.',
    strengths: ['computer science', 'software and computer engineering', 'mathematics', 'quantum computing', 'actuarial science'],
    teaching:
      'The co-op rhythm shapes everything — a degree typically takes five years rather than four and includes up to two years of paid, relevant employment. Mathematics and computing are taught at unusual depth, and the university takes an unusually liberal position on student-owned intellectual property.',
    campus:
      'A modern, functional campus in a small city, purpose-built rather than historic, with a dense concentration of technology employers immediately around it.',
    afterwards:
      'Graduates are recruited heavily by North American technology companies, and many finish with several employers already on their record. The university has produced a notable number of founders.',
  },
  {
    name: 'University of Alberta', slug: 'university-of-alberta', countrySlug: 'canada',
    city: 'Edmonton', institutionType: 'Public', founded: 1908,
    character:
      'A large, research-intensive prairie university with particular depth in energy, engineering and the health sciences.',
    strengths: ['petroleum and chemical engineering', 'health sciences', 'agriculture', 'artificial intelligence', 'earth sciences'],
    teaching:
      'Research-led with substantial laboratory facilities, and a machine learning group with a long-standing international reputation in reinforcement learning.',
    campus:
      'A large campus close to the river valley, with extensive research facilities and a network of covered walkways that become very welcome in winter.',
    afterwards:
      'Close ties to the energy sector, health services and a growing artificial intelligence industry.',
  },
  // ------------------------------------------------------------------- Australia
  {
    name: 'University of Melbourne', slug: 'university-of-melbourne', countrySlug: 'australia',
    city: 'Melbourne', institutionType: 'Public', founded: 1853, featured: true,
    character:
      'Melbourne restructured its degrees around a distinctive model: broad undergraduate study followed by specialisation at graduate level, closer to the North American pattern than the Australian one.',
    strengths: ['medicine and biomedical sciences', 'law', 'education', 'engineering', 'the performing arts'],
    teaching:
      'Undergraduate degrees are deliberately broad, with professional specialisation — law, medicine, engineering, architecture — taken as a graduate degree afterwards. It is a genuine difference from most Australian universities and worth understanding before applying.',
    campus:
      'A single main campus in Parkville just north of the city centre, with lawns, historic buildings and a research and hospital precinct immediately adjacent.',
    afterwards:
      'Strong professional outcomes in medicine, law and engineering, and a substantial research and doctoral pipeline supported by the surrounding medical research precinct.',
  },
  {
    name: 'University of Sydney', slug: 'university-of-sydney', countrySlug: 'australia',
    city: 'Sydney', institutionType: 'Public', founded: 1850, featured: true,
    character:
      'Australia’s first university, with sandstone quadrangles that look transplanted from Oxford and a breadth of subjects to match its size.',
    strengths: ['medicine and health', 'engineering', 'law', 'architecture', 'the humanities'],
    teaching:
      'Broad and research-led, with a curriculum structure that requires students to take units outside their main discipline. Large cohorts in popular subjects, with substantial clinical and laboratory facilities.',
    campus:
      'A large campus in Camperdown and Darlington just west of the city centre, mixing gothic revival sandstone with modern research buildings, adjacent to a major teaching hospital.',
    afterwards:
      'Well-established routes into medicine, law, engineering and government, with an unusually large and active alumni network in Australian public life.',
  },
  {
    name: 'Australian National University', slug: 'australian-national-university', countrySlug: 'australia',
    city: 'Canberra', institutionType: 'Public', founded: 1946, featured: true,
    character:
      'Founded by federal legislation as a national research institution, ANU remains more research-weighted than any other Australian university and sits alongside the institutions of national government.',
    strengths: ['astronomy and astrophysics', 'public policy', 'international relations', 'earth sciences', 'philosophy'],
    teaching:
      'Small cohorts by Australian standards and an unusually high ratio of research staff to students, which makes undergraduate contact with active researchers routine. Particularly strong for students intending to continue into research.',
    campus:
      'A green, low-rise campus beside Lake Burley Griffin and adjacent to Parliament, the national library and the national archives — all of which are genuinely useful if you study policy or history.',
    afterwards:
      'A well-worn path into the public service, diplomacy, policy research and academia, helped enormously by being in the same city as the institutions that do the hiring.',
  },
  {
    name: 'University of Queensland', slug: 'university-of-queensland', countrySlug: 'australia',
    city: 'Brisbane', institutionType: 'Public', founded: 1909,
    character:
      'A large research university with a notable record in biotechnology and vaccine development, set on a river bend in subtropical Brisbane.',
    strengths: ['biotechnology and biomedical science', 'environmental science', 'engineering', 'agriculture', 'business'],
    teaching:
      'Research-intensive with strong laboratory provision and a well-developed undergraduate research programme. The biomedical and agricultural sciences are particularly well resourced.',
    campus:
      'The main St Lucia campus occupies a bend in the Brisbane River, reachable by ferry, with jacaranda-lined lawns and a large sandstone quadrangle.',
    afterwards:
      'Strong outcomes in health, biotechnology, resources and agriculture, with active commercialisation of university research.',
    extraCampuses: [{ name: 'St Lucia', city: 'Brisbane', note: 'The main riverside campus.' }, { name: 'Gatton', city: 'Gatton', note: 'The agricultural and veterinary campus west of the city.' }],
  },
  {
    name: 'Monash University', slug: 'monash-university', countrySlug: 'australia',
    city: 'Melbourne', institutionType: 'Public', founded: 1958,
    character:
      'Australia’s largest university by enrolment, and the most internationally distributed, with campuses on several continents.',
    strengths: ['pharmacy and pharmaceutical science', 'engineering', 'medicine', 'business', 'design'],
    teaching:
      'Large and professionally oriented, with pharmacy and pharmaceutical sciences particularly strong, and an international campus network that makes exchange straightforward.',
    campus:
      'Several campuses around Melbourne, with the main Clayton site to the south east housing engineering, science and a national synchrotron facility nearby.',
    afterwards:
      'Strong professional placement in pharmacy, engineering, health and business, supported by a large employer network across the Melbourne region.',
    extraCampuses: [{ name: 'Clayton', city: 'Melbourne', note: 'The largest campus, home to engineering, science and medicine.' }, { name: 'Caulfield', city: 'Melbourne', note: 'Business, design and information technology, closer to the city.' }],
  },
  // --------------------------------------------------------------------- Germany
  {
    name: 'Technical University of Munich', slug: 'technical-university-of-munich', countrySlug: 'germany',
    city: 'Munich', institutionType: 'Public', founded: 1868, featured: true,
    character:
      'TUM is Germany’s leading technical university and unusually entrepreneurial for a European public institution, with a deliberate programme of turning research into companies.',
    strengths: ['mechanical and electrical engineering', 'computer science', 'physics', 'aerospace', 'management for engineers'],
    teaching:
      'Rigorous and mathematically demanding, with a large number of English-taught master’s programmes in engineering and the sciences. Industrial project work and internships are built into many degrees.',
    campus:
      'Split across sites: the city centre campus, a large science and engineering campus at Garching north of Munich with its own research reactor, and a life sciences campus at Weihenstephan.',
    afterwards:
      'Very strong recruitment from German engineering and automotive industry, and one of the most active start-up pipelines of any European university.',
    extraCampuses: [
      { name: 'Garching', city: 'Garching', note: 'The main science and engineering research campus north of the city.' },
      { name: 'Weihenstephan', city: 'Freising', note: 'Life sciences, agriculture and food technology.' },
    ],
  },
  {
    name: 'Ludwig Maximilian University of Munich', slug: 'ludwig-maximilian-university-of-munich', countrySlug: 'germany',
    city: 'Munich', institutionType: 'Public', founded: 1472,
    character:
      'One of Germany’s oldest and largest universities, broad where its technical neighbour is focused, and historically central to German intellectual life.',
    strengths: ['physics', 'medicine', 'philosophy', 'law', 'economics'],
    teaching:
      'Traditional German university teaching — lecture-led with substantial independent work expected — across a very wide range of subjects, with a growing set of English-taught master’s programmes.',
    campus:
      'The main buildings sit along Ludwigstraße in central Munich, with the medical and science faculties on separate sites around the city.',
    afterwards:
      'A strong route into research and doctoral study, medicine, law and the public sector, with a long list of Nobel laureates among its past faculty.',
  },
  {
    name: 'Heidelberg University', slug: 'heidelberg-university', countrySlug: 'germany',
    city: 'Heidelberg', institutionType: 'Public', founded: 1386, featured: true,
    character:
      'Germany’s oldest university, in a small town it effectively defines, with international standing in the life sciences and the humanities alike.',
    strengths: ['medicine and molecular biology', 'physics and astronomy', 'philosophy', 'law', 'mathematics'],
    teaching:
      'Research-intensive, with a dense cluster of independent research institutes around the university that undergraduates and graduate students can genuinely access. Several English-taught master’s programmes in the sciences.',
    campus:
      'Two parts: the historic old town faculties among the medieval streets, and a modern science campus at Neuenheimer Feld across the river housing medicine and the natural sciences.',
    afterwards:
      'A particularly strong pipeline into research and doctoral study in the life sciences, supported by the surrounding institutes and a large university hospital.',
  },
  {
    name: 'RWTH Aachen University', slug: 'rwth-aachen-university', countrySlug: 'germany',
    city: 'Aachen', institutionType: 'Public', founded: 1870, featured: true,
    character:
      'The largest technical university in Germany, and among the most closely integrated with industry anywhere in Europe.',
    strengths: ['mechanical engineering', 'electrical engineering', 'computer science', 'materials science', 'automotive engineering'],
    teaching:
      'Demanding, quantitative and relentlessly practical, with industrial research partnerships woven into the curriculum and a large campus cluster shared with company research units.',
    campus:
      'Spread through and around a small border town, with a large modern research campus where university institutes and industrial partners sit side by side.',
    afterwards:
      'Extremely strong recruitment into German engineering and manufacturing, with many students hired directly from a thesis project done with an industrial partner.',
  },
  {
    name: 'Humboldt University of Berlin', slug: 'humboldt-university-of-berlin', countrySlug: 'germany',
    city: 'Berlin', institutionType: 'Public', founded: 1810,
    character:
      'The university whose founding model — uniting teaching with research — was copied across the world, and which remains central to the humanities in Germany.',
    strengths: ['philosophy', 'history', 'law', 'mathematics', 'the social sciences'],
    teaching:
      'Lecture and seminar based, with an emphasis on independent scholarship. Strongest for students drawn to the humanities and social sciences, with a growing set of English-taught graduate programmes.',
    campus:
      'The main building sits on Unter den Linden in central Berlin, with the natural sciences on a separate campus in Adlershof to the south east.',
    afterwards:
      'A traditional route into academia, publishing, policy, law and the cultural sector, in a city with an unusually large concentration of all four.',
  },
  // --------------------------------------------------------------------- Ireland
  {
    name: 'Trinity College Dublin', slug: 'trinity-college-dublin', countrySlug: 'ireland',
    city: 'Dublin', institutionType: 'Public', founded: 1592, featured: true,
    character:
      'Ireland’s oldest university, occupying a walled campus in the middle of Dublin, with a library holding the Book of Kells and a strong literary tradition.',
    strengths: ['literature and the humanities', 'computer science', 'immunology and medicine', 'law', 'business'],
    teaching:
      'Small cohorts by international standards, with substantial tutorial contact and a traditional emphasis on independent reading. Strong in both the humanities and the life sciences.',
    campus:
      'A single enclosed campus of cobbled squares and eighteenth-century buildings in the centre of Dublin, unusual in being genuinely self-contained in the middle of a capital city.',
    afterwards:
      'Graduates go into technology, pharmaceuticals, law, finance and the arts, with the concentration of multinational employers in Dublin making recruitment unusually accessible.',
  },
  {
    name: 'University College Dublin', slug: 'university-college-dublin', countrySlug: 'ireland',
    city: 'Dublin', institutionType: 'Public', founded: 1854, featured: true,
    character:
      'Ireland’s largest university, with the broadest subject range in the country and a modern parkland campus south of the city.',
    strengths: ['agriculture and food science', 'engineering', 'business', 'veterinary medicine', 'computer science'],
    teaching:
      'Modular and flexible, with a credit structure that allows unusual breadth in what students combine. Strong professional programmes in business, engineering and veterinary medicine.',
    campus:
      'A large green campus at Belfield, four kilometres from the city centre, with lakes, sports facilities and substantial on-campus accommodation.',
    afterwards:
      'Strong placement into technology, financial services, agri-food and engineering, with an active internship programme.',
  },
  {
    name: 'University of Galway', slug: 'university-of-galway', countrySlug: 'ireland',
    city: 'Galway', institutionType: 'Public', founded: 1845,
    character:
      'A university on the Atlantic coast with particular standing in medical technology, reflecting the substantial medical device industry that has grown up around it.',
    strengths: ['biomedical engineering and medical devices', 'marine science', 'medicine', 'Irish studies', 'informatics'],
    teaching:
      'Research-led with strong laboratory provision in the biomedical sciences, and close working relationships with the medical device manufacturers based in the region.',
    campus:
      'A compact riverside campus a short walk from the centre of a small, lively coastal city.',
    afterwards:
      'A well-defined route into the medical device and pharmaceutical industry concentrated in the west of Ireland.',
  },
  {
    name: 'University College Cork', slug: 'university-college-cork', countrySlug: 'ireland',
    city: 'Cork', institutionType: 'Public', founded: 1845,
    character:
      'A university built into a hillside above the River Lee, with strength in food science, pharmacy and microbiology.',
    strengths: ['food science and nutrition', 'pharmacy', 'microbiology', 'medicine', 'business information systems'],
    teaching:
      'Research-led with strong laboratory facilities, supported by a major food and microbiome research centre and close links to the pharmaceutical industry in the harbour area.',
    campus:
      'A wooded campus on the river close to the city centre, mixing nineteenth-century quadrangles with modern research buildings.',
    afterwards:
      'Strong recruitment into the pharmaceutical, food and technology sectors concentrated around Cork harbour.',
  },
  // ----------------------------------------------------------------- Netherlands
  {
    name: 'Delft University of Technology', slug: 'delft-university-of-technology', countrySlug: 'netherlands',
    city: 'Delft', institutionType: 'Public', founded: 1842, featured: true,
    character:
      'The largest and oldest technical university in the Netherlands, and the place where a country that reclaimed itself from the sea teaches civil and hydraulic engineering.',
    strengths: ['civil and hydraulic engineering', 'aerospace engineering', 'architecture', 'industrial design', 'computer science'],
    teaching:
      'Project-based and collaborative, with design and build work from early on. Almost all master’s programmes are taught in English, and student teams building solar cars, hyperloop pods and racing boats are a genuine part of the culture.',
    campus:
      'A dedicated campus south of the historic town centre, with large laboratories, wind tunnels and test facilities, and a famously grass-roofed library.',
    afterwards:
      'Graduates go into engineering consultancies, aerospace, water management and technology, with Dutch expertise in hydraulic engineering exported worldwide.',
  },
  {
    name: 'University of Amsterdam', slug: 'university-of-amsterdam', countrySlug: 'netherlands',
    city: 'Amsterdam', institutionType: 'Public', founded: 1632, featured: true,
    character:
      'The largest university in the Netherlands, spread through the city rather than gathered on a campus, with a very wide English-taught offering.',
    strengths: ['economics and econometrics', 'artificial intelligence', 'communication science', 'law', 'the humanities'],
    teaching:
      'Seminar-heavy with an emphasis on discussion and argument, and an unusually large number of English-taught programmes at both undergraduate and graduate level.',
    campus:
      'Four sites across Amsterdam, each with its own faculties — the humanities in the old centre, science on a purpose-built park to the east, and medicine to the south east.',
    afterwards:
      'Strong outcomes in economics, technology, media and international organisations, helped by Amsterdam’s concentration of multinational headquarters.',
  },
  {
    name: 'Utrecht University', slug: 'utrecht-university', countrySlug: 'netherlands',
    city: 'Utrecht', institutionType: 'Public', founded: 1636,
    character:
      'A broad research university at the centre of the country, known for a distinctive educational model that gives students substantial control over their own programme.',
    strengths: ['life sciences', 'veterinary medicine', 'geosciences', 'the humanities', 'sustainability'],
    teaching:
      'Small-scale and student-directed, with a course structure that allows considerable choice and an emphasis on active rather than passive learning.',
    campus:
      'Mostly concentrated on the Utrecht Science Park east of the city, with the humanities remaining in historic buildings in the old centre.',
    afterwards:
      'A strong research pipeline, particularly in the life sciences and sustainability, alongside routes into policy and consultancy.',
  },
  {
    name: 'Eindhoven University of Technology', slug: 'eindhoven-university-of-technology', countrySlug: 'netherlands',
    city: 'Eindhoven', institutionType: 'Public', founded: 1956, featured: true,
    character:
      'A technical university at the centre of the Dutch technology industry, with an unusually close working relationship with the companies around it.',
    strengths: ['electrical engineering', 'industrial design', 'applied physics', 'computer science', 'biomedical engineering'],
    teaching:
      'Challenge-based learning is the institutional model: students work on real problems posed by industry partners, in teams, from early in the degree. Master’s programmes are taught in English.',
    campus:
      'A compact modern campus next to the city centre, adjacent to the technology cluster that supplies many of its research partnerships.',
    afterwards:
      'Very high placement into the semiconductor, high-tech systems and design industries concentrated in the region.',
  },
  {
    name: 'University of Groningen', slug: 'university-of-groningen', countrySlug: 'netherlands',
    city: 'Groningen', institutionType: 'Public', founded: 1614,
    character:
      'One of the oldest universities in the Netherlands, dominating a northern city with the youngest population in the country.',
    strengths: ['energy and sustainability', 'astronomy', 'economics and business', 'medicine', 'the social sciences'],
    teaching:
      'A very wide English-taught offering including many undergraduate degrees, taught in small groups with a strong international student presence.',
    campus:
      'Faculties spread through the compact city centre, with the medical and science faculties on larger sites nearby. Nearly everyone cycles.',
    afterwards:
      'Strong research outcomes particularly in energy and astronomy, and a notably international graduate destination profile.',
  },
  {
    name: 'Erasmus University Rotterdam', slug: 'erasmus-university-rotterdam', countrySlug: 'netherlands',
    city: 'Rotterdam', institutionType: 'Public', founded: 1913,
    character:
      'Built out of a business school founded by the city’s merchants, and still strongest where commerce, economics and public health meet.',
    strengths: ['economics and econometrics', 'management', 'public health', 'medicine', 'public administration'],
    teaching:
      'Quantitative and applied, with a business school of long standing and a large academic medical centre attached.',
    campus:
      'A modern campus at Woudestein east of the city centre, with the medical faculty on a separate site beside the teaching hospital.',
    afterwards:
      'Strong recruitment into consulting, finance, logistics and healthcare management, supported by Rotterdam’s port economy.',
  },
  // ------------------------------------------------------------------- Singapore
  {
    name: 'National University of Singapore', slug: 'national-university-of-singapore', countrySlug: 'singapore',
    city: 'Singapore', institutionType: 'Public', founded: 1905, featured: true,
    character:
      'Singapore’s oldest and largest university, and the anchor of a higher education system built deliberately to compete internationally.',
    strengths: ['engineering', 'computer science', 'business', 'medicine', 'architecture and urban planning'],
    teaching:
      'Demanding, with continuous assessment throughout and a strong quantitative emphasis. A large exchange and overseas programme sends substantial numbers of students abroad during the degree.',
    campus:
      'A large campus at Kent Ridge in the south west of the island, organised into residential colleges, with a separate medical campus and a business school adjoining.',
    afterwards:
      'Graduates move into technology, finance, government and research across the region, with recruitment drawing heavily on Singapore’s role as a regional headquarters location.',
  },
  {
    name: 'Nanyang Technological University', slug: 'nanyang-technological-university', countrySlug: 'singapore',
    city: 'Singapore', institutionType: 'Public', founded: 1981, featured: true,
    character:
      'A young technical university that has built an international research reputation quickly, with a campus known for its architecture.',
    strengths: ['materials science', 'electrical and electronic engineering', 'computer science', 'business', 'communication studies'],
    teaching:
      'Engineering and technology focused, with substantial laboratory work, industrial attachment and a strong research culture for a university of its age.',
    campus:
      'A large green campus in the west of the island, including a striking terraced learning building and extensive residential halls.',
    afterwards:
      'Strong placement into engineering, semiconductors, technology and financial services across Southeast Asia.',
  },
  {
    name: 'Singapore Management University', slug: 'singapore-management-university', countrySlug: 'singapore',
    city: 'Singapore', institutionType: 'Public', founded: 2000,
    character:
      'A city-centre university built on a seminar-based American model, focused on business, economics, law, computing and the social sciences.',
    strengths: ['business and accountancy', 'economics', 'law', 'information systems', 'social sciences'],
    teaching:
      'Small seminar classes with graded participation rather than large lectures, which is a real adjustment for students used to sitting quietly, and a deliberate emphasis on presentation and argument.',
    campus:
      'An urban campus in the middle of the city, integrated into the surrounding streets and connected underground to the rail network.',
    afterwards:
      'Strong recruitment into banking, consulting, accountancy and law, helped by being physically in the business district.',
  },
  // ----------------------------------------------------------------------- India
  {
    name: 'Indian Institute of Technology Bombay', slug: 'indian-institute-of-technology-bombay', countrySlug: 'india',
    city: 'Mumbai', institutionType: 'Public', founded: 1958, featured: true,
    character:
      'One of India’s institutes of national importance, and among the most selective engineering schools in the world by admission ratio.',
    strengths: ['computer science and engineering', 'electrical engineering', 'mechanical engineering', 'aerospace', 'design'],
    teaching:
      'Rigorous and quantitative, taught in English, with substantial laboratory and project work and a strong culture of student-led technical teams.',
    campus:
      'A large wooded residential campus at Powai in north east Mumbai, beside a lake, with almost all students living on site.',
    afterwards:
      'Graduates are recruited heavily by technology companies in India and abroad, and the institute has produced a large number of founders.',
  },
  {
    name: 'Indian Institute of Technology Delhi', slug: 'indian-institute-of-technology-delhi', countrySlug: 'india',
    city: 'New Delhi', institutionType: 'Public', founded: 1961, featured: true,
    character:
      'A national institute of technology in the capital, with strong research output and close proximity to government and industry.',
    strengths: ['computer science', 'electrical engineering', 'textile technology', 'applied mechanics', 'management studies'],
    teaching:
      'English-medium, demanding and research-oriented, with laboratory and project work throughout and a well-developed innovation and incubation programme.',
    campus:
      'A green residential campus in south Delhi at Hauz Khas, self-contained and close to the city’s metro network.',
    afterwards:
      'Strong placement into technology, consulting, core engineering and research, with an active start-up pipeline.',
  },
  {
    name: 'Indian Institute of Technology Madras', slug: 'indian-institute-of-technology-madras', countrySlug: 'india',
    city: 'Chennai', institutionType: 'Public', founded: 1959, featured: true,
    character:
      'A national institute set inside a protected forest in the middle of Chennai, with a long record in industrial research collaboration.',
    strengths: ['mechanical engineering', 'ocean engineering', 'computer science', 'aerospace', 'biotechnology'],
    teaching:
      'Rigorous and English-medium, with a research park adjoining the campus that makes industrial collaboration part of ordinary academic life.',
    campus:
      'A large residential campus within a wooded reserve, with deer and blackbuck genuinely wandering between the departments.',
    afterwards:
      'Strong recruitment into core engineering, technology and research, with a notably active technology transfer and incubation programme.',
  },
  {
    name: 'Indian Institute of Science', slug: 'indian-institute-of-science', countrySlug: 'india',
    city: 'Bengaluru', institutionType: 'Public', founded: 1909, featured: true,
    character:
      'India’s foremost institution for scientific research, weighted far more towards graduate study and research than towards undergraduate teaching.',
    strengths: ['physics', 'materials science', 'computer science and automation', 'aerospace engineering', 'molecular biophysics'],
    teaching:
      'Predominantly a research institute: most students are working towards a master’s or doctorate, and the undergraduate programme is small, selective and research-oriented from the start.',
    campus:
      'A large, densely wooded campus in north Bengaluru, established more than a century ago and still one of the greenest places in the city.',
    afterwards:
      'The principal route into scientific research careers in India, with graduates moving into academia, national laboratories and research-intensive industry.',
  },
  {
    name: 'University of Delhi', slug: 'university-of-delhi', countrySlug: 'india',
    city: 'New Delhi', institutionType: 'Public', founded: 1922,
    character:
      'A very large central university made up of dozens of affiliated colleges spread across the capital, and a central institution in Indian public life.',
    strengths: ['economics', 'political science', 'english literature', 'commerce', 'the sciences'],
    teaching:
      'Teaching happens largely in the colleges rather than centrally, so the experience varies considerably between them. Strong in the humanities, social sciences and commerce, with a famously active campus political culture.',
    campus:
      'Two main clusters — the north campus around the original university buildings and the south campus — with colleges distributed across the city beyond them.',
    afterwards:
      'A traditional route into the civil services, journalism, law, academia and the corporate sector, with an exceptionally large alumni network in Indian public life.',
  },
  {
    name: 'Jawaharlal Nehru University', slug: 'jawaharlal-nehru-university', countrySlug: 'india',
    city: 'New Delhi', institutionType: 'Public', founded: 1969,
    character:
      'A research-weighted central university known for the social sciences, international studies and languages, and for an unusually engaged intellectual culture.',
    strengths: ['international relations', 'sociology', 'economics', 'languages and linguistics', 'historical studies'],
    teaching:
      'Seminar-based and discussion-heavy, weighted towards graduate and doctoral study, with a long tradition of argument as a normal part of academic life.',
    campus:
      'A large wooded residential campus in south Delhi, spread across rocky terrain with hostels, libraries and centres distributed through it.',
    afterwards:
      'A strong route into academia, research, the diplomatic and civil services, journalism and policy institutions.',
  },
  {
    name: 'Manipal Academy of Higher Education', slug: 'manipal-academy-of-higher-education', countrySlug: 'india',
    city: 'Manipal', institutionType: 'Private', founded: 1953,
    character:
      'A large private deemed university built around health sciences, which grew from a single medical college into a full university town.',
    strengths: ['medicine and dentistry', 'pharmacy', 'allied health sciences', 'engineering', 'communication'],
    teaching:
      'Professionally oriented with substantial clinical and laboratory training, and a large international student body particularly in the health science programmes.',
    campus:
      'A self-contained campus town, with teaching hospitals, residences and facilities that effectively constitute a small city built around the university.',
    afterwards:
      'A well-established route into clinical practice, pharmacy and allied health, with a large professional alumni network in healthcare.',
  },
];

export const UNIVERSITIES: UniversityFacts[] = [...BASE_UNIVERSITIES, ...MORE_UNIVERSITIES];
