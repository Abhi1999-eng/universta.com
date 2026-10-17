import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  COURSE_MAPPING_STATUSES,
  COURSE_SECTION_TYPES,
  SUB_SUBJECT_SECTION_KEYS,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  SUBJECT_STATUSES,
} from '../../catalog/catalog.constants';

const trim = ({ value }: TransformFnParams) =>
  typeof value === 'string' ? value.trim() : value;
const bool = ({ value }: TransformFnParams) =>
  value === 'true' || value === true
    ? true
    : value === 'false' || value === false
      ? false
      : value;
const num = ({ value }: TransformFnParams) =>
  value === undefined || value === '' ? value : Number(value);

export class SubjectFieldsDto {
  @ApiProperty({ example: 'Computer Science' })
  @Transform(trim)
  @IsString()
  @Length(1, 255)
  name!: string;
  @ApiPropertyOptional({ example: 'computer-science' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 255)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  shortDescription?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  overview?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  iconMediaId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  listingMediaId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  heroMediaId?: string;
  @ApiPropertyOptional()
  @Transform(bool)
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
  @ApiPropertyOptional()
  @Transform(num)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999999)
  displayOrder?: number;
  /** The study levels this is offered at, by course level id. Sent whole:
   * the list replaces what was ticked before. */
  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  courseLevelIds?: string[];
}

export class CreateSubjectDto extends SubjectFieldsDto {}

export class UpdateSubjectDto extends SubjectFieldsDto {
  @ApiPropertyOptional() @IsOptional() @IsISO8601() expectedUpdatedAt?: string;
}

export class SubjectActionDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @Transform(trim)
  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string;
}

export class SpecializationListQueryDto {
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /** Narrows to one subject, by slug. */
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  subject?: string;

  /** A course level code, so the flat list narrows the same way a subject's
   *  own specializations do. */
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  level?: string;

  /** Exact specialization slug, for resolving a bare /specializations/<slug>. */
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  page?: string;
}

export class SubjectListQueryDto {
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
  @ApiPropertyOptional({ enum: SUBJECT_STATUSES })
  @IsOptional()
  @IsIn(SUBJECT_STATUSES)
  status?: string;
  @ApiPropertyOptional()
  @Transform(bool)
  @IsOptional()
  @IsBoolean()
  featured?: boolean;
  @ApiPropertyOptional({
    enum: ['displayOrder', 'name', 'createdAt', 'updatedAt', 'featured'],
  })
  @IsOptional()
  @IsIn(['displayOrder', 'name', 'createdAt', 'updatedAt', 'featured'])
  sort?: string;
  @ApiPropertyOptional({ default: DEFAULT_PAGE })
  @Transform(num)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = DEFAULT_PAGE;
  @ApiPropertyOptional({ default: DEFAULT_LIMIT, maximum: MAX_LIMIT })
  @Transform(num)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit = DEFAULT_LIMIT;
}

export class SubSubjectFieldsDto {
  @ApiProperty({ example: 'Artificial Intelligence' })
  @Transform(trim)
  @IsString()
  @Length(1, 255)
  name!: string;
  @ApiPropertyOptional({ example: 'artificial-intelligence' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 255)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  shortDescription?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  overview?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  iconMediaId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  listingMediaId?: string;
  @ApiPropertyOptional()
  @Transform(bool)
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
  @ApiPropertyOptional()
  @Transform(num)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999999)
  displayOrder?: number;
  /** The study levels this is offered at, by course level id. Sent whole:
   * the list replaces what was ticked before. */
  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  courseLevelIds?: string[];
}

export class CreateSubSubjectDto extends SubSubjectFieldsDto {}
export class UpdateSubSubjectDto extends SubSubjectFieldsDto {
  @ApiPropertyOptional() @IsOptional() @IsISO8601() expectedUpdatedAt?: string;
}
export class SubSubjectListQueryDto extends SubjectListQueryDto {}
/** The cross-subject specialization list: every subject's, or one subject's
 * by its id. The parent is a filter here, not part of the address. */
