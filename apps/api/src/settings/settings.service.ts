import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
  },
  footer: {
    description:
      'Published study-abroad information, maintained as source-aware local Phase 1 content.',
    copyrightText: `© ${new Date().getFullYear()} Universta. All rights reserved.`,
    privacyUrl: '',
    termsUrl: '',
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
  if (group === 'header') assertSafeUrl(merged.ctaUrl, 'ctaUrl');
  if (group === 'footer') {
    assertSafeUrl(merged.privacyUrl, 'privacyUrl');
    assertSafeUrl(merged.termsUrl, 'termsUrl');
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
  constructor(private readonly prisma: PrismaService) {}

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
