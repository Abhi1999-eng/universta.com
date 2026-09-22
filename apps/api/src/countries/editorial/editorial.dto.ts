import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import {
  COUNTRY_SECTION_TYPES,
  EDITORIAL_STATUSES,
} from './editorial.constants';

const integer = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

/** ISS-027. `@IsOptional()` only skips validation for `undefined` -- an
 * editor that leaves an optional field untouched still submits it as `''`
 * (every input in SeoEditor.tsx starts from '', never undefined), and `''`
 * is not a valid URL. Every save of a Country's SEO metadata without a
 * canonical URL failed with a 400 the admin UI never surfaced clearly. */
const emptyToNull = ({ value }: { value: unknown }) =>
  value === '' ? null : value;

@ValidatorConstraint({ name: 'safeCanonicalUrl', async: false })
export class SafeCanonicalUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined || value === null) return true;
    if (typeof value !== 'string' || /\s/.test(value)) return false;
    if (/^\/(?!\/)/.test(value)) return true;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      return false;
    }
  }

  defaultMessage() {
    return 'canonicalUrl must be a site path beginning with / or an absolute HTTP(S) URL';
  }
}

export class EditorialVersionDto {
  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string;
}

export class ContentSectionDto extends EditorialVersionDto {
  /* A free-text identifier, not one of a fixed set. The public page has
   * dedicated renderers for the conventional keys in `COUNTRY_SECTION_KEYS`
   * and falls back to the section type for anything else, so refusing a key
   * outside that list only stopped authors naming their own sections -- it
   * never protected the rendering. Keys stay unique per country, which the
   * database enforces and the service reports by name. */
  @IsOptional() @IsString() @MaxLength(100) sectionKey?: string;

  @IsIn(COUNTRY_SECTION_TYPES)
  sectionType!: string;

  @IsOptional() @IsString() @MaxLength(255) eyebrow?: string;
  @IsOptional() @IsString() @MaxLength(500) heading?: string;
  @IsOptional() @IsString() @MaxLength(4000) subheading?: string;
  @IsOptional() @IsObject() bodyJson?: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(36) primaryMediaId?: string;
  @IsOptional() @IsString() @MaxLength(36) secondaryMediaId?: string;
  @IsOptional() @IsString() @MaxLength(100) ctaLabel?: string;
  /* An empty string clears the link: omitting the key leaves it as it was,
     so without this a section's call to action could never be removed. */
  @IsOptional()
  @IsString()
  @ValidateIf((_, value) => value !== '')
  @Matches(/^(?:\/(?!\/)|#[a-zA-Z0-9_-]+|https:\/\/)/)
  @MaxLength(1000)
  ctaUrl?: string;
  @IsOptional() @IsObject() configurationJson?: Record<string, unknown>;
  @Transform(integer)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999999)
  displayOrder?: number;
  @IsOptional() @IsIn(EDITORIAL_STATUSES) status?: string;
}

export class FaqDto extends EditorialVersionDto {
  @IsString() @MaxLength(1000) question!: string;
  @IsString() @MaxLength(12000) answer!: string;
  @IsOptional() @IsString() @MaxLength(100) category?: string;
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @IsIn(EDITORIAL_STATUSES) status?: string;
  @Transform(integer)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999999)
  displayOrder?: number;
}

export class SeoMetadataDto extends EditorialVersionDto {
  @IsString() @MaxLength(255) seoTitle!: string;
  @IsString() @MaxLength(500) metaDescription!: string;
  @Transform(emptyToNull)
  @IsOptional()
  @Validate(SafeCanonicalUrlConstraint)
  @MaxLength(2048)
  canonicalUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(255) focusKeyword?: string;
  @IsOptional() @IsString() @MaxLength(255) ogTitle?: string;
  @IsOptional() @IsString() @MaxLength(500) ogDescription?: string;
  @IsOptional() @IsString() @MaxLength(36) ogMediaId?: string;
  @IsOptional() @IsString() @MaxLength(255) twitterTitle?: string;
  @IsOptional() @IsString() @MaxLength(500) twitterDescription?: string;
  @IsOptional() @IsString() @MaxLength(36) twitterMediaId?: string;
  @IsOptional() @IsBoolean() robotsIndex?: boolean;
  @IsOptional() @IsBoolean() robotsFollow?: boolean;
  @IsOptional() @IsObject() schemaJson?: Record<string, unknown>;
  @IsOptional() @IsObject() hreflangJson?: Record<string, unknown>;
}

export class ConsultantCardDto extends EditorialVersionDto {
  @IsString() @MaxLength(255) title!: string;
  @IsString() @MaxLength(255) slug!: string;
  @IsString() @MaxLength(1000) shortDescription!: string;
  @IsOptional() @IsString() @MaxLength(12000) overview?: string;
  @IsOptional() @IsString() @MaxLength(36) iconMediaId?: string;
  @IsOptional() @IsString() @MaxLength(36) featuredMediaId?: string;
  @IsOptional() @IsBoolean() isFreeConsultation?: boolean;
  @IsOptional() @IsString() @MaxLength(100) ctaLabel?: string;
  @IsOptional()
  @IsString()
  @Matches(/^(?:\/(?!\/)|#[a-zA-Z0-9_-]+|https:\/\/)/)
  @MaxLength(1000)
  ctaUrl?: string;
  @IsOptional() @IsIn(EDITORIAL_STATUSES) status?: string;
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @Transform(integer)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999999)
  displayOrder?: number;
  @IsOptional() @IsISO8601() publishedAt?: string;
}

export class MediaOptionsQueryDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @Transform(integer) @IsOptional() @IsInt() @Min(1) @Max(50) limit = 24;
}
