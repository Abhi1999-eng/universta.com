import type { MetadataRoute } from "next";
import type { AnyRecord } from "@/components/phase1/PhaseOneViews";
import { phaseList } from "@/lib/phase1";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const resources = [
  "universities",
  "scholarships",
  "consultants",
  "jobs",
  "events",
  "success-stories",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = [
    "/",
    "/about",
    "/contact",
    "/faq",
    "/countries",
    "/subjects",
    "/courses",
    "/universities",
    "/scholarships",
    "/study-abroad-consultants",
    "/counselling",
    "/success-stories",
    "/testimonials",
    "/careers",
    "/events",
  ].map((path) => ({
    url: new URL(path, base).toString(),
    changeFrequency: "weekly" as const,
    priority: path === "/" ? 1 : 0.7,
  }));
  try {
    const [universities, scholarships, consultants, jobs, events, stories] =
      await Promise.all(
        resources.map((resource) =>
          phaseList<AnyRecord>(resource, { limit: "50" }),
        ),
      );
    const dynamicRoutes = [
      ...universities.data.map((row) => `/universities/${row.slug}`),
      ...scholarships.data.map((row) => `/scholarships/${row.slug}`),
      ...consultants.data.map((row) => `/study-abroad-consultants/${row.slug}`),
      ...jobs.data.map((row) => `/careers/${row.slug}`),
      ...events.data.map((row) => `/events/${row.slug}`),
      ...stories.data.map((row) => `/success-stories/${row.slug}`),
    ].map((path) => ({
      url: new URL(path, base).toString(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
    return [...staticRoutes, ...dynamicRoutes];
  } catch {
    return staticRoutes;
  }
}
