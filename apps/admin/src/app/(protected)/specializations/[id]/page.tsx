import { SpecializationForm } from '@/features/catalog/SpecializationForm';
export default async function SpecializationRoute({ params }: { params: Promise<{ id: string }> }) { return <SpecializationForm id={(await params).id} />; }
