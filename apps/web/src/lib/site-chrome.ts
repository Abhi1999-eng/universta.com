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

export type SiteChrome = {
  headerMenu: NavNode[];
  footerMenu: NavNode[];
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
    };
  };
};

const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

/** Rendered on every public page, so a chrome outage must degrade to an empty
 * (but still valid) header/footer rather than take the whole page down. */
export const EMPTY_CHROME: SiteChrome = {
  headerMenu: [],
  footerMenu: [],
  settings: {
    general: {},
    branding: {},
    contact: {},
    social: {},
    header: {},
    footer: {},
  },
};

export async function getSiteChrome(): Promise<SiteChrome> {
  try {
    const response = await fetch(
      new URL("/api/v1/phase1/site-chrome", baseUrl),
      { cache: "no-store", headers: { accept: "application/json" } },
    );
    if (!response.ok) return EMPTY_CHROME;
    const body = (await response.json()) as { data: SiteChrome | null };
    return body.data ?? EMPTY_CHROME;
  } catch {
    return EMPTY_CHROME;
  }
}
