import { LevelPageForm } from '@/features/catalog/LevelPageForm';
export default async function SubjectLevelPageRoute({ params }: { params: Promise<{ id: string; levelId: string }> }) { const p = await params; return <LevelPageForm owner="subject" ownerId={p.id} levelId={p.levelId} />; }
