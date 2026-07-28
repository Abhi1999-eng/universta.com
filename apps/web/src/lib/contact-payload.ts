export function contactPayload(form: FormData) {
  return {
    ...Object.fromEntries(form),
    privacyConsent: form.get("privacyConsent") === "true",
  };
}
