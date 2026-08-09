import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  SuccessStoryDetail,
  type SuccessStoryRow,
} from "@/components/phase1/SuccessStoryViews";
import { phaseDetail } from "@/lib/phase1";
import { phaseOneMetadata } from "@/lib/phase1-metadata";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

async function successStory(slug: string) {
  try {
    return await phaseDetail<SuccessStoryRow>("success-stories", slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const story = await successStory(slug);
  return story
    ? phaseOneMetadata(story, `/success-stories/${story.slug}`, "Success story")
    : { title: "Success story not found | Universta", robots: { index: false } };
}

export default async function SuccessStoryPage({ params }: Props) {
  const { slug } = await params;
  const story = await successStory(slug);
  if (!story) notFound();
  return <SuccessStoryDetail story={story} />;
}
