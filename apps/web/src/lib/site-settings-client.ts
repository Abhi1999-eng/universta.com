"use client";

import { useEffect, useState } from "react";

export type SiteSettings = {
  general: { siteName: string; supportEmail: string; supportPhone: string };
  footer: { description: string; copyrightText: string; privacyUrl: string; termsUrl: string };
  header: { ctaLabel: string; ctaUrl: string; ctaVisible: boolean };
  social: { facebook: string; instagram: string; linkedin: string; youtube: string; twitter: string };
};

/** Client components (Header/Footer render on every page) read Settings
 * through this same-origin proxy rather than needing a NEXT_PUBLIC_ API URL
 * baked into the browser bundle. Returns null until loaded; callers should
 * keep their existing hardcoded copy as the value shown before that. */
export function useSiteSettings(): SiteSettings | null {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((response) => response.json())
      .then((body: { data?: SiteSettings }) => {
        if (!cancelled && body.data) setSettings(body.data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return settings;
}
