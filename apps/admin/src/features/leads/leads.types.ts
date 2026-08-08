export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface LeadRelation {
  id: string;
  name: string;
  slug?: string;
  code?: string;
  shortLabel?: string | null;
}

export interface LeadConsultantOption {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export interface LeadAssignedConsultant extends LeadConsultantOption {
  assignedAt: string;
  assignmentUpdatedAt: string;
}

export interface LeadRecord {
  id: string;
  leadNumber: string;
  formType: string;
  sourceType: string | null;
  sourceEntityId: string | null;
  sourcePageUrl: string | null;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phoneCountryCode: string | null;
  phoneNumber: string;
  message: string | null;
  status: string;
  priority: string;
  privacyConsent: boolean;
  marketingConsent: boolean;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrerUrl: string | null;
  landingPageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  preferredCountry: LeadRelation | null;
  preferredCourse: LeadRelation | null;
  preferredSubject: LeadRelation | null;
  preferredCourseLevel: LeadRelation | null;
  preferredIntake: LeadRelation | null;
}

export interface LeadActor {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
}

export interface LeadNote {
  id: string;
  noteType: string;
  note: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  user: LeadActor;
}

export interface LeadStatusHistory {
  id: string;
  oldStatus: string | null;
  newStatus: string;
  reason: string | null;
  createdAt: string;
  changedBy: LeadActor | null;
}

export interface LeadAudit {
  id: string;
  action: string;
  description: string | null;
  createdAt: string;
  user: LeadActor | null;
}

export interface LeadDetail extends LeadRecord {
  notes: LeadNote[];
  statusHistory: LeadStatusHistory[];
  audit: LeadAudit[];
  assignedConsultant: LeadAssignedConsultant | null;
}

export interface LeadOptions {
  statuses: string[];
  sourceTypes: string[];
  countries: LeadRelation[];
  courseLevels: LeadRelation[];
  intakes: LeadRelation[];
  consultants: LeadConsultantOption[];
}

export interface LeadListParams {
  q?: string;
  status?: string;
  countryId?: string;
  courseLevelId?: string;
  intakeId?: string;
  sourceType?: string;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  limit?: number;
}

export class LeadClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;
  readonly requestId: string | null;

  constructor(
    message: string,
    options: {
      code: string;
      status: number;
      details?: unknown;
      requestId?: string | null;
    },
  ) {
    super(message);
    this.name = 'LeadClientError';
    this.code = options.code;
    this.status = options.status;
    this.details = options.details ?? null;
    this.requestId = options.requestId ?? null;
  }
}
