import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  MinLength,
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
  COUNTRY_STATUSES,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  MAX_SUGGESTION_LIMIT,
  SUGGESTION_LIMIT,
} from '../../catalog/catalog.constants';
import {
  BUDGET_BANDS,
  PATHWAY_STRENGTHS,
  VISA_SUCCESS_BANDS,
} from '../profiles/profile.constants';

function trimValue({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function uppercaseValue({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

function booleanValue({ value }: TransformFnParams): unknown {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
}

function numberValue({ value }: TransformFnParams): unknown {
  return value === undefined || value === '' ? value : Number(value);
}

export class CreateCountryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  continentId!: string;

  @ApiProperty({ example: 'Canada' })
  @Transform(trimValue)
  @IsString()
  @Length(1, 150)
  name!: string;

  @ApiPropertyOptional({ example: 'canada' })
  @Transform(trimValue)
  @IsOptional()
  @IsString()
  @Length(1, 255)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @ApiPropertyOptional({ example: 'CA' })
  @Transform(uppercaseValue)
  @IsOptional()
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/)
  iso2Code?: string;

  @ApiPropertyOptional({ example: 'CAN' })
  @Transform(uppercaseValue)
  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/)
  iso3Code?: string;

  @ApiProperty({ example: 'Study in Canada' })
  @Transform(trimValue)
  @IsString()
  @Length(1, 255)
  pageHeading!: string;

  @ApiProperty({ example: 'Explore structured study information for Canada.' })
  @Transform(trimValue)
  @IsString()
  @Length(1, 1000)
  shortDescription!: string;

  @ApiPropertyOptional({ example: false })
  @Transform(booleanValue)
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @Transform(numberValue)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999999)
  displayOrder?: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  flagMediaId?: string;
}

export class UpdateCountryDto extends CreateCountryDto {
  @ApiPropertyOptional({
    description: 'Timestamp last displayed by the editor',
  })
  @Transform(trimValue)
  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string;
}

export class CountryListQueryDto {
  @ApiPropertyOptional()
  @Transform(trimValue)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ description: 'Published continent slug' })
  @Transform(trimValue)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  continent?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  continentId?: string;

  @ApiPropertyOptional()
  @Transform(booleanValue)
  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ example: 'C' })
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string'
      ? value.trim().toUpperCase()
      : (value as string | undefined),
  )
  @IsOptional()
  @Matches(/^[A-Z]$/)
  letter?: string;

  @ApiPropertyOptional({ enum: ['displayOrder', 'name', 'featured'] })
  @IsOptional()
  @IsIn(['displayOrder', 'name', 'featured'])
  sort?: string;

  @ApiPropertyOptional({ enum: COUNTRY_STATUSES })
  @IsOptional()
  @IsIn(COUNTRY_STATUSES)
  status?: string;

  @ApiPropertyOptional({ enum: BUDGET_BANDS })
  @Transform(trimValue)
  @IsOptional()
  @IsIn(BUDGET_BANDS)
  budgetBand?: string;

  @ApiPropertyOptional({
    description:
      'Only verified countries where IELTS is optional or not required',
  })
  @Transform(booleanValue)
  @IsOptional()
  @IsBoolean()
  ieltsOptional?: boolean;

  @ApiPropertyOptional({ description: 'Active intake slug or ID' })
  @Transform(trimValue)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  intake?: string;

  @ApiPropertyOptional({ enum: VISA_SUCCESS_BANDS })
  @Transform(trimValue)
  @IsOptional()
  @IsIn(VISA_SUCCESS_BANDS)
  visaSuccessBand?: string;

  @ApiPropertyOptional({ enum: PATHWAY_STRENGTHS })
  @Transform(trimValue)
  @IsOptional()
  @IsIn(PATHWAY_STRENGTHS)
  pathwayStrength?: string;

  @ApiPropertyOptional({
    description:
      'Match only verified statistics with or without top-ranked universities',
  })
  @Transform(booleanValue)
  @IsOptional()
  @IsBoolean()
  hasTopRankedUniversities?: boolean;

  @ApiPropertyOptional({ default: DEFAULT_PAGE })
  @Transform(numberValue)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = DEFAULT_PAGE;

  @ApiPropertyOptional({ default: DEFAULT_LIMIT, maximum: MAX_LIMIT })
  @Transform(numberValue)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit = DEFAULT_LIMIT;
}

export class SuggestionsQueryDto {
  @ApiProperty({ minLength: 2, example: 'ca' })
  @Transform(trimValue)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q!: string;

  @ApiPropertyOptional({
    default: SUGGESTION_LIMIT,
    maximum: MAX_SUGGESTION_LIMIT,
  })
  @Transform(numberValue)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_SUGGESTION_LIMIT)
  limit = SUGGESTION_LIMIT;
}

export class DirectoryQueryDto {
  @ApiPropertyOptional({ example: 'C' })
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string'
      ? value.trim().toUpperCase()
      : (value as string | undefined),
  )
  @IsOptional()
  @Matches(/^[A-Z]$/)
  letter?: string;

  @ApiPropertyOptional({ default: DEFAULT_PAGE })
  @Transform(numberValue)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = DEFAULT_PAGE;

  @ApiPropertyOptional({ default: DEFAULT_LIMIT, maximum: MAX_LIMIT })
  @Transform(numberValue)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit = DEFAULT_LIMIT;

  @ApiPropertyOptional({ enum: BUDGET_BANDS })
  @Transform(trimValue)
  @IsOptional()
  @IsIn(BUDGET_BANDS)
  budgetBand?: string;
  @ApiPropertyOptional()
  @Transform(booleanValue)
  @IsOptional()
  @IsBoolean()
  ieltsOptional?: boolean;
  @ApiPropertyOptional()
  @Transform(trimValue)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  intake?: string;
  @ApiPropertyOptional({ enum: VISA_SUCCESS_BANDS })
  @Transform(trimValue)
  @IsOptional()
  @IsIn(VISA_SUCCESS_BANDS)
  visaSuccessBand?: string;
  @ApiPropertyOptional({ enum: PATHWAY_STRENGTHS })
  @Transform(trimValue)
  @IsOptional()
  @IsIn(PATHWAY_STRENGTHS)
  pathwayStrength?: string;
  @ApiPropertyOptional()
  @Transform(booleanValue)
  @IsOptional()
  @IsBoolean()
  hasTopRankedUniversities?: boolean;
}

export class CountryActionDto {
  @ApiPropertyOptional({
    description: 'Timestamp last displayed by the editor',
  })
  @Transform(trimValue)
  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string;
}
