import { notFound } from "next/navigation";
import { ApprovedCoursesListing } from "@/components/templates/CourseCatalogTemplate";
import { getCourseFilterOptions, getCourses, getSubjects } from "@/lib/catalog";

export async function CourseDiscovery({
  filters,
}: {
  filters: Record<string, string>;
}) {
  const result = await courseDiscoveryData(filters);
  return (
    <ApprovedCoursesListing
      courses={result.courses.data}
      meta={result.courses.meta}
      subjects={result.subjects}
      filterOptions={result.options}
      filters={{ ...filters, pageSize: filters.pageSize ?? "12" }}
    />
  );
}

async function courseDiscoveryData(filters: Record<string, string>) {
  try {
    const [courses, subjects, options] = await Promise.all([
      getCourses({ ...filters, pageSize: filters.pageSize ?? "12" }),
      getSubjects({ limit: "100" }).then((result) => result.data),
      getCourseFilterOptions(filters),
    ]);
    if (!courses.meta.total) notFound();
    return { courses, subjects, options };
  } catch {
    notFound();
  }
}
