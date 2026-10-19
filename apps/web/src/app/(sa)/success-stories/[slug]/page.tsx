import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { type AnyRecord } from '@/components/phase1/PhaseOneViews';
import { StoryGuide } from '@/components/study-abroad/RecordGuide';
import { phaseDetail } from '@/lib/phase1';
import { phaseOneMetadata } from '@/lib/phase1-metadata';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

async function successStory(slug: string) {
  try {
    return await phaseDetail<AnyRecord>('success-stories', slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const story = await successStory(slug);
  if (!story) return { title: { absolute: 'Success story not found | Universta' }, robots: { index: false } };
  const metadata = phaseOneMetadata(story, `/success-stories/${story.slug ?? slug}`, 'Success story', 'successStory');
  /* The helper writes the site's suffix; the route family's template would add it again. */
  return { ...metadata, title: { absolute: String(metadata.title) } };
}

export default async function SuccessStoryPage({ params }: Props) {
  const { slug } = await params;
  const story = await successStory(slug);
  if (!story) notFound();
  return <StoryGuide row={story as unknown as Record<string, unknown> & { id: string }} />;
}
