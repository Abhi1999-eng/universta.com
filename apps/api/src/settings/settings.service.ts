import { BadRequestException, Injectable } from '@nestjs/common';
import {
  parseChromeConfig,
  pageSlugForPath,
  resolveChrome,
  templateKeyForPath,
  type ChromeConfig,
} from './chrome-overrides';
import type { Prisma } from '../generated/prisma/client';
import { ExpandedService } from '../expanded/expanded.service';
import { PrismaService } from '../prisma/prisma.service';
import { StructuredLogger } from '../common/structured-logger.service';

/** Every "General platform configuration" screen the client asked for maps
 * to exactly one SiteSetting row per group (settingKey === group name),
 * each holding a small JSON object -- not one row per field. This keeps the
 * schema untouched (SiteSetting already existed, unused) while the admin
 * form still never asks anyone to type raw JSON: the group object shape is
 * owned and validated entirely by this service. */
export const SETTINGS_GROUPS = [
  'general',
  'branding',
  'contact',
  'social',
  'header',
  'footer',
  'seo',
] as const;
export type SettingsGroup = (typeof SETTINGS_GROUPS)[number];

const DEFAULTS: Record<SettingsGroup, Record<string, unknown>> = {
  general: {
    siteName: 'Universta',
    defaultLocale: 'en',
    defaultTimezone: 'America/Toronto',
    supportEmail: 'support@universta.local',
    supportPhone: '',
  },
  branding: {
    logoMediaId: null,
    faviconMediaId: null,
    primaryColor: '#1657CF',
    secondaryColor: '#0D1524',
    defaultSocialImageMediaId: null,
  },
  contact: {
    address: '',
    email: 'hello@universta.local',
    counsellingPhone: '',
    whatsappLink: '',
  },
  social: {
    facebook: '',
    instagram: '',
    linkedin: '',
    youtube: '',
    twitter: '',
  },
  header: {
    ctaLabel: 'Book free counselling',
    ctaUrl: '/counselling',
    ctaVisible: true,
    menuKey: 'header',
    sticky: true,
    announcementText: '',
    announcementUrl: '',
    announcementVisible: false,
    /** Deliberately blank by default. The client asked for a configurable
     * account CTA that stays hidden until an approved destination exists;
     * no student-account feature is implemented behind this field. */
    accountCtaLabel: '',
    accountCtaUrl: '',
  },
  footer: {
    description:
      'Published study-abroad information, maintained as source-aware local Phase 1 content.',
    copyrightText: `© ${new Date().getFullYear()} Universta. All rights reserved.`,
    privacyUrl: '',
    termsUrl: '',
    menuKey: 'footer',
    showContact: true,
    showSocial: true,
    counsellingCtaLabel: 'Book free counselling',
    counsellingCtaUrl: '/counselling',
    counsellingCtaVisible: true,
  },
  seo: {
    defaultTitleSuffix: '| Universta',
    defaultDescription:
      'Explore local published study-abroad information without invented claims.',
    defaultOgImageMediaId: null,
    defaultRobotsIndex: true,
    defaultRobotsFollow: true,
  },
};

const SAFE_URL = /^(\/[^\s]*|https:\/\/[^\s]+)$/;

function assertSafeUrl(value: unknown, field: string) {
  if (typeof value !== 'string' || value.trim() === '') return;
  if (!SAFE_URL.test(value.trim()))
    throw new BadRequestException({
      code: 'UNSAFE_URL',
      message: `${field} must be a site-relative path or an https:// URL`,
      details: null,
    });
}

