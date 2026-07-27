const secondaryKeys = {
  englishTest: "english-test",
  scholarshipAvailable: "scholarship",
  level: "level",
  studyMode: "study-mode",
  minTuition: "min-tuition",
  maxTuition: "max-tuition",
  sort: "sort",
  page: "page",
  pageSize: "page-size",
} as const;

function normalized(value: string) {
  return value.trim().toLowerCase();
}

export function legacyCourseDiscoveryUrl(filters: Record<string, string>) {
  const subject = normalized(filters.subject);
  const subSubject = normalized(filters.subSubject);
  const country = normalized(filters.country);
  const intake = normalized(filters.intake);
  const secondary = new URLSearchParams();

  for (const [key, target] of Object.entries(secondaryKeys)) {
    const value = filters[key];
    if (value) secondary.set(target, normalized(value));
  }

  const destination = `/courses/${subject}/${subSubject}/${country}/${intake}`;
  return `${destination}${secondary.size ? `?${secondary}` : ""}`;
}
