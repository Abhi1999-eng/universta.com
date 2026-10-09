import { SubjectLevelPage, subjectLevelMetadata, type SubjectLevelParams } from '@/components/study-abroad/SubjectLevelPage';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<SubjectLevelParams>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export const generateMetadata = ({ params, searchParams }: Props) => subjectLevelMetadata(params, searchParams);
export default SubjectLevelPage;
