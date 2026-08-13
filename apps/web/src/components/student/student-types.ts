/** Shapes the student portal reads from the API. Kept in one place so a
 * change to a payload surfaces as a type error rather than a blank card. */

export interface Completion {
  percentage: number;
  completedSections: string[];
  missingSections: string[];
  nextSection: string | null;
  nextSectionLabel: string | null;
}

export interface NamedRecord {
  id: string;
  name: string;
}

export interface StudentProfile {
  personal: {
    dateOfBirth: string | null;
    gender: string | null;
    nationalityCountry: NamedRecord | null;
    currentCountry: NamedRecord | null;
    currentCityText: string | null;
    address: string | null;
    postalCode: string | null;
  };
  studyPreferences: {
    subject: NamedRecord | null;
    courseLevel: NamedRecord | null;
    intake: NamedRecord | null;
    countries: Array<NamedRecord & { slug: string }>;
    budgetMin: number | null;
    budgetMax: number | null;
    budgetCurrency: string | null;
  };
}

export interface AcademicRecord {
  id: string;
  qualificationName: string;
  qualificationLevel: string | null;
  institutionName: string;
  boardOrUniversity: string | null;
  country: NamedRecord | null;
  specialization: string | null;
  startDate: string | null;
  endDate: string | null;
  currentlyStudying: boolean;
  percentage: number | null;
  gpa: number | null;
  gpaScale: number | null;
  notes: string | null;
}

export interface WorkExperience {
  id: string;
  companyName: string;
  jobTitle: string;
  employmentType: string | null;
  startDate: string | null;
  endDate: string | null;
  currentlyWorking: boolean;
  description: string | null;
}

export interface EnglishTest {
  id: string;
  testType: string;
  testDate: string | null;
  overallScore: number | null;
  componentScores: Record<string, number> | null;
  expiryDate: string | null;
}

export interface Passport {
  passportNumber: string;
  issuingCountry: NamedRecord | null;
  issueDate: string | null;
  expiryDate: string | null;
}

export interface StudentDocument {
  id: string;
  documentType: string;
  typeLabel: string;
  title: string;
  notes: string | null;
  fileName: string;
  url: string;
  sizeBytes: number;
  uploadedAt: string;
}

/** The checklist the documents page walks, in the order a student needs them. */
export const DOCUMENT_CHECKLIST = [
  { type: 'PASSPORT', label: 'Passport' },
  { type: 'RESUME', label: 'Resume' },
  { type: 'SOP', label: 'Statement of purpose' },
  { type: 'TRANSCRIPT', label: 'Transcript' },
  { type: 'LOR', label: 'Letter of recommendation' },
  { type: 'ENGLISH_TEST_RESULT', label: 'English test result' },
] as const;
