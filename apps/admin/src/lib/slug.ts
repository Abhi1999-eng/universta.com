export function slugFromText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function nextAutoSlug({
  sourceValue,
  currentSlug,
  existingRecord,
  manuallyOverridden,
}: {
  sourceValue: string;
  currentSlug: string;
  existingRecord: boolean;
  manuallyOverridden: boolean;
}) {
  if (existingRecord || manuallyOverridden) return currentSlug;
  return slugFromText(sourceValue);
}
