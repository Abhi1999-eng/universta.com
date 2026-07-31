import { WebsiteBuilderWorkspace } from "@/features/website/WebsiteBuilderWorkspace";

/** The consolidated Website Builder workspace for one page. */
export default async function BuilderRoute({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  return <WebsiteBuilderWorkspace pageId={pageId} />;
}
