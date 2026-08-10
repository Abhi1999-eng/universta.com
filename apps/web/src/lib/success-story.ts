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
    university?: StoryRelation | null;
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
  return country.slug ? `/countries/${encodeURIComponent(country.slug)}` : null;
}

export function universityPath(university: StoryRelation) {
  return university.slug ? `/universities/${encodeURIComponent(university.slug)}` : null;
}

export function programmePath(story: SuccessStoryRow) {
  const offering = story.offering;
  if (offering?.slug && offering.university?.slug) {
    return `/universities/${encodeURIComponent(offering.university.slug)}/courses/${encodeURIComponent(offering.slug)}`;
  }
  return offering?.genericCourse?.slug
    ? `/courses/${encodeURIComponent(offering.genericCourse.slug)}`
    : null;
}
