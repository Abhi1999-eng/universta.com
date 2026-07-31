import { ApprovedHome } from "@/components/templates/ApprovedTemplatePages";
import type { AnyRecord } from "@/components/phase1/PhaseOneViews";
import { getCountries } from "@/lib/countries";
import { getSubjects, getCourses } from "@/lib/catalog";
import { phaseList, phasePage } from "@/lib/phase1";
import { staticPageMetadata } from "@/lib/static-page-seo";
import { getStatsPill } from '@/lib/stats-pill';

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return staticPageMetadata(
    "home",
    "Plan your study abroad journey with clarity.",
    "Explore published countries, subjects, courses, universities and scholarships, then speak with a counsellor when you are ready.",
    "/",
  );
}

async function loadStats() {
  const [countries, universities, subjects, courses, scholarships, consultants] =
    await Promise.all([
      getCountries({ limit: "1" }).then((r) => r.meta.total).catch(() => 0),
      phaseList<AnyRecord>("universities", { limit: "1" }).then((r) => (r.meta as { total: number }).total).catch(() => 0),
      getSubjects({ limit: "1" }).then((r) => r.meta.total).catch(() => 0),
      getCourses({ limit: "1" }).then((r) => r.meta.total).catch(() => 0),
      phaseList<AnyRecord>("scholarships", { limit: "1" }).then((r) => (r.meta as { total: number }).total).catch(() => 0),
      phaseList<AnyRecord>("consultants", { limit: "1" }).then((r) => (r.meta as { total: number }).total).catch(() => 0),
    ]);
  return { countries, universities, subjects, courses, scholarships, consultants };
}

async function loadHeroOverride() {
  try {
    const page = await phasePage<AnyRecord>("home");
    const hero = page?.sections?.find((section: AnyRecord) => section.sectionKey === "hero");
    return { heading: hero?.heading as string | undefined, subheading: hero?.subheading as string | undefined };
  } catch {
    return {};
  }
}

export default async function HomePage() {
  const [stats, hero, pill] = await Promise.all([loadStats(), loadHeroOverride(), getStatsPill('home')]);
  return <ApprovedHome stats={stats} heading={hero.heading} subheading={hero.subheading} pill={pill} />;
}
