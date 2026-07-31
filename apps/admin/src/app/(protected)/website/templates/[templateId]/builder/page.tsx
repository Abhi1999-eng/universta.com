import { TemplateBuilderWorkspace } from "@/features/website/TemplateBuilderWorkspace";

/** Builder workspace for one dynamic detail template. */
export default async function TemplateBuilderRoute({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  return <TemplateBuilderWorkspace templateId={templateId} />;
}
