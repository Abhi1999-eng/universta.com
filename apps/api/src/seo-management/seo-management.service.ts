import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import {
  SEO_BULK_ENTITY_TYPES,
  SEO_ENTITY_DEFINITIONS,
  SEO_TEMPLATE_TEXT_FIELDS,
  type SeoBulkEntityType,
  type SeoManualMetadata,
  type SeoTemplateInput,
} from './seo-management.types';

type RecordData = Record<string, unknown>;
type TemplateRow = SeoTemplateInput & { entityType: string };

const TEMPLATE_LIMITS: Record<
  (typeof SEO_TEMPLATE_TEXT_FIELDS)[number],
  number
> = {
  seoTitleTemplate: 255,
  metaDescriptionTemplate: 500,
  ogTitleTemplate: 255,
  ogDescriptionTemplate: 500,
  canonicalTemplate: 2048,
};
const SAFE_CANONICAL = /^(\/(?!\/)[^\s]*|https:\/\/[^\s]+)$/;
const GOOGLE_TOKEN = /^[A-Za-z0-9._-]{6,255}$/;

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function nested(record: RecordData, key: string): RecordData | null {
  const value = record[key];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordData)
    : null;
}
function firstNested(
  record: RecordData,
  key: string,
  nestedKey: string,
): RecordData | null {
  const values = record[key];
  if (!Array.isArray(values) || values.length === 0) return null;
  const first = values[0];
  return first && typeof first === 'object'
    ? nested(first as RecordData, nestedKey)
    : null;
}
function directString(record: RecordData | null, key: string): string | null {
  return record ? text(record[key]) : null;
}
function media(value: SeoManualMetadata['ogMedia']) {
  const url = text(value?.publicUrl) ?? text(value?.url);
  if (!url) return null;
  return { url, alt: text(value?.altText) ?? text(value?.alt) };
}
function cleanRendered(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s+([,;:|])/g, '$1')
    .replace(/\b(?:in|at|for)\s*(?=[,;:|]|$)/gi, '')
    .replace(/\s+([,;:|])/g, '$1')
    .replace(/([,;:|])\s*(?=[,;:|]|$)/g, '')
    .replace(/\(\s*\)/g, '')
    .trim();
}

