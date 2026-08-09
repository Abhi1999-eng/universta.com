export type ConsultantContact = {
  email?: string | null;
  phone?: string | null;
};

export type ConsultantContactAction = {
  label: "Contact Consultant" | "Call" | "Email";
  href: string;
  primary?: boolean;
};

function present(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

/**
 * Consultant profiles have no first-party enquiry endpoint. Their public
 * contact action therefore stays with the Consultant by using its published
 * email address, rather than routing a visitor into Universta counselling.
 */
export function consultantContactActions({
  email,
  phone,
}: ConsultantContact): ConsultantContactAction[] {
  const contactEmail = present(email);
  const contactPhone = present(phone);
  const actions: ConsultantContactAction[] = [];

  if (contactEmail) {
    actions.push({
      label: "Contact Consultant",
      href: `mailto:${contactEmail}`,
      primary: true,
    });
  }
  if (contactPhone) actions.push({ label: "Call", href: `tel:${contactPhone}` });
  if (contactEmail) actions.push({ label: "Email", href: `mailto:${contactEmail}` });

  return actions;
}
