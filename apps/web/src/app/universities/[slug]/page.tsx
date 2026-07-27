import { notFound } from "next/navigation";
import {
  UniversityDetail,
  type AnyRecord,
} from "@/components/phase1/PhaseOneViews";
import { phaseDetail } from "@/lib/phase1";

export const dynamic = "force-dynamic";

async function university(slug: string) {
  try {
    return await phaseDetail<AnyRecord>("universities", slug);
  } catch {
    notFound();
  }
}

export default async function UniversityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const row = await university((await params).slug);
  return <UniversityDetail row={row} />;
}
