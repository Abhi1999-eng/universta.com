/** Types and server-side loader for the Admin-managed public Header/Footer.
 *
 * Every public page renders the same chrome, and all of it (navigation trees,
 * CTA labels/destinations, announcement bar, footer columns, contact and
 * social links) is owned by Admin -- Website Builder > Global Header / Global
 * Footer / Navigation Menus. Nothing here hardcodes a link list. */

export type NavNode = {
  id: string;
  label: string;
  href: string | null;
  openInNewTab: boolean;
  children?: NavNode[];
};

/** The resolved per-route Header/Footer override, already merged by the API
 * according to Page -> assigned Template -> Global precedence. `source` says
 * which layer won, which is what the Admin surfaces back to the editor. */
export type ChromeOverride = {
  header: {
    mode: 'USE_GLOBAL' | 'HIDE' | 'ALTERNATE_VARIANT';
    variant?: string;
    navigationMenuKey?: string | null;
    announcementVisible?: boolean;
    ctaVisible?: boolean;
    ctaLabel?: string;
    ctaUrl?: string;
    source: 'page' | 'template' | 'global';
  };
  footer: {
    mode: 'USE_GLOBAL' | 'HIDE' | 'ALTERNATE_VARIANT';
    variant?: string;
    navigationMenuKey?: string | null;
    footerCtaVisible?: boolean;
    counsellingCtaVisible?: boolean;
    source: 'page' | 'template' | 'global';
  };
};

export type SiteChrome = {
  headerMenu: NavNode[];
  footerMenu: NavNode[];
  chrome?: ChromeOverride;
  settings: {
    general: { siteName?: string };
    branding: { logoMediaId?: string | null };
    contact: {
      address?: string;
      email?: string;
      counsellingPhone?: string;
      whatsappLink?: string;
    };
    social: Record<string, string>;
    header: {
      ctaLabel?: string;
      ctaUrl?: string;
      ctaVisible?: boolean;
      sticky?: boolean;
      announcementText?: string;
      announcementUrl?: string;
      announcementVisible?: boolean;
      accountCtaLabel?: string;
      accountCtaUrl?: string;
    };
    footer: {
      description?: string;
      copyrightText?: string;
      privacyUrl?: string;
      termsUrl?: string;
      showContact?: boolean;
      showSocial?: boolean;
      counsellingCtaLabel?: string;
      counsellingCtaUrl?: string;
      counsellingCtaVisible?: boolean;
      /** Rows/blocks the admin composed. Absent means the original fixed
       * footer layout, which is what every unedited site still renders. */
      layoutJson?: unknown;
    };
  };
};

const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

/** Rendered on every public page, so a chrome outage must degrade to an empty
 * (but still valid) header/footer rather than take the whole page down. */
export const GLOBAL_ONLY: ChromeOverride = {
  header: { mode: 'USE_GLOBAL', source: 'global' },
  footer: { mode: 'USE_GLOBAL', source: 'global' },
};

export const EMPTY_CHROME: SiteChrome = {
  headerMenu: [],
  footerMenu: [],
  chrome: GLOBAL_ONLY,
  settings: {
    general: {},
    branding: {},
    contact: {},
    social: {},
    header: {},
    footer: {},
  },
};

/** `path` lets the API apply any Page- or Template-level override for that
 * route. Omitting it yields the plain global chrome. */
export async function getSiteChrome(path?: string): Promise<SiteChrome> {
  try {
    const url = new URL("/api/v1/phase1/site-chrome", baseUrl);
    if (path) url.searchParams.set("path", path);
    const response = await fetch(url, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!response.ok) return EMPTY_CHROME;
    const body = (await response.json()) as { data: SiteChrome | null };
    if (!body.data) return EMPTY_CHROME;
    return { ...body.data, chrome: body.data.chrome ?? GLOBAL_ONLY };
  } catch {
    return EMPTY_CHROME;
  }
}
