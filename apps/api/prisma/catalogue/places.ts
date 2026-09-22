import { html, slugify } from './content';
import { MORE_CITIES } from './places-more';

export type CityFacts = {
  name: string;
  /** Parent state/province/region name, or null for a city-state. */
  state: string | null;
  /** What this city is, in one sentence. */
  blurb: string;
  /** What studying here is actually like. */
  studying: string;
  /** Cost and character of living here. */
  living: string;
  /** Getting around, and getting out. */
  moving: string;
  featured?: boolean;
};

const BASE_CITIES: Record<string, CityFacts[]> = {
  'united-kingdom': [
    {
      name: 'Oxford',
      state: 'England',
      blurb:
        'A small city almost entirely defined by the university that has occupied its centre since the eleventh century.',
      studying:
        'Life runs on the collegiate model: students belong to a college with its own hall, library and accommodation as much as to the university, and teaching happens in weekly tutorials rather than large lectures.',
      living:
        'Expensive for its size, because demand for housing far exceeds a small city’s supply. College accommodation is substantially cheaper than the private market and is the normal arrangement.',
      moving:
        'Walkable and heavily cycled end to end. London is an hour away by coach or train, which runs through the night during term.',
    },
    {
      name: 'Cambridge',
      state: 'England',
      blurb:
        'A compact university city on the Cam, ringed by a technology and biotechnology cluster that grew up directly out of the university.',
      studying:
        'Collegiate and supervision-based, like Oxford, with a historic weighting towards mathematics and the sciences that still shapes the teaching.',
      living:
        'Costs are high relative to the city’s size, driven by the same housing pressure. College rooms are the cheapest and most common option.',
      moving:
        'Small enough to cycle everywhere, and most people do. London is under an hour by train, and Stansted airport is close.',
    },
    {
      name: 'London',
      state: 'England',
      blurb:
        'London holds more universities than any other city in the country, and the widest range of everything else along with them.',
      studying:
        'The concentration is the point: specialist institutions for medicine, law, economics, art and music sit within a few miles of large multi-faculty universities, and it is normal to attend a lecture, a gallery opening and an industry meetup in the same week. The trade-off is that campuses are scattered across the city rather than gathered on one site, so the student experience is more dispersed than in a traditional university town.',
      living:
        'London is the most expensive place to live in the United Kingdom by a wide margin, and rent is where almost all of that difference sits. University halls are the cheapest reliable option and are worth applying for the moment you are allowed. Living further out along a good transport line is the compromise most students end up making.',
      moving:
        'The Underground, buses and rail cover the city thoroughly, and a student travel discount pays for itself quickly. Three of the country’s largest airports serve the city, and most of Europe is a short flight away.',
      featured: true,
    },
    {
      name: 'Manchester',
      state: 'England',
      blurb:
        'Manchester has one of the largest student populations in Europe and a reputation for music, football and a certain directness.',
      studying:
        'The universities sit along a single corridor south of the city centre, which gives Manchester something London does not have: an actual student quarter you can walk. Strong in engineering, computing, medicine and the social sciences, with research activity that draws a steady flow of industry.',
      living:
        'Substantially cheaper than London for both rent and daily costs, while still being a large city with everything a large city has. Shared houses in the student areas south of the centre are the standard arrangement after first year.',
      moving:
        'Trams, buses and a walkable centre. Fast trains to London, Liverpool and Leeds, and an international airport directly connected to the city.',
      featured: true,
    },
    {
      name: 'Birmingham',
      state: 'England',
      blurb:
        'The second largest city in the United Kingdom, central enough to reach most of the country in under two hours.',
      studying:
        'A broad mix of institutions covering engineering, business, medicine and the arts, with a large and notably diverse student population. The main campuses are close to the centre and easy to move between.',
      living:
        'Among the more affordable major English cities, with a good supply of student housing and a lower base cost than the south of the country.',
      moving:
        'Sits at the centre of the national rail network, which makes it a practical base for exploring. Buses and trams cover the city, and the airport is close.',
    },
    {
      name: 'Edinburgh',
      state: 'Scotland',
      blurb:
        'A compact, striking capital built on volcanic rock, with a university older than most countries.',
      studying:
        'The Scottish system has its own traditions, including a four-year undergraduate degree with a broader first two years than the English equivalent. Strength in medicine, informatics, philosophy and the humanities, with the university woven into the fabric of the old city rather than set apart from it.',
      living:
        'More expensive than most Scottish cities and cheaper than London. Rents rise sharply around the festival in August, which is worth knowing before signing anything short-term.',
      moving:
        'Almost everything is walkable, with trams and buses for the rest. Trains south to England and north into the Highlands, and an airport twenty minutes from the centre.',
      featured: true,
    },
    {
      name: 'Glasgow',
      state: 'Scotland',
      blurb:
        'Scotland’s largest city — industrial in origin, and now known for music, art and a famously welcoming temperament.',
      studying:
        'Three universities with real range between them, covering engineering, medicine, art and business. Campuses are close to the centre, and the student presence in the west end is unmistakable.',
      living:
        'Noticeably cheaper than Edinburgh for rent and going out, with a large supply of tenement flats that most students end up sharing.',
      moving:
        'A subway, extensive buses and suburban rail. Well placed for reaching the west coast and the islands.',
    },
    {
      name: 'Leeds',
      state: 'England',
      blurb:
        'A northern city with a large student population, a strong financial sector and a compact centre.',
      studying:
        'Universities close to the city centre covering business, engineering, medicine and the creative arts, with a student district within walking distance of teaching.',
      living:
        'Affordable by national standards, with plentiful shared housing in the areas immediately north of the universities.',
      moving:
        'Walkable centre, good bus coverage, and direct trains to Manchester, York and London. The Yorkshire Dales are close enough for a day out.',
    },
    {
      name: 'Bristol',
      state: 'England',
      blurb:
        'A harbour city in the south west with an independent streak and a strong aerospace and creative sector.',
      studying:
        'Two universities with distinct characters — one traditional and research-led, one applied and industry-connected — covering engineering, computing, health and the arts.',
      living:
        'More expensive than the north of England but below London. Housing is in demand, so early applications to halls matter.',
      moving:
        'Hilly and walkable, with buses and a growing cycle network. Fast trains to London and easy reach of Wales and the south west coast.',
    },
  ],
  canada: [
    {
      name: 'Edmonton',
      state: 'Alberta',
      blurb:
        'Alberta’s capital, built along the largest stretch of urban parkland in North America.',
      studying:
        'A large research university anchors the city, with particular depth in engineering, health sciences and artificial intelligence research.',
      living:
        'Affordable by Canadian standards, with lower rents than Calgary and no provincial sales tax to erode a part-time wage.',
      moving:
        'Light rail and buses, plus a network of covered walkways downtown that matter a great deal in a long, cold winter.',
    },
    {
      name: 'Toronto',
      state: 'Ontario',
      blurb:
        'Canada’s largest city, and one of the most genuinely multicultural places in the world.',
      studying:
        'The densest concentration of institutions in the country, covering everything from research-intensive universities to applied colleges. Finance, technology, health sciences and the creative industries all have a substantial presence, and internships and co-op placements are correspondingly easier to find.',
      living:
        'Expensive — the highest rents in the country alongside Vancouver. Living outside the core and commuting in is the usual answer, and the regional rail network makes that workable.',
      moving:
        'A subway, streetcars and buses in the city, with regional rail reaching well beyond it. Winters are genuinely cold and worth budgeting proper clothing for.',
      featured: true,
    },
    {
      name: 'Vancouver',
      state: 'British Columbia',
      blurb:
        'Mountains on one side, ocean on the other, and the mildest winters in Canada.',
      studying:
        'Strong in environmental and earth sciences, forestry, computing and film. Campuses are set away from the downtown core in green settings, which changes the rhythm of student life considerably.',
      living:
        'Among the most expensive housing markets in North America. Student accommodation is heavily oversubscribed, and applying the moment an offer arrives is not optional advice here.',
      moving:
        'A driverless rapid transit system, buses and a passenger ferry. Skiing is under an hour away, and it rains a great deal from autumn to spring.',
      featured: true,
    },
    {
      name: 'Montreal',
      state: 'Quebec',
      blurb:
        'A bilingual city with a European feel and, by some distance, the lowest living costs of Canada’s three largest cities.',
      studying:
        'Two major English-language universities and two French-language ones, giving the city an unusually large student population for its size. Strong in artificial intelligence, aerospace, medicine and the arts.',
      living:
        'Markedly cheaper than Toronto or Vancouver — the single biggest cost advantage available to a student in urban Canada. Apartments are larger and rents lower.',
      moving:
        'A well-run metro and extensive buses. French is the working language of the city; you can study and live in English, but some French makes daily life considerably easier.',
      featured: true,
    },
    {
      name: 'Ottawa',
      state: 'Ontario',
      blurb:
        'The national capital — bilingual, green, and quieter than its size suggests.',
      studying:
        'Universities with particular strength in public policy, international affairs, engineering and computing, benefiting from proximity to government and to a cluster of technology employers.',
      living:
        'More affordable than Toronto with a good supply of student housing. Winters are among the coldest of any capital city.',
      moving:
        'Light rail and buses, and an unusually good network of paths for cycling and skating. Montreal is two hours away by train.',
    },
    {
      name: 'Calgary',
      state: 'Alberta',
      blurb:
        'A prairie city at the foot of the Rockies, built around energy and increasingly around technology.',
      studying:
        'Strength in engineering, geoscience, business and health, with strong links into the energy sector and a growing technology scene.',
      living:
        'Living costs are moderate by Canadian standards, and Alberta’s tax position leaves more of a part-time wage in hand than most provinces.',
      moving:
        'A light rail system and buses. The mountains are ninety minutes west, which shapes what a great many students do with their weekends.',
    },
    {
      name: 'Waterloo',
      state: 'Ontario',
      blurb:
        'A small city with an outsized influence on Canadian technology, built around co-operative education.',
      studying:
        'The co-op model is the reason to come here: alternating study and paid work terms is the norm rather than the exception, and graduates typically leave with substantial professional experience. Computing, engineering and mathematics are the strongest areas.',
      living:
        'Much cheaper than Toronto, with student housing built around the campuses. The city is small, and life revolves around the universities.',
      moving:
        'Light rail connects the main corridor, and Toronto is a little over an hour away.',
    },
  ],
  australia: [
    {
      name: 'Sydney',
      state: 'New South Wales',
      blurb:
        'Australia’s largest city, built around one of the world’s great harbours.',
      studying:
        'The widest choice of institutions in the country, with strength across business, medicine, engineering, law and the creative arts, and the deepest graduate job market to go with it.',
      living:
        'The most expensive city in Australia. Rent is the dominant cost, and most students share. Living along a train line further from the harbour is the standard compromise.',
      moving:
        'Trains, buses, light rail and ferries, with a single travel card covering all of them. Beaches are reachable by public transport, which is a genuine part of life here.',
      featured: true,
    },
    {
      name: 'Melbourne',
      state: 'Victoria',
      blurb:
        'Australia’s cultural centre — coffee, laneways, live music and an ordered grid of a city.',
      studying:
        'A dense concentration of universities close to the centre, strong across medicine, law, business, engineering and the arts. The student presence in the inner suburbs is substantial and visible.',
      living:
        'Expensive, though generally a little less so than Sydney, with a good supply of inner-suburb share housing. The weather changes abruptly and often.',
      moving:
        'An extensive tram network — the largest in the world — plus trains and buses. The centre is walkable and the inner suburbs are well connected.',
      featured: true,
    },
    {
      name: 'Brisbane',
      state: 'Queensland',
      blurb:
        'A subtropical river city, warmer and more relaxed than the southern capitals.',
      studying:
        'Strong in health sciences, engineering, environmental science and business, with campuses along the river and a large student population.',
      living:
        'Cheaper than Sydney and Melbourne for both rent and daily costs, with a milder winter that removes a real expense.',
      moving:
        'Trains, buses and river ferries. The coast is an hour in either direction, and the climate makes outdoor life year-round.',
    },
    {
      name: 'Perth',
      state: 'Western Australia',
      blurb:
        'Isolated, sunny, and closer to Southeast Asia than to Australia’s east coast.',
      studying:
        'Particular strength in mining, geoscience, marine science and engineering, reflecting the state’s resources industry. Campuses are spacious and close to the river or the coast.',
      living:
        'Moderate costs by Australian standards, with more space for the money than the eastern cities.',
      moving:
        'Trains and buses covering a spread-out city. The isolation is real — the nearest major city is a long flight — but the beaches are among the best in the country.',
    },
    {
      name: 'Adelaide',
      state: 'South Australia',
      blurb:
        'A planned city ringed by parkland, and the most affordable of Australia’s major student cities.',
      studying:
        'Universities concentrated close to the centre, with strength in health, wine science, engineering and defence-related research.',
      living:
        'The lowest living costs of the mainland capitals, with a compact centre that makes car ownership unnecessary.',
      moving:
        'Trams, trains and buses across a small, flat, easily navigated city. Wine regions and beaches are both close.',
    },
    {
      name: 'Canberra',
      state: 'Australian Capital Territory',
      blurb:
        'The purpose-built national capital — small, green, and organised around its universities and institutions.',
      studying:
        'Strong in public policy, international relations, law, science and research, with unusual access to national institutions, archives and government.',
      living:
        'Costs are moderate, though the rental market is tight because the city is small. Winters are cold by Australian standards.',
      moving:
        'Light rail and buses, and a city designed around driving and cycling. Sydney is three hours away by road.',
    },
  ],
  germany: [
    {
      name: 'Berlin',
      state: 'Berlin',
      blurb:
        'The capital — large, international, and still cheaper than most western European capitals.',
      studying:
        'Several major universities and a large number of English-taught master’s programmes, with strength across the sciences, humanities, computing and the arts. The student population is enormous and highly international.',
      living:
        'Costs have risen sharply but remain below Munich, Hamburg and most comparable capitals. Finding a flat is competitive and takes persistence; start before you arrive.',
      moving:
        'An excellent network of underground, suburban rail, trams and buses running very late. The city is flat and heavily cycled.',
      featured: true,
    },
    {
      name: 'Munich',
      state: 'Bavaria',
      blurb:
        'Prosperous, orderly, and at the centre of German engineering and industry.',
      studying:
        'Two of the country’s strongest universities sit here, with particular depth in engineering, physics, computing and medicine, and close ties to the manufacturing and technology companies headquartered nearby.',
      living:
        'The most expensive city in Germany, with a difficult housing market. Student residences are much cheaper than the private market and heavily oversubscribed.',
      moving:
        'A comprehensive underground, suburban rail and tram network. The Alps are an hour south, which most students discover quickly.',
      featured: true,
    },
    {
      name: 'Heidelberg',
      state: 'Baden-Württemberg',
      blurb:
        'A small riverside town dominated by Germany’s oldest university and the castle above it.',
      studying:
        'Research-intensive, with international standing in medicine, the life sciences, physics and the humanities, and a cluster of research institutes nearby.',
      living:
        'Housing is limited because the town is small and the university large, so apply for a residence place early. Day-to-day costs are moderate.',
      moving:
        'Walkable and cycleable end to end, with buses and trams. Frankfurt and its airport are under an hour away.',
    },
    {
      name: 'Aachen',
      state: 'North Rhine-Westphalia',
      blurb:
        'A border town where Germany, Belgium and the Netherlands meet, built around a technical university.',
      studying:
        'One of Europe’s leading technical institutions, with very strong mechanical, electrical and computer engineering and deep industrial research partnerships.',
      living:
        'Affordable, with a cost of living well below the big cities and a compact centre where most things are close.',
      moving:
        'Small enough to cycle across. Cologne is under an hour by train, and Brussels and Amsterdam are both reachable in an afternoon.',
    },
    {
      name: 'Hamburg',
      state: 'Hamburg',
      blurb:
        'A large northern port city, with more bridges than Venice and a maritime character throughout.',
      studying:
        'A broad university plus specialist institutions, with strength in logistics, law, economics, medicine and media — the last reflecting the city’s role as a publishing centre.',
      living:
        'Expensive by German standards though below Munich, with a competitive rental market.',
      moving:
        'Suburban and underground rail, buses and harbour ferries that count as public transport. Flat, green, and heavily cycled.',
    },
    {
      name: 'Stuttgart',
      state: 'Baden-Württemberg',
      blurb:
        'Set in a valley among vineyards, and the centre of the German automotive industry.',
      studying:
        'Engineering above all — automotive, mechanical, aerospace and production — with research closely tied to the manufacturers based in and around the city.',
      living:
        'Costs are on the higher side for Germany, reflecting local prosperity, though below Munich.',
      moving:
        'Suburban rail, underground and buses across a hilly city, with funicular lines where the gradient demands it.',
    },
  ],
  ireland: [
    {
      name: 'Dublin',
      state: 'Leinster',
      blurb:
        'The capital, and the European base for a remarkable concentration of global technology and pharmaceutical companies.',
      studying:
        'Several universities within or close to the city, strong in computing, business, medicine, pharmaceutical science and literature. The proximity of major employers makes internships and graduate recruitment unusually accessible.',
      living:
        'Expensive, and accommodation is the genuine difficulty — Dublin has a well-documented housing shortage and rents among the highest in Europe. Secure a place before you travel if there is any way to do so.',
      moving:
        'Buses, trams and a coastal rail line, in a centre small enough to walk across in half an hour. The airport is close and well connected.',
      featured: true,
    },
    {
      name: 'Cork',
      state: 'Munster',
      blurb:
        'Ireland’s second city — smaller, cheaper, and locally regarded as the real capital.',
      studying:
        'A substantial university and an institute of technology, with strength in pharmaceutical science, food science, medicine and business, supported by a large pharmaceutical and technology presence in the harbour area.',
      living:
        'Considerably more affordable than Dublin for rent, and small enough that most students live within walking distance of campus.',
      moving:
        'Walkable and well served by buses, with rail to Dublin in under three hours. The west Cork coast is close.',
    },
    {
      name: 'Galway',
      state: 'Connacht',
      blurb:
        'A small coastal city on the west coast, known for music, festivals and a young population.',
      studying:
        'Strong in medical technology and biomedical science, reflecting a substantial local medical device industry, alongside arts and marine science.',
      living:
        'Cheaper than Dublin though not cheap, with a compact centre and a student population large relative to the city’s size.',
      moving:
        'Walkable and cycleable. The gateway to Connemara and the Atlantic coast, which is much of the appeal.',
    },
    {
      name: 'Limerick',
      state: 'Munster',
      blurb:
        'A compact city on the Shannon, with a university known for its co-operative education programme.',
      studying:
        'Work placements are built into many degrees here, giving graduates real experience before they finish. Strong in engineering, business, computing and sport science.',
      living:
        'Among the more affordable university cities in Ireland, with a self-contained campus a short distance from the centre.',
      moving:
        'Buses and a walkable centre, with rail connections to Dublin, Cork and Galway.',
    },
  ],
  netherlands: [
    {
      name: 'Amsterdam',
      state: 'North Holland',
      blurb:
        'Canals, bicycles, and the most international city in the Netherlands.',
      studying:
        'Two large universities with very wide English-taught provision, covering economics, social sciences, computing, law and the humanities, plus specialist institutions in the arts.',
      living:
        'The most expensive city in the country, and student housing is genuinely scarce. Begin looking the day your offer arrives; many students end up commuting from nearby towns.',
      moving:
        'Trams, metro, buses and ferries, but the bicycle is what the city is actually built around. Schiphol is twenty minutes from the centre by train.',
      featured: true,
    },
    {
      name: 'Delft',
      state: 'South Holland',
      blurb:
        'A small historic town that revolves almost entirely around its technical university.',
      studying:
        'One of Europe’s leading technical universities, with international standing in civil and hydraulic engineering, aerospace, architecture, industrial design and computing.',
      living:
        'Cheaper than Amsterdam, though housing is tight because the town is small and the student body is large.',
      moving:
        'Small enough to cycle everywhere. The Hague is ten minutes by train and Rotterdam fifteen, which effectively gives you three cities.',
      featured: true,
    },
    {
      name: 'Utrecht',
      state: 'Utrecht',
      blurb:
        'A medieval centre with canal-level wharves, in the geographic middle of the country.',
      studying:
        'A large research university with strength in life sciences, veterinary medicine, the humanities and the social sciences, plus a substantial university of applied sciences.',
      living:
        'Expensive and with a tight housing market, though slightly less pressured than Amsterdam.',
      moving:
        'The central rail hub of the Netherlands — almost anywhere in the country is within an hour. Compact and heavily cycled.',
    },
    {
      name: 'Eindhoven',
      state: 'North Brabant',
      blurb:
        'The technology and design centre of the Netherlands, rebuilt after the war around its industry.',
      studying:
        'Engineering, computing and industrial design, with unusually close ties between the university and the surrounding technology cluster — collaborative projects with industry are routine rather than exceptional.',
      living:
        'More affordable than the western cities, with modern housing and a compact, low-rise layout.',
      moving:
        'Cycling and buses cover a flat, spread-out city. Trains reach Amsterdam in under an hour and a half.',
    },
    {
      name: 'Groningen',
      state: 'Groningen',
      blurb:
        'The northern student city, with the youngest average population in the Netherlands.',
      studying:
        'A large research university and a university of applied sciences dominate the town, with strength in the sciences, medicine, economics and energy research.',
      living:
        'The lowest living costs of the major Dutch student cities, and the easiest housing market of them.',
      moving:
        'Overwhelmingly cycled — the centre is largely closed to through traffic. Two hours by train from Amsterdam.',
    },
    {
      name: 'Rotterdam',
      state: 'South Holland',
      blurb:
        'Europe’s largest port, rebuilt in modern architecture after the war and unlike anywhere else in the country.',
      studying:
        'Strength in economics, business, management and medicine, alongside architecture and logistics — the last shaped directly by the port.',
      living:
        'Cheaper than Amsterdam with a better housing supply, and a working, unpretentious character that many students prefer.',
      moving:
        'Metro, trams, buses and water taxis. The Hague is twenty minutes away and Amsterdam around forty.',
    },
  ],
  singapore: [
    {
      name: 'Singapore',
      state: null,
      blurb:
        'A city-state at the crossroads of Southeast Asia, dense, green and precisely organised.',
      studying:
        'A small number of very strong universities spread across the island, with depth in engineering, computing, business, medicine and urban planning, and close connections to the companies that use Singapore as a regional base.',
      living:
        'Costs are high by regional standards, with accommodation the largest single component. University halls are markedly cheaper than the private market and worth prioritising.',
      moving:
        'A rail network that reaches nearly everywhere on the island, supplemented by buses. English is the working language, the climate is hot and humid year-round, and much of Southeast Asia is within a short flight.',
      featured: true,
    },
  ],
  india: [
    {
      name: 'New Delhi',
      state: 'Delhi',
      blurb:
        'The national capital, and home to a dense cluster of central universities and national institutes.',
      studying:
        'A very large concentration of institutions covering the humanities, social sciences, engineering, medicine and law, several of them among the country’s most competitive.',
      living:
        'Costs vary enormously by neighbourhood. University hostels are by far the cheapest option and are usually allocated on academic criteria.',
      moving:
        'An extensive metro network covers the city and much of the surrounding region. Summers are very hot and winters bring poor air quality.',
      featured: true,
    },
    {
      name: 'Mumbai',
      state: 'Maharashtra',
      blurb:
        'India’s financial centre and its largest city, built along a narrow strip of coast.',
      studying:
        'Strong in commerce, finance, management, technology and the media industries, with several long-established institutions and a major technical institute.',
      living:
        'The most expensive city in India for accommodation by a wide margin, with space at a genuine premium. Hostel accommodation makes a very large difference.',
      moving:
        'Suburban rail and a growing metro carry enormous numbers daily. The monsoon between June and September is a defining feature of the year.',
      featured: true,
    },
    {
      name: 'Bengaluru',
      state: 'Karnataka',
      blurb:
        'India’s technology capital, on a plateau with the mildest climate of the major cities.',
      studying:
        'The centre of Indian computing and engineering research, with a premier science institute and a dense ecosystem of technology employers and start-ups.',
      living:
        'Moderate to high costs depending on the area, with a large rental market shaped by the technology workforce.',
      moving:
        'A growing metro alongside buses; traffic is heavy and journey times are best planned generously. The climate is the most temperate of the large Indian cities.',
      featured: true,
    },
    {
      name: 'Chennai',
      state: 'Tamil Nadu',
      blurb:
        'A coastal city in the south with a strong engineering and medical tradition.',
      studying:
        'Particular depth in engineering, medicine and automotive research, anchored by a major technical institute and several long-established medical colleges.',
      living:
        'More affordable than Mumbai or Bengaluru, with a good supply of hostel and rental accommodation near the main campuses.',
      moving:
        'Metro, suburban rail and buses. Hot and humid for much of the year, with the heaviest rain between October and December.',
    },
    {
      name: 'Hyderabad',
      state: 'Telangana',
      blurb:
        'A city that pairs a four-hundred-year-old old quarter with a large modern technology district.',
      studying:
        'Strong in computing, business, pharmacy and the life sciences, with a substantial pharmaceutical industry alongside the technology sector.',
      living:
        'Among the more affordable of India’s large cities, with lower rents than Bengaluru or Mumbai for comparable accommodation.',
      moving:
        'A modern metro covering the main corridors, plus extensive buses. Hot summers, moderate winters.',
    },
    {
      name: 'Pune',
      state: 'Maharashtra',
      blurb:
        'A university city with a long academic tradition, and a significant automotive and technology industry.',
      studying:
        'A very large student population relative to the city’s size, with strength in engineering, management, film and the liberal arts.',
      living:
        'Cheaper than Mumbai while being close to it, which is a substantial part of the appeal, with plentiful student accommodation.',
      moving:
        'Buses and an expanding metro. The climate is milder than Mumbai’s and the monsoon is pronounced.',
    },
    {
      name: 'Kolkata',
      state: 'West Bengal',
      blurb:
        'An old colonial capital with a deep intellectual and literary tradition.',
      studying:
        'Particular strength in the humanities, economics, statistics and the pure sciences, with several institutions of long standing and national importance.',
      living:
        'Among the most affordable major Indian cities for both accommodation and daily costs.',
      moving:
        'India’s oldest metro, alongside trams, buses and ferries across the river. Humid summers and a heavy monsoon.',
    },
    {
      name: 'Manipal',
      state: 'Karnataka',
      blurb:
        'A hill town on the Karnataka coast that exists, in effect, because of the university built there.',
      studying:
        'Health sciences above all — medicine, dentistry, pharmacy and allied health — with teaching hospitals attached and a large international student population.',
      living:
        'Inexpensive compared with the major cities, with most students living in campus residences a short walk from teaching.',
      moving:
        'Small and walkable, with buses to Udupi and Mangaluru nearby. Coastal, humid, and heavily affected by the monsoon.',
    },
    {
      name: 'Ahmedabad',
      state: 'Gujarat',
      blurb:
        'A commercial city on the Sabarmati, with a notable tradition in design and management education.',
      studying:
        'Best known for management and design, with nationally significant institutes in both, alongside engineering and pharmacy.',
      living:
        'Low living costs relative to the other large cities, with a good supply of student accommodation.',
      moving:
        'A bus rapid transit system and a metro. Summers are very hot and dry.',
    },
  ],
};

export function cityShortDescription(c: CityFacts): string {
  return `<p>${c.blurb}</p>`;
}

export function cityOverview(c: CityFacts): string {
  return html([c.blurb, '## Studying here', c.studying, '## Living here', c.living, '## Getting around', c.moving]);
}

/** Every distinct state named by the cities of a country, in first-seen order. */
export function statesFor(countrySlug: string): { name: string; slug: string }[] {
  const seen = new Map<string, string>();
  for (const city of CITIES[countrySlug] ?? []) {
    if (city.state && !seen.has(city.state)) seen.set(city.state, slugify(city.state));
  }
  return [...seen].map(([name, slug]) => ({ name, slug }));
}

export const CITIES: Record<string, CityFacts[]> = { ...BASE_CITIES, ...MORE_CITIES };
