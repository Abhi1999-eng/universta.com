/** Page-level Header/Footer overrides.
 *
 * The Global Header and Global Footer stay the source of truth. An override is
 * a narrow, validated patch on top of them -- never a second set of chrome
 * components. That distinction matters: the six divergent hardcoded
 * header/footer implementations this project used to have were the root cause
 * of both the "settings are ignored" and "pages are undiscoverable" defects,
 * and an override system that re-introduced per-page components would bring
 * both back. So an alternate *variant* here only changes how the one canonical
 * chrome renders; it still consumes Admin-managed Settings and Navigation.
 *
 * Resolution order, most specific first:
 *
 *   Page.chromeConfigJson
 *   -> assigned PageTemplate.chromeConfigJson
 *   -> Global Header/Footer settings
 *
 * Absent (NULL) means "use the global", which is what every pre-existing Page
 * and Template resolves to, so the migration is visually a no-op.
 */

export const CHROME_MODES = [
  'USE_GLOBAL',
  'HIDE',
  'ALTERNATE_VARIANT',
] as const;
export type ChromeMode = (typeof CHROME_MODES)[number];

/** Variants are a closed set on purpose. An open-ended key would eventually be
 * used to smuggle in a bespoke layout, which is the thing being prevented. */
export const HEADER_VARIANTS = [
  'default',
  'compact',
  'centered',
  'minimal',
] as const;
export const FOOTER_VARIANTS = ['default', 'compact', 'minimal'] as const;

export type HeaderOverride = {
  mode: ChromeMode;
  variant?: string;
  navigationMenuKey?: string | null;
  announcementVisible?: boolean;
  ctaVisible?: boolean;
  ctaLabel?: string;
  ctaUrl?: string;
};

export type FooterOverride = {
  mode: ChromeMode;
  variant?: string;
  navigationMenuKey?: string | null;
  footerCtaVisible?: boolean;
  counsellingCtaVisible?: boolean;
};

export type ChromeConfig = { header?: HeaderOverride; footer?: FooterOverride };

function mode(value: unknown): ChromeMode | null {
  // Only a string can name a mode. Anything else is rejected outright rather
  // than stringified into something that might coincidentally match.
  if (typeof value !== 'string') return null;
  const upper = value.toUpperCase();
  return (CHROME_MODES as readonly string[]).includes(upper)
    ? (upper as ChromeMode)
    : null;
}
function bool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}
function text(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}
function variant(
  value: unknown,
  allowed: readonly string[],
): string | undefined {
  const candidate = text(value, 40);
  return candidate && allowed.includes(candidate) ? candidate : undefined;
}

/** Normalises whatever is stored (or submitted) into a known-good shape.
 * Anything unrecognised is dropped rather than trusted, so a hand-edited or
 * stale row degrades to USE_GLOBAL instead of rendering something arbitrary. */
export function parseChromeConfig(raw: unknown): ChromeConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const config: ChromeConfig = {};

  const headerRaw = source.header;
  if (headerRaw && typeof headerRaw === 'object' && !Array.isArray(headerRaw)) {
    const h = headerRaw as Record<string, unknown>;
    const headerMode = mode(h.mode);
    if (headerMode) {
      config.header = {
        mode: headerMode,
        variant: variant(h.variant, HEADER_VARIANTS),
        navigationMenuKey: text(h.navigationMenuKey, 100) ?? null,
        announcementVisible: bool(h.announcementVisible),
        ctaVisible: bool(h.ctaVisible),
        ctaLabel: text(h.ctaLabel, 100),
        ctaUrl: text(h.ctaUrl, 500),
      };
    }
  }

  const footerRaw = source.footer;
  if (footerRaw && typeof footerRaw === 'object' && !Array.isArray(footerRaw)) {
    const f = footerRaw as Record<string, unknown>;
    const footerMode = mode(f.mode);
    if (footerMode) {
      config.footer = {
        mode: footerMode,
        variant: variant(f.variant, FOOTER_VARIANTS),
        navigationMenuKey: text(f.navigationMenuKey, 100) ?? null,
        footerCtaVisible: bool(f.footerCtaVisible),
        counsellingCtaVisible: bool(f.counsellingCtaVisible),
      };
    }
  }

  return config.header || config.footer ? config : null;
}

/** A block set to USE_GLOBAL carries no opinion, so it must not shadow a
 * template-level override that does. Only HIDE and ALTERNATE_VARIANT count as
 * "the page has decided". */
function decides(block?: HeaderOverride | FooterOverride) {
  return Boolean(block && block.mode !== 'USE_GLOBAL');
}

export type ResolvedChrome = {
  header: HeaderOverride & { source: 'page' | 'template' | 'global' };
  footer: FooterOverride & { source: 'page' | 'template' | 'global' };
};

