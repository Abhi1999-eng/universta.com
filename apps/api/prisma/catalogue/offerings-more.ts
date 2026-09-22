/**
 * Which generic courses each further institution offers, chosen from what it
 * is known for, as in `offerings.ts`. Tuition stays unset at this level; the
 * destination's indicative range carries the honest version.
 */
export const MORE_OFFERINGS: Record<string, string[]> = {
  // United States
  'massachusetts-institute-of-technology': ['msc-computer-science', 'msc-artificial-intelligence', 'msc-mechanical-engineering'],
  'harvard-university': ['master-of-business-administration', 'master-of-public-health', 'llm-international-law'],
  'stanford-university': ['msc-computer-science', 'master-of-business-administration', 'msc-electrical-engineering'],
  'university-of-california-berkeley': ['msc-data-science', 'msc-environmental-science', 'bsc-computer-science'],
  'carnegie-mellon-university': ['msc-machine-learning', 'msc-robotics-and-autonomous-systems', 'msc-software-engineering'],
  // New Zealand
  'university-of-auckland': ['msc-data-science', 'beng-civil-engineering', 'master-of-business-administration'],
  'victoria-university-of-wellington': ['llm-international-law', 'ma-international-relations', 'march-architecture'],
  'university-of-canterbury': ['beng-civil-engineering', 'bsc-computer-science', 'msc-environmental-science'],
  'university-of-otago': ['mpharm-pharmacy', 'msc-biomedical-science', 'master-of-public-health'],
  // France
  'sciences-po': ['ma-international-relations', 'msc-economics', 'ma-sociology'],
  'ecole-polytechnique': ['bsc-mathematics', 'msc-data-science', 'msc-physics'],
  'insa-lyon': ['beng-mechanical-engineering', 'beng-civil-engineering', 'msc-computer-science'],
  'universite-toulouse-iii-paul-sabatier': ['msc-aerospace-engineering', 'msc-physics', 'msc-biotechnology'],
  'grenoble-inp': ['msc-electrical-engineering', 'msc-computer-science', 'msc-mechanical-engineering'],
  // Italy
  'politecnico-di-milano': ['march-architecture', 'ma-user-experience-design', 'msc-mechanical-engineering'],
  'university-of-bologna': ['msc-economics', 'llm-international-law', 'msc-biotechnology'],
  'sapienza-university-of-rome': ['msc-physics', 'barch-architecture', 'msc-computer-science'],
  'politecnico-di-torino': ['msc-mechanical-engineering', 'msc-aerospace-engineering', 'msc-electrical-engineering'],
  'university-of-padua': ['msc-clinical-psychology', 'msc-biomedical-science', 'msc-data-science'],
  // Spain
  'university-of-barcelona': ['msc-biomedical-science', 'msc-economics', 'bsc-chemistry'],
  'complutense-university-of-madrid': ['llb-bachelor-of-laws', 'ba-film-and-media-production', 'msc-economics'],
  'esade-business-school': ['master-of-business-administration', 'msc-finance', 'msc-marketing'],
  'university-of-valencia': ['mpharm-pharmacy', 'bsc-psychology', 'msc-biotechnology'],
  'university-of-granada': ['bsc-computer-science', 'bsc-mathematics', 'mpharm-pharmacy'],
  // Sweden
  'kth-royal-institute-of-technology': ['msc-electrical-engineering', 'msc-computer-science', 'msc-machine-learning'],
  'lund-university': ['msc-environmental-science', 'msc-international-business', 'msc-biomedical-science'],
  'uppsala-university': ['mpharm-pharmacy', 'msc-physics', 'ma-international-relations'],
  'chalmers-university-of-technology': ['msc-mechanical-engineering', 'msc-software-engineering', 'march-architecture'],
  // Denmark
  'university-of-copenhagen': ['msc-biotechnology', 'msc-economics', 'msc-bioinformatics'],
  'technical-university-of-denmark': ['msc-mechanical-engineering', 'msc-biotechnology', 'msc-electrical-engineering'],
  'aarhus-university': ['msc-finance', 'msc-environmental-science', 'bsc-computer-science'],
  'aalborg-university': ['msc-urban-planning', 'msc-software-engineering', 'msc-electrical-engineering'],
  // Finland
  'university-of-helsinki': ['msc-data-science', 'msc-environmental-science', 'bsc-computer-science'],
  'aalto-university': ['ma-user-experience-design', 'msc-computer-science', 'msc-entrepreneurship-and-innovation'],
  'tampere-university': ['msc-software-engineering', 'master-of-public-health', 'msc-electrical-engineering'],
  'university-of-turku': ['msc-biomedical-science', 'msc-economics', 'msc-cybersecurity'],
  'university-of-oulu': ['msc-electrical-engineering', 'msc-computer-science', 'msc-environmental-science'],
  // Switzerland
  'eth-zurich': ['msc-computer-science', 'msc-mechanical-engineering', 'march-architecture'],
  'epfl': ['msc-data-science', 'msc-robotics-and-autonomous-systems', 'bsc-mathematics'],
  'university-of-zurich': ['msc-economics', 'msc-biomedical-science', 'msc-finance'],
  'university-of-geneva': ['llm-international-law', 'ma-international-relations', 'msc-physics'],
  'university-of-basel': ['msc-biotechnology', 'mpharm-pharmacy', 'msc-bioinformatics'],
  // Japan
  'university-of-tokyo': ['msc-mechanical-engineering', 'msc-physics', 'msc-economics'],
  'kyoto-university': ['bsc-chemistry', 'msc-physics', 'msc-environmental-science'],
  'osaka-university': ['msc-biomedical-science', 'msc-mechanical-engineering', 'msc-electrical-engineering'],
  'tohoku-university': ['msc-mechanical-engineering', 'msc-physics', 'msc-environmental-science'],
  'waseda-university': ['ma-international-relations', 'master-of-business-administration', 'ba-economics'],
  // South Korea
  'seoul-national-university': ['msc-computer-science', 'msc-economics', 'msc-mechanical-engineering'],
  'kaist': ['msc-electrical-engineering', 'msc-computer-science', 'msc-artificial-intelligence'],
  'yonsei-university': ['master-of-business-administration', 'ma-international-relations', 'msc-biomedical-science'],
  'korea-university': ['bba-business-administration', 'llb-bachelor-of-laws', 'msc-electrical-engineering'],
  'postech': ['beng-chemical-engineering', 'msc-physics', 'msc-mechanical-engineering'],
  // United Arab Emirates
  'khalifa-university': ['msc-aerospace-engineering', 'msc-electrical-engineering', 'msc-artificial-intelligence'],
  'united-arab-emirates-university': ['beng-civil-engineering', 'master-of-public-health', 'bba-business-administration'],
  'american-university-of-sharjah': ['barch-architecture', 'beng-mechanical-engineering', 'bba-business-administration'],
  'university-of-wollongong-in-dubai': ['bba-business-administration', 'msc-finance', 'bsc-computer-science'],
  'heriot-watt-university-dubai': ['beng-civil-engineering', 'msc-data-science', 'master-of-business-administration'],
};
