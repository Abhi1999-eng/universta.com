import { CourseForm } from '@/features/catalog/CourseForm';
export default async function CourseRoute({ params }: { params: Promise<{ id: string }> }) { return <CourseForm id={(await params).id} />; }