function sanitizeGroup(group: SettingsGroup, body: Record<string, unknown>) {
  const merged = { ...DEFAULTS[group], ...body };
  if (group === 'header') {
    assertSafeUrl(merged.ctaUrl, 'ctaUrl');
    assertSafeUrl(merged.announcementUrl, 'announcementUrl');
    assertSafeUrl(merged.accountCtaUrl, 'accountCtaUrl');
  }
  if (group === 'footer') {
    assertSafeUrl(merged.privacyUrl, 'privacyUrl');
    assertSafeUrl(merged.termsUrl, 'termsUrl');
    assertSafeUrl(merged.counsellingCtaUrl, 'counsellingCtaUrl');
  }
  if (group === 'contact') assertSafeUrl(merged.whatsappLink, 'whatsappLink');
  for (const key of [
    'facebook',
    'instagram',
    'linkedin',
    'youtube',
    'twitter',
  ]) {
    if (group === 'social' && merged[key]) assertSafeUrl(merged[key], key);
  }
  return merged;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: StructuredLogger,
  ) {}

  async adminGetAll() {
    const rows = await this.prisma.siteSetting.findMany({
      where: { settingKey: { in: [...SETTINGS_GROUPS] } },
    });
    const byKey = new Map(rows.map((row) => [row.settingKey, row]));
    return SETTINGS_GROUPS.map((group) => {
      const row = byKey.get(group);
      return {
        group,
        values: { ...DEFAULTS[group], ...((row?.valueJson as object) ?? {}) },
        updatedAt: row?.updatedAt ?? null,
      };
    });
  }

  async publicGetAll() {
    const rows = await this.prisma.siteSetting.findMany({
      where: { settingKey: { in: [...SETTINGS_GROUPS] }, isPublic: true },
    });
    const byKey = new Map(rows.map((row) => [row.settingKey, row]));
    const result: Record<string, Record<string, unknown>> = {};
    for (const group of SETTINGS_GROUPS)
      result[group] = {
        ...DEFAULTS[group],
        ...((byKey.get(group)?.valueJson as object) ?? {}),
      };
    return result;
  }

  /** One call that returns everything the public Header and Footer need.
   * Every public page renders both, so composing them server-side here keeps
   * each page to a single chrome round-trip instead of three. */
  /** Resolves the chrome for one public path.
   *
   * `path` is optional so an existing caller that wants the plain global
   * chrome keeps working unchanged; when it is supplied, any Page-level or
   * Template-level override for that route is applied on top. */
  async publicChrome(path?: string) {
    const settings = await this.publicGetAll();
    const chrome = await this.resolveChromeForPath(path);
    const globalHeaderKey =
      typeof settings.header?.menuKey === 'string' && settings.header.menuKey
        ? settings.header.menuKey
        : 'header';
    const globalFooterKey =
      typeof settings.footer?.menuKey === 'string' && settings.footer.menuKey
        ? settings.footer.menuKey
        : 'footer';
    // An alternate variant may swap in a different Admin-managed menu. It is
    // still an Admin-managed NavigationMenu -- the override picks which one,
    // it never supplies its own links.
    const headerKey = chrome.header.navigationMenuKey || globalHeaderKey;
    const footerKey = chrome.footer.navigationMenuKey || globalFooterKey;
    // Fetched without the status filter so a menu that exists but is
    // INACTIVE can be told apart from one that was never created -- the
    // public site previously rendered both as an empty nav with nothing in
    // the logs, which is exactly how the header menu sat empty in production
    // for hours after an unrelated change deactivated it.
    const allMenus = await this.prisma.navigationMenu.findMany({
      where: { menuKey: { in: [headerKey, footerKey] } },
      include: {
        items: {
          where: { status: 'ACTIVE' },
          orderBy: { displayOrder: 'asc' },
          include: { page: { select: { slug: true } } },
        },
      },
    });
    for (const key of [headerKey, footerKey]) {
      const menu = allMenus.find((row) => row.menuKey === key);
      if (menu && menu.status !== 'ACTIVE') {
        this.logger.logError('site chrome menu resolved to an inactive menu', {
          menuKey: key,
          menuId: menu.id,
          status: menu.status,
        });
      }
    }
    const treeFor = (key: string) => {
      const menu = allMenus.find(
        (row) => row.menuKey === key && row.status === 'ACTIVE',
      );
      return menu ? ExpandedService.navigationTree(menu.items) : [];
    };
    return {
      settings,
      headerMenu: treeFor(headerKey),
      footerMenu: treeFor(footerKey),
      chrome,
    };
  }

  /** Looks up the Page and/or PageTemplate that owns a public path and applies
   * the documented precedence. A path that matches nothing resolves to the
   * global chrome, which is also what a deleted or unparseable override
   * degrades to. */
  private async resolveChromeForPath(path?: string) {
    if (!path) return resolveChrome(null, null);
    const slug = pageSlugForPath(path);
    const templateKeyFromRoute = templateKeyForPath(path);

    let pageConfig: ChromeConfig | null = null;
    let templateKey: string | null = templateKeyFromRoute;

    if (slug) {
      const page = await this.prisma.page.findFirst({
        where: { slug, deletedAt: null },
        select: {
          chromeConfigJson: true,
          template: { select: { templateKey: true, deletedAt: true } },
        },
      });
      pageConfig = parseChromeConfig(page?.chromeConfigJson);
      // A Page's assigned template supplies the fallback layer. A soft-deleted
      // template is ignored rather than trusted.
      if (page?.template && !page.template.deletedAt)
        templateKey = page.template.templateKey;
    }

    let templateConfig: ChromeConfig | null = null;
    if (templateKey) {
      const template = await this.prisma.pageTemplate.findFirst({
        where: { templateKey, deletedAt: null },
        select: { chromeConfigJson: true },
      });
      templateConfig = parseChromeConfig(template?.chromeConfigJson);
    }

    const resolved = resolveChrome(pageConfig, templateConfig);
    // An alternate variant may name a navigation menu. If that menu has since
    // been deleted or deactivated, fall back to the global menu rather than
    // rendering a header with no links.
    for (const block of [resolved.header, resolved.footer]) {
      if (!block.navigationMenuKey) continue;
      const exists = await this.prisma.navigationMenu.count({
        where: { menuKey: block.navigationMenuKey, status: 'ACTIVE' },
      });
      if (!exists) block.navigationMenuKey = null;
    }
    return resolved;
  }

  async update(
    group: string,
    body: Record<string, unknown>,
    actorUserId?: string,
  ) {
    if (!SETTINGS_GROUPS.includes(group as SettingsGroup))
      throw new BadRequestException({
        code: 'UNKNOWN_SETTINGS_GROUP',
        message: `Unknown settings group "${group}"`,
        details: null,
      });
    const values = sanitizeGroup(group as SettingsGroup, body);
    const valueJson = values as unknown as Prisma.InputJsonValue;
    const row = await this.prisma.siteSetting.upsert({
      where: { settingKey: group },
      update: { valueJson, updatedByUserId: actorUserId ?? null },
      create: {
        settingKey: group,
        settingGroup: group,
        valueType: 'json',
        valueJson,
        isPublic: true,
        updatedByUserId: actorUserId ?? null,
      },
    });
    return { group, values: row.valueJson, updatedAt: row.updatedAt };
  }
}
