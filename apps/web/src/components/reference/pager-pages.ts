/**
 * Which page numbers a pager should draw.
 *
 * The first, the last, and the ones either side of where the reader is,
 * with a gap marked wherever a run was left out. Four of the six directories
 * drew every page instead: /universities has 32 of them, which came out as
 * three rows of numbered buttons 178px tall under the results, and a
 * catalogue twice the size would be six rows. The two that did window it
 * had the same filter written out twice, so this is where it lives now.
 */
export type PagerPage = {
  page: number;
  /** A run was skipped before this one, so draw an ellipsis. */
  gapBefore: boolean;
};

export function pagerPages(
  current: number,
  totalPages: number,
  /** How many to keep either side of the current page. */
  around = 1,
): PagerPage[] {
  const pages: PagerPage[] = [];
  let previous = 0;
  for (let page = 1; page <= totalPages; page += 1) {
    const keep =
      page === 1 ||
      page === totalPages ||
      Math.abs(page - current) <= Math.max(0, around);
    if (!keep) continue;
    pages.push({ page, gapBefore: previous > 0 && page - previous > 1 });
    previous = page;
  }
  return pages;
}
