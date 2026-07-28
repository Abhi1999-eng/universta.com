import { notFound } from "next/navigation";
import { Phase1Manager } from "@/features/phase1/Phase1Manager";
const resources = new Set([
  "universities",
  "offerings",
  "scholarships",
  "consultants",
  "jobs",
  "events",
  "success-stories",
  "testimonials",
  "pages",
  "navigation-menus",
  "contact-inquiries",
]);
export default async function Phase1AdminPage({
  params,
}: {
  params: Promise<{ resource: string }>;
}) {
  const { resource } = await params;
  if (!resources.has(resource)) notFound();
  return <Phase1Manager resource={resource} />;
}
