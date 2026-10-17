import { LevelPageForm } from '@/features/catalog/LevelPageForm';
export default async function SpecializationLevelPageRoute({ params }: { params: Promise<{ id: string; levelId: string }> }) { const p = await params; return <LevelPageForm owner="specialization" ownerId={p.id} levelId={p.levelId} />; }
