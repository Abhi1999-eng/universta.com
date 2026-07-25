import { SubjectForm } from '@/features/catalog/SubjectForm';
export default async function SubjectRoute({ params }: { params: Promise<{ id: string }> }) { return <SubjectForm id={(await params).id} />; }