/** Applies the precedence rule. Kept pure and free of Prisma so the ordering
 * can be unit-tested without a database. */
export function resolveChrome(
  pageConfig: ChromeConfig | null,
  templateConfig: ChromeConfig | null,
): ResolvedChrome {
  const header = decides(pageConfig?.header)
    ? { ...(pageConfig!.header as HeaderOverride), source: 'page' as const }
    : decides(templateConfig?.header)
      ? {
          ...(templateConfig!.header as HeaderOverride),
          source: 'template' as const,
        }
      : { mode: 'USE_GLOBAL' as ChromeMode, source: 'global' as const };

  const footer = decides(pageConfig?.footer)
    ? { ...(pageConfig!.footer as FooterOverride), source: 'page' as const }
    : decides(templateConfig?.footer)
      ? {
          ...(templateConfig!.footer as FooterOverride),
          source: 'template' as const,
        }
      : { mode: 'USE_GLOBAL' as ChromeMode, source: 'global' as const };

  return { header, footer };
}

/** Maps a public URL path to the PageTemplate that renders it.
 *
 * Dynamic detail routes have no Page record of their own -- they are rendered
 * from a template plus an entity -- so the only place a per-route override can
 * live is the template. Patterns are explicit rather than derived from the
 * Website Pages registry, whose `publicPath` for a template is only a
 * representative example URL and would mis-match here.
 *
 * Order matters: the longest/most specific pattern must come first. */
const TEMPLATE_ROUTES: Array<{ pattern: RegExp; templateKey: string }> = [
  {
    pattern: /^\/universities\/[^/]+\/courses\/[^/]+$/,
    templateKey: 'university-course-offering',
  },
  {
    pattern: /^\/universities\/[^/]+\/courses$/,
    templateKey: 'university-courses',
  },
  { pattern: /^\/universities\/[^/]+$/, templateKey: 'university-detail' },
  {
    pattern: /^\/subjects\/[^/]+\/specializations$/,
    templateKey: 'specialization-listing',
  },
  { pattern: /^\/subjects\/[^/]+$/, templateKey: 'subject-detail' },
  { pattern: /^\/study-in\/[^/]+\/[^/]+$/, templateKey: 'city-detail' },
  { pattern: /^\/study-in\/[^/]+$/, templateKey: 'country-detail' },
  { pattern: /^\/countries\/[^/]+$/, templateKey: 'country-detail' },
  { pattern: /^\/courses\/[^/]+$/, templateKey: 'course-detail' },
  { pattern: /^\/scholarships\/[^/]+$/, templateKey: 'scholarship-detail' },
  {
    pattern: /^\/study-abroad-consultants\/locations\/[^/]+$/,
    templateKey: 'consultant-location',
  },
  {
    pattern: /^\/study-abroad-consultants\/[^/]+$/,
    templateKey: 'consultant-detail',
  },
  { pattern: /^\/careers\/[^/]+$/, templateKey: 'job-detail' },
  { pattern: /^\/events\/[^/]+$/, templateKey: 'event-detail' },
];

/** Public routes backed by a managed CMS Page.
 *
 * The Page supplies editorial framing and chrome overrides for the route; it
 * is not itself a URL. Keys here are the real public paths, values the Page
 * slugs registered by the Website Builder registry. */
const PAGE_ROUTES: Record<string, string> = {
  '/': 'home',
  '/about': 'about',
  '/faq': 'faq',
  '/contact': 'contact',
  '/counselling': 'counselling',
  '/countries': 'countries',
  '/cities': 'cities-listing',
  '/universities': 'universities-listing',
  '/subjects': 'subjects-listing',
  '/courses': 'courses-listing',
  '/scholarships': 'scholarships-listing',
  '/study-abroad-consultants': 'consultants-listing',
  '/success-stories': 'success-stories-listing',
  '/testimonials': 'testimonials-listing',
  '/careers': 'careers-listing',
  '/events': 'events-listing',
  '/compare/countries': 'compare-countries',
  '/compare/universities': 'compare-universities',
  '/compare/courses': 'compare-courses',
  '/compare/consultants': 'compare-consultants',
};

export function templateKeyForPath(path: string): string | null {
  const clean = normalisePath(path);
  return (
    TEMPLATE_ROUTES.find((route) => route.pattern.test(clean))?.templateKey ??
    null
  );
}

export function pageSlugForPath(path: string): string | null {
  return PAGE_ROUTES[normalisePath(path)] ?? null;
}

/** Strips the query string and any trailing slash so "/about?x=1" and
 * "/about/" resolve the same way as "/about". */
export function normalisePath(path: string): string {
  const withoutQuery = (path ?? '/').split('?')[0].split('#')[0];
  if (withoutQuery.length > 1 && withoutQuery.endsWith('/'))
    return withoutQuery.slice(0, -1);
  return withoutQuery || '/';
}
