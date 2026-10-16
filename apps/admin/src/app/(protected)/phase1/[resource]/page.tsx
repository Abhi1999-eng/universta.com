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
  /* Keyed by resource: a different list starts with its own editor state
     and reads its own address, rather than carrying the last one's open record. */
  return <Phase1Manager key={resource} resource={resource} />;
}
