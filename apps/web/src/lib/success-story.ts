import { offeringHref } from "./university-links";

export type StoryRelation = { name?: string | null; slug?: string | null };

export type SuccessStoryRow = {
  id: string;
  title: string;
  slug: string;
  journey: string;
  attribution?: string | null;
  attributionNote?: string | null;
  country?: StoryRelation | null;
  university?: StoryRelation | null;
  offering?: (StoryRelation & {
    university?: (StoryRelation & { country?: { slug?: string | null } | null }) | null;
    genericCourse?: StoryRelation | null;
  }) | null;
  featuredMedia?: {
    publicUrl?: string | null;
    altText?: string | null;
    title?: string | null;
  } | null;
};

export function successStoryPath(slug: string) {
  return `/success-stories/${encodeURIComponent(slug)}`;
}

export function successStoryCount(total: number) {
  return `${total} ${total === 1 ? "success story" : "success stories"}`;
}

export function journeyExcerpt(journey: string, length = 180) {
  const normalized = journey.replace(/\s+/g, " ").trim();
  if (normalized.length <= length) return normalized;
  return `${normalized.slice(0, length).trimEnd()}…`;
}

export function countryPath(country: StoryRelation) {
  return country.slug ? `/study-abroad/${encodeURIComponent(country.slug)}` : null;
}

export function universityPath(university: StoryRelation) {
  return university.slug ? `/universities/${encodeURIComponent(university.slug)}` : null;
}

/**
 * The story's programme page. The course's own address is filed under its
 * university's country (/study-abroad/<country>/universities/<uni>/courses/
 * <offering>); the flat /universities/<uni>/courses/<offering> answered with
 * a redirect on every click. Without the country, the general course's page
 * is the next best, and with neither the card is not linked.
 */
export function programmePath(story: Pick<SuccessStoryRow, "offering">) {
  const offering = story.offering;
  const countrySlug = offering?.university?.country?.slug;
  if (offering?.slug && offering.university?.slug && countrySlug) {
    return offeringHref(
      encodeURIComponent(countrySlug),
      encodeURIComponent(offering.university.slug),
      encodeURIComponent(offering.slug),
    );
  }
  return offering?.genericCourse?.slug
    ? `/courses/${encodeURIComponent(offering.genericCourse.slug)}`
    : null;
}

type Related = { id: string; slug?: unknown; country?: unknown; university?: unknown };

const slugOf = (place: unknown) => {
  const slug = place && typeof place === "object" ? (place as { slug?: unknown }).slug : null;
  return typeof slug === "string" && slug ? slug : null;
};

/**
 * Up to `count` other stories to read next: those from the same country or
 * university first, then the rest in the order the list holds them (the
 * editors' display order). The story being read is never among them.
 */
export function moreStories<T extends Related>(current: Related, all: readonly T[], count = 4): T[] {
  const country = slugOf(current.country);
  const university = slugOf(current.university);
  const others = all.filter((row) => row.id !== current.id && (!current.slug || row.slug !== current.slug));
  const near = (row: T) =>
    (country && slugOf(row.country) === country) || (university && slugOf(row.university) === university) ? 0 : 1;
  return others
    .map((row, index) => ({ row, index }))
    .sort((a, b) => near(a.row) - near(b.row) || a.index - b.index)
    .slice(0, count)
    .map(({ row }) => row);
}