@Injectable()
export class SeoManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  definitionOrThrow(entityType: string) {
    const definition = SEO_ENTITY_DEFINITIONS.find(
      (candidate) => candidate.key === entityType,
    );
    if (!definition)
      throw new NotFoundException({
        code: 'SEO_ENTITY_TYPE_NOT_SUPPORTED',
        message: 'This public entity type does not support bulk SEO',
        details: null,
      });
    return definition;
  }

  async adminTemplates() {
    const rows = await this.prisma.seoBulkTemplate.findMany();
    const byType = new Map(rows.map((row) => [row.entityType, row]));
    return SEO_ENTITY_DEFINITIONS.map((definition) => ({
      ...definition,
      template: byType.get(definition.key) ?? null,
    }));
  }

  async saveTemplate(entityType: string, input: SeoTemplateInput) {
    this.definitionOrThrow(entityType);
    const value = this.validateTemplate(entityType as SeoBulkEntityType, input);
    return this.prisma.seoBulkTemplate.upsert({
      where: { entityType },
      create: { entityType, ...value },
      update: value,
    });
  }

  async preview(entityType: string, input: SeoTemplateInput) {
    this.definitionOrThrow(entityType);
    const template = this.validateTemplate(
      entityType as SeoBulkEntityType,
      input,
    );
    const record = await this.previewRecord(entityType as SeoBulkEntityType);
    if (!record)
      return {
        record: null,
        resolved: null,
        message: 'No published record is available for a live preview yet.',
      };
    return {
      record: {
        id: String(record.id),
        label: this.fallbackTitle(entityType as SeoBulkEntityType, record),
      },
      resolved: await this.resolve(
        entityType as SeoBulkEntityType,
        record,
        null,
        template,
      ),
      message: null,
    };
  }

  async siteVerification() {
    const row = await this.prisma.siteSetting.findUnique({
      where: { settingKey: 'seo-site-verification' },
    });
    const value = (row?.valueJson ?? {}) as RecordData;
    return { google: text(value.google) };
  }

  async publicDefaults() {
    const settings = await this.settings.publicGetAll();
    const seo = settings.seo ?? {};
    return {
      defaultTitleSuffix: text(seo.defaultTitleSuffix) ?? '| Universta',
      defaultDescription: text(seo.defaultDescription),
      defaultRobotsIndex: seo.defaultRobotsIndex !== false,
      defaultRobotsFollow: seo.defaultRobotsFollow !== false,
      defaultOgImage: await this.defaultImage(seo.defaultOgImageMediaId),
    };
  }

  async saveSiteVerification(body: RecordData, updatedByUserId?: string) {
    const raw = body.google;
    if (
      raw !== null &&
      raw !== undefined &&
      (typeof raw !== 'string' ||
        (raw.trim() && !GOOGLE_TOKEN.test(raw.trim())))
    )
      throw new BadRequestException({
        code: 'INVALID_SITE_VERIFICATION_TOKEN',
        message:
          'Google verification must be the token value only, without HTML or a meta tag.',
        details: null,
      });
    const google = text(raw);
    await this.prisma.siteSetting.upsert({
      where: { settingKey: 'seo-site-verification' },
      create: {
        settingKey: 'seo-site-verification',
        settingGroup: 'seo',
        valueType: 'JSON',
        valueJson: { google },
        description: 'Search engine verification tokens',
        isPublic: true,
        updatedByUserId: updatedByUserId ?? null,
      },
      update: {
        valueJson: { google },
        isPublic: true,
        updatedByUserId: updatedByUserId ?? null,
      },
    });
    return { google };
  }

  /** The single precedence implementation used by every public entity path.
   * Templates are read, rendered and returned here; entity SEO rows are never
   * written as a side effect. */
  async resolve(
    entityType: SeoBulkEntityType,
    record: RecordData,
    manual: SeoManualMetadata | null | undefined,
    suppliedTemplate?: SeoTemplateInput | null,
  ) {
    this.definitionOrThrow(entityType);
    const [defaults, storedTemplate] = await Promise.all([
      this.settings.publicGetAll(),
      suppliedTemplate === undefined
        ? this.prisma.seoBulkTemplate.findUnique({ where: { entityType } })
        : Promise.resolve(suppliedTemplate),
    ]);
    const template = storedTemplate as TemplateRow | null;
    const variables = this.variables(entityType, record);
    const fallbackTitle = this.fallbackTitle(entityType, record);
    const fallbackDescription = this.fallbackDescription(record, fallbackTitle);
    const defaultSeo = defaults.seo ?? {};
    const suffix = text(defaultSeo.defaultTitleSuffix) ?? '| Universta';
    const renderedTitle = this.render(template?.seoTitleTemplate, variables);
    const renderedDescription = this.render(
      template?.metaDescriptionTemplate,
      variables,
    );
    const renderedOgTitle = this.render(template?.ogTitleTemplate, variables);
    const renderedOgDescription = this.render(
      template?.ogDescriptionTemplate,
      variables,
    );
    const renderedCanonical = this.render(
      template?.canonicalTemplate,
      variables,
    );
    const defaultImage = await this.defaultImage(
      defaultSeo.defaultOgImageMediaId,
    );

    const manualTitle = text(manual?.seoTitle);
    const manualDescription = text(manual?.metaDescription);
    const manualCanonical = text(manual?.canonicalUrl);
    const manualOgTitle = text(manual?.ogTitle);
    const manualOgDescription = text(manual?.ogDescription);
    return {
      seoTitle: manualTitle ?? renderedTitle ?? fallbackTitle,
      metaDescription:
        manualDescription ??
        renderedDescription ??
        text(defaultSeo.defaultDescription) ??
        fallbackDescription,
      canonicalUrl:
        manualCanonical ??
        (renderedCanonical && SAFE_CANONICAL.test(renderedCanonical)
          ? renderedCanonical
          : this.canonical(entityType, record)),
      ogTitle:
        manualOgTitle ??
        renderedOgTitle ??
        manualTitle ??
        renderedTitle ??
        fallbackTitle,
      ogDescription:
        manualOgDescription ??
        renderedOgDescription ??
        manualDescription ??
        renderedDescription ??
        text(defaultSeo.defaultDescription) ??
        fallbackDescription,
      ogMedia: media(manual?.ogMedia) ?? defaultImage,
      twitterTitle:
        text(manual?.twitterTitle) ??
        manualOgTitle ??
        renderedOgTitle ??
        renderedTitle ??
        fallbackTitle,
      twitterDescription:
        text(manual?.twitterDescription) ??
        manualOgDescription ??
        renderedOgDescription ??
        renderedDescription ??
        text(defaultSeo.defaultDescription) ??
        fallbackDescription,
      twitterMedia: media(manual?.twitterMedia) ?? defaultImage,
      robotsIndex:
        typeof manual?.robotsIndex === 'boolean'
          ? manual.robotsIndex
          : typeof template?.robotsIndex === 'boolean'
            ? template.robotsIndex
            : defaultSeo.defaultRobotsIndex !== false,
      robotsFollow:
        typeof manual?.robotsFollow === 'boolean'
          ? manual.robotsFollow
          : typeof template?.robotsFollow === 'boolean'
            ? template.robotsFollow
            : defaultSeo.defaultRobotsFollow !== false,
      titleSuffix: suffix,
      source: {
        title: manualTitle ? 'manual' : renderedTitle ? 'bulk' : 'fallback',
        description: manualDescription
          ? 'manual'
          : renderedDescription
            ? 'bulk'
            : text(defaultSeo.defaultDescription)
              ? 'default'
              : 'fallback',
      },
    };
  }

  private validateTemplate(
    entityType: SeoBulkEntityType,
    input: SeoTemplateInput,
  ) {
    const allowed = new Set(
      this.definitionOrThrow(entityType).variables.map(
        (variable) => variable.key,
      ),
    );
    const output: SeoTemplateInput = {};
    for (const field of SEO_TEMPLATE_TEXT_FIELDS) {
      const value = input[field];
      if (value === undefined) continue;
      if (value !== null && typeof value !== 'string')
        throw this.templateError('SEO template fields must be text values.');
      const normalized = text(value);
      if (normalized && normalized.length > TEMPLATE_LIMITS[field])
        throw this.templateError(`${field} is too long.`);
      if (normalized && /[<>]|javascript:|data:/i.test(normalized))
        throw this.templateError(
          'SEO templates cannot contain HTML or script URLs.',
        );
      if (normalized) this.validateTokens(normalized, allowed);
      if (
        field === 'canonicalTemplate' &&
        normalized &&
        !SAFE_CANONICAL.test(
          normalized.replace(/\{[A-Za-z][A-Za-z0-9]*\}/g, 'value'),
        )
      )
        throw this.templateError(
          'Canonical templates must be a site-relative path or https URL.',
        );
      output[field] = normalized;
    }
    for (const field of ['robotsIndex', 'robotsFollow'] as const) {
      const value = input[field];
      if (value !== undefined && value !== null && typeof value !== 'boolean')
        throw this.templateError(`${field} must be true, false, or inherited.`);
      output[field] = value ?? null;
    }
    if (!output.seoTitleTemplate && !output.metaDescriptionTemplate)
      throw this.templateError(
        'Provide at least an SEO title or meta description template.',
      );
    return output;
  }

  private validateTokens(value: string, allowed: Set<string>) {
    const malformed = value.match(/[{}]/g);
    const tokens = [...value.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g)];
    if ((malformed?.length ?? 0) !== tokens.length * 2)
      throw this.templateError('Use variables in the form {variableName}.');
    for (const token of tokens)
      if (!allowed.has(token[1]))
        throw this.templateError(`Unknown SEO variable: {${token[1]}}.`);
  }

  private templateError(message: string) {
    return new BadRequestException({
      code: 'INVALID_SEO_TEMPLATE',
      message,
      details: null,
    });
  }

  private render(
    template: string | null | undefined,
    variables: Record<string, string | null>,
  ) {
    const source = text(template);
    if (!source) return null;
    const rendered = cleanRendered(
      source.replace(
        /\{([A-Za-z][A-Za-z0-9]*)\}/g,
        (_, key: string) => variables[key] ?? '',
      ),
    );
    return rendered || null;
  }

  private variables(entityType: SeoBulkEntityType, record: RecordData) {
    const country = nested(record, 'country');
    const university = nested(record, 'university');
    const genericCourse = nested(record, 'genericCourse');
    const courseLevel =
      nested(record, 'courseLevel') ??
      nested(genericCourse ?? {}, 'courseLevel');
    const subject =
      nested(record, 'subject') ?? nested(genericCourse ?? {}, 'subject');
    const campus = nested(record, 'campus');
    const provider = nested(record, 'provider');
    const firstCountry = firstNested(record, 'countries', 'country');
    const firstUniversity = firstNested(record, 'universities', 'university');
    const firstLocation = firstNested(record, 'locations', 'location');
    const storyOffering = nested(record, 'offering');
    const storyUniversity =
      nested(record, 'university') ?? nested(storyOffering ?? {}, 'university');
    const storyCountry =
      nested(record, 'country') ?? nested(storyUniversity ?? {}, 'country');
    const values: Record<string, string | null> = {
      countryName:
        directString(country, 'name') ??
        directString(firstCountry, 'name') ??
        directString(storyCountry, 'name'),
      cityName:
        directString(record, 'city') ??
        directString(campus, 'city') ??
        directString(firstLocation, 'city') ??
        directString(nested(record, 'city'), 'name'),
      universityName:
        directString(university, 'name') ??
        directString(firstUniversity, 'name') ??
        directString(storyUniversity, 'name'),
      courseName:
        directString(genericCourse, 'name') ??
        directString(record, 'name') ??
        directString(storyOffering, 'name'),
      subjectName: directString(subject, 'name'),
      degreeLevel: directString(courseLevel, 'name'),
      scholarshipTitle: directString(record, 'title'),
      providerName: directString(provider, 'name'),
      consultantName: directString(record, 'name'),
      locationName: directString(record, 'name'),
      jobTitle: directString(record, 'title'),
      departmentName: directString(record, 'department'),
      eventTitle: directString(record, 'title'),
      storyTitle: directString(record, 'title'),
      countrySlug:
        directString(country, 'slug') ??
        directString(firstCountry, 'slug') ??
        directString(storyCountry, 'slug'),
      citySlug: directString(record, 'slug'),
      subjectSlug:
        directString(subject, 'slug') ?? directString(record, 'slug'),
      courseSlug:
        directString(genericCourse, 'slug') ?? directString(record, 'slug'),
      universitySlug:
        directString(university, 'slug') ??
        directString(firstUniversity, 'slug') ??
        directString(storyUniversity, 'slug'),
      offeringSlug: directString(record, 'slug'),
      scholarshipSlug: directString(record, 'slug'),
      consultantSlug: directString(record, 'slug'),
      consultantLocationSlug: directString(record, 'slug'),
      jobSlug: directString(record, 'slug'),
      eventSlug: directString(record, 'slug'),
      successStorySlug: directString(record, 'slug'),
    };
    if (entityType === 'country') {
      values.countryName = directString(record, 'name');
      values.countrySlug = directString(record, 'slug');
    }
    if (entityType === 'city') {
      values.cityName = directString(record, 'name');
      values.citySlug = directString(record, 'slug');
    }
    if (entityType === 'subject') {
      values.subjectName = directString(record, 'name');
      values.subjectSlug = directString(record, 'slug');
    }
    if (entityType === 'course')
      values.courseSlug = directString(record, 'slug');
    if (entityType === 'university') {
      values.universityName = directString(record, 'name');
      values.universitySlug = directString(record, 'slug');
    }
    return values;
  }

  private fallbackTitle(entityType: SeoBulkEntityType, record: RecordData) {
    const byType: Partial<Record<SeoBulkEntityType, string | null>> = {
      country:
        directString(record, 'pageHeading') ?? directString(record, 'name'),
      city: directString(record, 'name'),
      subject: directString(record, 'name'),
      course: directString(record, 'name'),
      university: directString(record, 'name'),
      offering: directString(record, 'name'),
      scholarship: directString(record, 'title'),
      consultant: directString(record, 'name'),
      consultantLocation: directString(record, 'name'),
      job: directString(record, 'title'),
      event: directString(record, 'title'),
      successStory: directString(record, 'title'),
    };
    return byType[entityType] ?? 'Universta';
  }

  private fallbackDescription(record: RecordData, title: string) {
    return (
      text(record.shortDescription) ??
      text(record.summary) ??
      text(record.description) ??
      text(record.overview) ??
      text(record.journey) ??
      `Published information about ${title}.`
    );
  }

  private canonical(entityType: SeoBulkEntityType, record: RecordData) {
    const slug = encodeURIComponent(directString(record, 'slug') ?? '');
    const country = nested(record, 'country');
    const university = nested(record, 'university');
    switch (entityType) {
      case 'country':
        return `/countries/${slug}`;
      case 'city':
        return `/study-in/${encodeURIComponent(directString(country, 'slug') ?? '')}/${slug}`;
      case 'subject':
        return `/subjects/${slug}`;
      case 'course':
        return `/courses/${slug}`;
      case 'university':
        return `/universities/${slug}`;
      case 'offering':
        return `/universities/${encodeURIComponent(directString(university, 'slug') ?? '')}/courses/${slug}`;
      case 'scholarship':
        return `/scholarships/${slug}`;
      case 'consultant':
        return `/study-abroad-consultants/${slug}`;
      case 'consultantLocation':
        return `/study-abroad-consultants/locations/${slug}`;
      case 'job':
        return `/careers/${slug}`;
      case 'event':
        return `/events/${slug}`;
      case 'successStory':
        return `/success-stories/${slug}`;
    }
  }

  private async defaultImage(value: unknown) {
    const id = text(value);
    if (!id) return null;
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, deletedAt: null, status: 'ACTIVE' },
      select: { publicUrl: true, altText: true, title: true },
    });
    return asset?.publicUrl
      ? { url: asset.publicUrl, alt: asset.altText ?? asset.title ?? null }
      : null;
  }

  private async previewRecord(
    entityType: SeoBulkEntityType,
  ): Promise<RecordData | null> {
    const where = { status: 'PUBLISHED', deletedAt: null };
    switch (entityType) {
      case 'country':
        return this.prisma.country.findFirst({
          where,
        });
      case 'city':
        return this.prisma.city.findFirst({
          where,
          include: { country: true },
        });
      case 'subject':
        return this.prisma.subject.findFirst({
          where,
        });
      case 'course':
        return this.prisma.course.findFirst({
          where,
          include: { subject: true, courseLevel: true },
        });
      case 'university':
        return this.prisma.university.findFirst({
          where,
          include: {
            country: true,
            campuses: { orderBy: { displayOrder: 'asc' }, take: 1 },
          },
        });
      case 'offering':
        return this.prisma.universityCourseOffering.findFirst({
          where,
          include: {
            university: { include: { country: true } },
            campus: true,
            genericCourse: { include: { subject: true, courseLevel: true } },
            courseLevel: true,
          },
        });
      case 'scholarship':
        return this.prisma.scholarship.findFirst({
          where,
          include: {
            provider: true,
            countries: { include: { country: true }, take: 1 },
            universities: { include: { university: true }, take: 1 },
          },
        });
      case 'consultant':
        return this.prisma.consultant.findFirst({
          where,
          include: {
            countries: { include: { country: true }, take: 1 },
            locations: { include: { location: true }, take: 1 },
          },
        });
      case 'consultantLocation':
        return this.prisma.consultantLocation.findFirst({
          where: { status: 'ACTIVE', deletedAt: null },
          include: { country: true },
        });
      case 'job':
        return this.prisma.job.findFirst({
          where,
          include: { country: true, city: true },
        });
      case 'event':
        return this.prisma.event.findFirst({
          where,
          include: { country: true, city: true },
        });
      case 'successStory':
        return this.prisma.successStory.findFirst({
          where,
          include: {
            country: true,
            university: { include: { country: true } },
            offering: { include: { genericCourse: true, university: true } },
          },
        });
    }
  }
}

export function isSeoBulkEntityType(value: string): value is SeoBulkEntityType {
  return (SEO_BULK_ENTITY_TYPES as readonly string[]).includes(value);
}
