import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
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
  LEAD_DEFAULT_LIMIT,
  LEAD_DEFAULT_PAGE,
  LEAD_MAX_LIMIT,
  LEAD_NOTE_TYPES,
  LEAD_SOURCE_TYPES,
  LEAD_STATUSES,
  PUBLIC_LEAD_SOURCE_TYPES,
} from '../leads.constants';

function trimValue({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function lowercaseValue({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

function uppercaseValue({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

function numberValue({ value }: TransformFnParams): unknown {
  return value === undefined || value === '' ? value : Number(value);
}

function normalizePhone({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  const prefix = trimmed.startsWith('+') ? '+' : '';
  return `${prefix}${trimmed.replace(/\D/g, '')}`;
}

const SAFE_TEXT = /^(?!.*[<>])[\s\S]*$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_PATH = /^\/(?!\/)[A-Za-z0-9/_-]*$/;

export class CreateCounsellingLeadDto {
  @ApiProperty({ example: 'Fictional Student' })
  @Transform(trimValue)
  @IsString()
  @Length(2, 100)
  @Matches(SAFE_TEXT)
  fullName!: string;

  @ApiProperty({ example: 'student@example.invalid' })
  @Transform(lowercaseValue)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: '+15550102020' })
  @Transform(normalizePhone)
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/)
  phoneNumber!: string;

  @ApiProperty({ example: 'canada' })
  @Transform(lowercaseValue)
  @Matches(SLUG)
  @MaxLength(255)
  countrySlug!: string;

  @ApiProperty({ example: 'UG' })
  @Transform(uppercaseValue)
  @Matches(/^[A-Z0-9_]{1,50}$/)
  studyLevelCode!: string;

  @ApiProperty({ example: 'september' })
  @Transform(lowercaseValue)
  @Matches(SLUG)
  @MaxLength(255)
  intakeSlug!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  @Equals(true)
  consent!: boolean;

  @ApiPropertyOptional()
  @Transform(trimValue)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Matches(SAFE_TEXT)
  message?: string;

  @ApiPropertyOptional({ description: 'Hidden bot-trap field' })
  @Transform(trimValue)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyWebsite?: string;

  @ApiPropertyOptional({ enum: PUBLIC_LEAD_SOURCE_TYPES })
  @Transform(lowercaseValue)
  @IsOptional()
  @IsIn(PUBLIC_LEAD_SOURCE_TYPES)
  sourceType?: string;

  @ApiPropertyOptional()
  @Transform(lowercaseValue)
  @IsOptional()
  @Matches(SLUG)
  @MaxLength(255)
  sourceCountrySlug?: string;

  @ApiPropertyOptional()
  @Transform(lowercaseValue)
  @IsOptional()
  @Matches(SLUG)
  @MaxLength(255)
  sourceSubjectSlug?: string;

  @ApiPropertyOptional()
  @Transform(lowercaseValue)
  @IsOptional()
  @Matches(SLUG)
  @MaxLength(255)
  sourceSpecializationSlug?: string;

  @ApiPropertyOptional()
  @Transform(lowercaseValue)
  @IsOptional()
  @Matches(SLUG)
  @MaxLength(255)
  sourceCourseSlug?: string;

  @ApiPropertyOptional()
  @Transform(trimValue)
  @IsOptional()
  @Matches(SAFE_PATH)
  @MaxLength(2048)
  sourcePagePath?: string;

  @ApiPropertyOptional()
  @Transform(trimValue)
  @IsOptional()
  @Matches(SAFE_PATH)
  @MaxLength(2048)
  referringPath?: string;

  @ApiPropertyOptional()
  @Transform(trimValue)
  @IsOptional()
  @Matches(SAFE_PATH)
  @MaxLength(2048)
  landingPagePath?: string;

  @ApiPropertyOptional()
  @Transform(trimValue)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(SAFE_TEXT)
  utmSource?: string;

  @ApiPropertyOptional()
  @Transform(trimValue)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(SAFE_TEXT)
  utmMedium?: string;

  @ApiPropertyOptional()
  @Transform(trimValue)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(SAFE_TEXT)
  utmCampaign?: string;
}

export class LeadListQueryDto {
  @ApiPropertyOptional()
  @Transform(trimValue)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(SAFE_TEXT)
  q?: string;

  @ApiPropertyOptional({ enum: LEAD_STATUSES })
  @Transform(uppercaseValue)
  @IsOptional()
  @IsIn(LEAD_STATUSES)
  status?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  countryId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  courseLevelId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  intakeId?: string;

  @ApiPropertyOptional({ enum: LEAD_SOURCE_TYPES })
  @Transform(uppercaseValue)
  @IsOptional()
  @IsIn(LEAD_SOURCE_TYPES)
  sourceType?: string;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @Transform(trimValue)
  @IsOptional()
  @IsDateString({ strict: true, strictSeparator: true })
  createdFrom?: string;

  @ApiPropertyOptional({ example: '2026-07-31' })
  @Transform(trimValue)
  @IsOptional()
  @IsDateString({ strict: true, strictSeparator: true })
  createdTo?: string;

  @ApiPropertyOptional({ default: LEAD_DEFAULT_PAGE })
  @Transform(numberValue)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = LEAD_DEFAULT_PAGE;

  @ApiPropertyOptional({
    default: LEAD_DEFAULT_LIMIT,
    maximum: LEAD_MAX_LIMIT,
  })
  @Transform(numberValue)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(LEAD_MAX_LIMIT)
  limit = LEAD_DEFAULT_LIMIT;
}

export class UpdateLeadStatusDto {
  @ApiProperty({ enum: LEAD_STATUSES })
  @Transform(uppercaseValue)
  @IsIn(LEAD_STATUSES)
  status!: string;

  @ApiProperty({ description: 'Timestamp last displayed by the editor' })
  @Transform(trimValue)
  @IsISO8601()
  expectedUpdatedAt!: string;

  @ApiPropertyOptional()
  @Transform(trimValue)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(SAFE_TEXT)
  reason?: string;
}

export class CreateLeadNoteDto {
  @ApiProperty()
  @Transform(trimValue)
  @IsString()
  @Length(1, 5000)
  note!: string;

  @ApiPropertyOptional({ enum: LEAD_NOTE_TYPES, default: 'GENERAL' })
  @Transform(uppercaseValue)
  @IsOptional()
  @IsIn(LEAD_NOTE_TYPES)
  noteType = 'GENERAL';

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPinned = false;
}
