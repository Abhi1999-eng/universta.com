/** Legacy per-template chrome. The public Header and Footer are now rendered
 * once in the root layout from Admin-managed navigation and settings
 * (see components/chrome/SiteChrome.tsx), so these render nothing. They are
 * kept as no-ops so the many page templates that still call them compile
 * unchanged and cannot reintroduce a second, divergent header. */

export function SiteHeader(props?: { detail?: boolean }) {
  void props;
  return null;
}

export function SiteFooter() {
  return null;
}
