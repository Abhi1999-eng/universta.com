'use client';

/**
 * Legacy profile columns remain in the database for backwards compatibility,
 * but Country editing no longer duplicates University/Offering facts here.
 */
export function CountryProfilesEditor({ countryId }: { countryId: string }) {
  void countryId;
  return (
    <section className="mt-8 rounded-2xl border border-[#E8ECF3] bg-white p-6 sm:p-8" aria-labelledby="country-derived-data-heading">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">Derived data</p>
      <h2 id="country-derived-data-heading" className="mt-2 text-2xl font-semibold">
        University and course facts are managed at their source
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[#667085]">Tuition, detailed English-test requirements, ranking, statistics and source verification are derived from published Universities and University Course Offerings. Update them in their respective editors; existing legacy profile data remains safely preserved but is not editable here.</p>
    </section>
  );
}
