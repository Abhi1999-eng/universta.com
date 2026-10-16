/** A role as a person reads it: "Super admin", not SUPER_ADMIN. */
const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super admin',
  ADMIN: 'Admin',
  EDITOR: 'Editor',
  CONTENT_EDITOR: 'Content editor',
  COUNSELLOR: 'Counsellor',
  STUDENT: 'Student',
};

export function roleLabel(role: string): string {
  const known = ROLE_LABELS[role];
  if (known) return known;
  const words = role.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function rolesLabel(roles: string[] | undefined | null): string {
  return (roles ?? []).map(roleLabel).join(' · ');
}
