/**
 * How an admin save writes a consultant's offices, services and languages.
 *
 * The form sends the whole list every time. These used to be deleted and
 * written again on every save, so fixing a typo in a consultant's name also
 * wiped every office address (the form has no say over them), renamed each
 * service's slug to "<name>-<position>" -- which dropped the consultant from
 * every existing ?service= link -- and cleared every language code. Each
 * function here compares the list with what is stored instead: a row whose
 * name (or location) is unchanged is kept as it is, with its id, slug, code
 * and address; only what was removed is deleted and only what is new is
 * created.
 */

export type ExistingOffice = { locationId: string; address?: string | null };
export type ExistingService = {
  id: string;
  name: string;
  slug: string;
  displayOrder?: number;
};
export type ExistingLanguage = { id: string; name: string };

/** Names are matched trimmed and case-blind: "visa guidance" retyped as
 * "Visa guidance" is the same service. */
const nameKey = (value: string) => value.trim().toLowerCase();

/** A service's slug is its name, and only its name: uniqueness is per
 * consultant, so the same service reads the same in every profile's links. */
export function serviceSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'service'
  );
}

/** The first of `base`, `base-2`, `base-3`... that is not taken. Only two
 * names that differ by punctuation alone ever reach a suffix. */
function freeSlug(base: string, taken: Set<string>): string {
  let slug = base;
  for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`;
  taken.add(slug);
  return slug;
}

/** One entry per name, the first spelling kept. */
function distinctNames(names: string[]): string[] {
  const seen = new Set<string>();
  return names
    .map((name) => name.trim())
    .filter((name) => {
      const key = nameKey(name);
      if (!name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function addressValue(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  return value.trim() || null;
}

/**
 * Offices: the ticked locations, each with an optional address.
 *
 * `addresses` maps a location id to its address. A location with no key
 * there keeps whatever address it has; an empty string clears it.
 */
export function consultantLocationWrites(
  locationIds: string[],
  addresses: unknown,
  existing: ExistingOffice[] | undefined,
) {
  const given =
    addresses && typeof addresses === 'object' && !Array.isArray(addresses)
      ? (addresses as Record<string, unknown>)
      : {};
  const addressFor = (locationId: string) =>
    Object.prototype.hasOwnProperty.call(given, locationId)
      ? addressValue(given[locationId])
      : undefined;
  if (!existing)
    return {
      create: locationIds.map((locationId) => ({
        locationId,
        address: addressFor(locationId) ?? null,
      })),
    };
  const stored = new Set(existing.map((row) => row.locationId));
  const wanted = new Set(locationIds);
  const removed = [...stored].filter((locationId) => !wanted.has(locationId));
  const updates = locationIds
    .filter((locationId) => stored.has(locationId))
    .flatMap((locationId) => {
      const address = addressFor(locationId);
      const current = existing.find((row) => row.locationId === locationId);
      return address === undefined || address === (current?.address ?? null)
        ? []
        : [{ where: { locationId }, data: { address } }];
    });
  const created = locationIds
    .filter((locationId) => !stored.has(locationId))
    .map((locationId) => ({
      locationId,
      address: addressFor(locationId) ?? null,
    }));
  return {
    ...(removed.length ? { deleteMany: { locationId: { in: removed } } } : {}),
    ...(updates.length ? { updateMany: updates } : {}),
    ...(created.length ? { create: created } : {}),
  };
}

/** Services: kept rows keep their id and slug; new ones are slugged from
 * their name alone. */
export function consultantServiceWrites(
  names: string[],
  existing: ExistingService[] | undefined,
) {
  const list = distinctNames(names);
  if (!existing) {
    const taken = new Set<string>();
    return {
      create: list.map((name, index) => ({
        name,
        slug: freeSlug(serviceSlug(name), taken),
        displayOrder: index + 1,
      })),
    };
  }
  const byKey = new Map<string, ExistingService>();
  for (const row of existing)
    if (!byKey.has(nameKey(row.name))) byKey.set(nameKey(row.name), row);
  const keptIds = new Set(
    list
      .map((name) => byKey.get(nameKey(name))?.id)
      .filter((id): id is string => Boolean(id)),
  );
  /* Every stored slug stays reserved while this save runs, removed rows'
     included: the order Prisma applies the deletes and creates in is not
     ours to choose, and a new row must never collide with an old one. */
  const taken = new Set(existing.map((row) => row.slug));
  const removed = existing
    .filter((row) => !keptIds.has(row.id))
    .map((row) => row.id);
  const updates: Array<{
    where: { id: string };
    data: { name: string; displayOrder: number };
  }> = [];
  const created: Array<{ name: string; slug: string; displayOrder: number }> =
    [];
  list.forEach((name, index) => {
    const row = byKey.get(nameKey(name));
    if (row) {
      if (row.name !== name || row.displayOrder !== index + 1)
        updates.push({
          where: { id: row.id },
          data: { name, displayOrder: index + 1 },
        });
    } else
      created.push({
        name,
        slug: freeSlug(serviceSlug(name), taken),
        displayOrder: index + 1,
      });
  });
  return {
    ...(removed.length ? { deleteMany: { id: { in: removed } } } : {}),
    ...(updates.length ? { update: updates } : {}),
    ...(created.length ? { create: created } : {}),
  };
}

/** Languages: kept rows keep their id and code; new ones have no code. */
export function consultantLanguageWrites(
  names: string[],
  existing: ExistingLanguage[] | undefined,
) {
  const list = distinctNames(names);
  if (!existing) return { create: list.map((name) => ({ name })) };
  const byKey = new Map<string, ExistingLanguage>();
  for (const row of existing)
    if (!byKey.has(nameKey(row.name))) byKey.set(nameKey(row.name), row);
  const keptIds = new Set(
    list
      .map((name) => byKey.get(nameKey(name))?.id)
      .filter((id): id is string => Boolean(id)),
  );
  const removed = existing
    .filter((row) => !keptIds.has(row.id))
    .map((row) => row.id);
  const renamed = list.flatMap((name) => {
    const row = byKey.get(nameKey(name));
    return row && row.name !== name
      ? [{ where: { id: row.id }, data: { name } }]
      : [];
  });
  const created = list
    .filter((name) => !byKey.has(nameKey(name)))
    .map((name) => ({ name }));
  return {
    ...(removed.length ? { deleteMany: { id: { in: removed } } } : {}),
    ...(renamed.length ? { update: renamed } : {}),
    ...(created.length ? { create: created } : {}),
  };
}
