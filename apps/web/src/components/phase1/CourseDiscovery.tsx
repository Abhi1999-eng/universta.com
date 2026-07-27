import { notFound } from 'next/navigation';
import { ApprovedCoursesListing } from '@/components/templates/CourseCatalogTemplate';
import { getCourseFilterOptions, getCourses, getSubjects } from '@/lib/catalog';

export async function CourseDiscovery({ filters }: { filters: Record<string, string> }) {
  try {
    const [courses, subjects, options] = await Promise.all([getCourses({ ...filters, pageSize: filters.pageSize ?? '12' }), getSubjects({ limit: '100' }).then((result) => result.data), getCourseFilterOptions(filters)]);
    if (!courses.meta.total) notFound();
    return <ApprovedCoursesListing courses={courses.data} meta={courses.meta} subjects={subjects} filterOptions={options} filters={{ ...filters, pageSize: filters.pageSize ?? '12' }} />;
  } catch { notFound(); }
}
