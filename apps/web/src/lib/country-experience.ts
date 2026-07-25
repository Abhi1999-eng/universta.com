export function isPublishedValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '';
}

export type ConsultationTargetOptions = {
  hasConsultants: boolean;
  hasStructuredTrust: boolean;
  configuredDestination?: string | null;
};

export function consultationTarget({ hasConsultants, hasStructuredTrust, configuredDestination }: ConsultationTargetOptions): string | null {
  if (hasConsultants) return '#consultants';
  if (hasStructuredTrust) return '#structured-trust';
  if (configuredDestination && (/^\//.test(configuredDestination) || /^https:\/\//.test(configuredDestination))) return configuredDestination;
  return null;
}