export class AdminSpecializationListQueryDto extends SubjectListQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @Transform(trim)
  @IsOptional()
  @IsUUID()
  subjectId?: string;
}

export class SeoMetadataDto {
  /* The title and the description may be left out, empty or null: a row
     that only keeps a page out of search ("Robots index" unticked) is a
     real choice an editor makes, and was silently not saved while both
     were required. A row without them reads, for each, as no row does --
     the bulk template, else the page's own fallback. */
  @ApiPropertyOptional({ nullable: true })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  seoTitle?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  metaDescription?: string | null;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  canonicalUrl?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  focusKeyword?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  ogTitle?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  ogDescription?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  ogMediaId?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  twitterTitle?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  twitterDescription?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  twitterMediaId?: string;
  @ApiPropertyOptional()
  @Transform(bool)
  @IsOptional()
  @IsBoolean()
  robotsIndex?: boolean;
  @ApiPropertyOptional()
  @Transform(bool)
  @IsOptional()
  @IsBoolean()
  robotsFollow?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsObject() schemaJson?: Record<
    string,
    unknown
  >;
  @ApiPropertyOptional() @IsOptional() @IsObject() hreflangJson?: Record<
    string,
    unknown
  >;
  /** The SEO row's `updatedAt` from the last read. Null says "I saw no
   * row"; left out, no check is made. It was `@IsUUID`, so no editor could
   * send the version it had read and two sessions overwrote each other. */
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string | null;
}

/** The universities that teach one specialization, narrowed to one
 *  destination when the page asking is about one. */
export class SpecializationUniversitiesQueryDto {
  /** A destination, by slug. Absent means every published destination. */
  @ApiPropertyOptional({ example: 'united-kingdom' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  country?: string;

  /** How many to name. `meta.total` counts all of them. */
  @ApiPropertyOptional({ default: 6, minimum: 1, maximum: 50 })
  @Transform(num)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 6;
}

/** A specialization's content section: the same shape as a course's, with
 * its own set of keys. */
export class SpecializationSectionDto {
  @ApiProperty({ enum: SUB_SUBJECT_SECTION_KEYS })
  @Transform(trim)
  @IsString()
  @IsIn(SUB_SUBJECT_SECTION_KEYS)
  sectionKey!: string;
  @ApiProperty({ enum: COURSE_SECTION_TYPES })
  @IsIn(COURSE_SECTION_TYPES)
  sectionType!: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  heading?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  subheading?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() bodyJson?: Record<
    string,
    unknown
  >;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  mediaId?: string;
  @ApiPropertyOptional()
  @Transform(num)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999999)
  displayOrder?: number;
  @ApiPropertyOptional({ enum: COURSE_MAPPING_STATUSES })
  @IsOptional()
  @IsIn(COURSE_MAPPING_STATUSES)
  status?: string;
}
export class CreateSpecializationSectionDto extends SpecializationSectionDto {}
export class UpdateSpecializationSectionDto extends SpecializationSectionDto {
  @ApiPropertyOptional() @IsOptional() @IsISO8601() expectedUpdatedAt?: string;
}

export class SpecializationFaqDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(1, 1000)
  question!: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 30000) answer!: string;
  @ApiPropertyOptional({ enum: COURSE_MAPPING_STATUSES })
  @IsOptional()
  @IsIn(COURSE_MAPPING_STATUSES)
  status?: string;
  @ApiPropertyOptional()
  @Transform(num)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999999)
  displayOrder?: number;
}
export class CreateSpecializationFaqDto extends SpecializationFaqDto {}
export class UpdateSpecializationFaqDto extends SpecializationFaqDto {
  @ApiPropertyOptional() @IsOptional() @IsISO8601() expectedUpdatedAt?: string;
}

/** The destinations a subject or a specialization is listed for, sent
 * whole: the list replaces what an editor ticked before. A destination that
 * teaches it through a published course stays listed whatever is sent. */
export class TaxonomyCountriesDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayMaxSize(400)
  @IsUUID('all', { each: true })
  countryIds!: string[];
}
