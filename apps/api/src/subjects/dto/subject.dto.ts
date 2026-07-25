import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
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
    enum: ['displayOrder', 'name', 'createdAt', 'updatedAt'],
  })
  @IsOptional()
  @IsIn(['displayOrder', 'name', 'createdAt', 'updatedAt'])
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
}

export class CreateSubSubjectDto extends SubSubjectFieldsDto {}
export class UpdateSubSubjectDto extends SubSubjectFieldsDto {
  @ApiPropertyOptional() @IsOptional() @IsISO8601() expectedUpdatedAt?: string;
}
export class SubSubjectListQueryDto extends SubjectListQueryDto {}

export class SeoMetadataDto {
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 255) seoTitle!: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(1, 500)
  metaDescription!: string;
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
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  expectedUpdatedAt?: string;
}
