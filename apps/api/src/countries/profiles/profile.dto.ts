import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  BUDGET_BANDS,
  COST_PERIODS,
  INTAKE_AVAILABILITY,
  LANGUAGE_REQUIREMENTS,
  PATHWAY_STRENGTHS,
  STATISTICS_SOURCE_MODES,
  VISA_SUCCESS_BANDS,
} from './profile.constants';

function trim({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function bool({ value }: TransformFnParams): unknown {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
}

function integer({ value }: TransformFnParams): unknown {
  return value === undefined || value === '' ? value : Number(value);
}

export class ProfileVersionDto {
  @ApiPropertyOptional({
    description: 'Timestamp returned by the previous write',
  })
  @Transform(trim)
  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string;
}

export class CreateIntakeDto {
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  name!: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  slug?: string;

  @Transform(integer)
  @IsInt()
  @Min(1)
  @Max(12)
  startMonth!: number;

  @Transform(integer)
  @IsInt()
  @Min(1)
  @Max(12)
  endMonth!: number;

  @Transform(trim) @IsOptional() @IsString() @MaxLength(50) seasonName?: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(50) shortLabel?: string;
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(30) status?: string;
  @Transform(integer) @IsOptional() @IsInt() @Min(0) displayOrder?: number;
}

export class UpdateIntakeDto {
  @Transform(trim) @IsOptional() @IsString() @MaxLength(100) name?: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(100) slug?: string;
  @Transform(integer)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  startMonth?: number;
  @Transform(integer) @IsOptional() @IsInt() @Min(1) @Max(12) endMonth?: number;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(50) seasonName?: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(50) shortLabel?: string;
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(30) status?: string;
  @Transform(integer) @IsOptional() @IsInt() @Min(0) displayOrder?: number;
}

export class CostProfileDto extends ProfileVersionDto {
  @IsOptional() @IsString() @MaxLength(3) currencyCode?: string;
  @IsOptional() @IsString() @MaxLength(10) currencySymbol?: string;
  @IsOptional() @IsString() tuitionMin?: string;
  @IsOptional() @IsString() tuitionMax?: string;
  @IsOptional() @IsIn(COST_PERIODS) tuitionPeriod?: string;
  @IsOptional() @IsString() @MaxLength(1000) tuitionNotes?: string;
  @IsOptional() @IsString() livingCostMin?: string;
  @IsOptional() @IsString() livingCostMax?: string;
  @IsOptional() @IsIn(COST_PERIODS) livingCostPeriod?: string;
  @IsOptional() @IsString() @MaxLength(1000) livingCostNotes?: string;
  @IsOptional() @IsString() accommodationMin?: string;
  @IsOptional() @IsString() accommodationMax?: string;
  @IsOptional() @IsString() foodCostMin?: string;
  @IsOptional() @IsString() foodCostMax?: string;
  @IsOptional() @IsString() transportCostMin?: string;
  @IsOptional() @IsString() transportCostMax?: string;
  @IsOptional() @IsString() healthInsuranceCost?: string;
  @IsOptional() @IsString() applicationFeeMin?: string;
  @IsOptional() @IsString() applicationFeeMax?: string;
  @IsOptional() @IsIn(BUDGET_BANDS) budgetBand?: string;
  @Transform(integer)
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  applicableYear?: number;
  @IsOptional() @IsString() @MaxLength(2048) sourceReference?: string;
  @IsOptional() @IsString() @MaxLength(10000) disclaimer?: string;
  @IsOptional() @IsISO8601() verifiedAt?: string;
}

export class WorkProfileDto extends ProfileVersionDto {
  @Transform(bool) @IsOptional() @IsBoolean() partTimeAllowed?: boolean;
  @IsOptional() @IsString() partTimeHoursPerWeek?: string;
  @IsOptional() @IsString() partTimeHoursDuringBreaks?: string;
  @IsOptional() @IsString() @MaxLength(2000) partTimeSummary?: string;
  @Transform(bool) @IsOptional() @IsBoolean() postStudyWorkAvailable?: boolean;
  @Transform(integer)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  postStudyWorkMinMonths?: number;
  @Transform(integer)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  postStudyWorkMaxMonths?: number;
  @IsOptional() @IsString() @MaxLength(2000) postStudyWorkSummary?: string;
  @IsOptional() @IsIn(PATHWAY_STRENGTHS) immigrationPathwayStrength?: string;
  @IsOptional() @IsString() @MaxLength(2000) immigrationPathwaySummary?: string;
  @IsOptional() @IsIn(VISA_SUCCESS_BANDS) visaSuccessBand?: string;
  @IsOptional() @IsString() visaSuccessPercentage?: string;
  @IsOptional() @IsString() @MaxLength(10000) visaInformation?: string;
  @IsOptional() @IsString() @MaxLength(255) visaProcessingTime?: string;
  @IsOptional() @IsString() @MaxLength(2000) proofOfFundsSummary?: string;
  @IsOptional() @IsString() @MaxLength(2048) sourceReference?: string;
  @IsOptional() @IsString() @MaxLength(10000) disclaimer?: string;
  @IsOptional() @IsISO8601() verifiedAt?: string;
}

export class LanguageProfileDto extends ProfileVersionDto {
  @IsOptional() @IsIn(LANGUAGE_REQUIREMENTS) ieltsRequirement?: string;
  @IsOptional() @IsString() ieltsMinScore?: string;
  @IsOptional() @IsString() @MaxLength(500) ieltsNotes?: string;
  @IsOptional() @IsIn(LANGUAGE_REQUIREMENTS) pteRequirement?: string;
  @IsOptional() @IsString() pteMinScore?: string;
  @IsOptional() @IsString() @MaxLength(500) pteNotes?: string;
  @IsOptional() @IsIn(LANGUAGE_REQUIREMENTS) toeflRequirement?: string;
  @IsOptional() @IsString() toeflMinScore?: string;
  @IsOptional() @IsString() @MaxLength(500) toeflNotes?: string;
  @IsOptional() @IsIn(LANGUAGE_REQUIREMENTS) duolingoRequirement?: string;
  @IsOptional() @IsString() duolingoMinScore?: string;
  @IsOptional() @IsString() @MaxLength(500) duolingoNotes?: string;
  @Transform(bool) @IsOptional() @IsBoolean() languageWaiverAvailable?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) waiverNotes?: string;
  @IsOptional() @IsString() @MaxLength(2000) generalNotes?: string;
  @IsOptional() @IsString() @MaxLength(2048) sourceReference?: string;
  @IsOptional() @IsString() @MaxLength(10000) disclaimer?: string;
  @IsOptional() @IsISO8601() verifiedAt?: string;
}

export class CountryIntakeItemDto {
  @IsUUID() intakeId!: string;
  @Transform(bool) @IsOptional() @IsBoolean() isMajor?: boolean;
  @IsOptional() @IsIn(INTAKE_AVAILABILITY) availabilityStatus?: string;
  @Transform(integer)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  applicationOpeningMonth?: number;
  @Transform(integer)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  applicationDeadlineMonth?: number;
  @IsOptional() @IsString() @MaxLength(1000) applicationOpeningNote?: string;
  @IsOptional() @IsString() @MaxLength(1000) applicationDeadlineNote?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @Transform(integer)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999999)
  displayOrder?: number;
}

export class ReplaceIntakesDto extends ProfileVersionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CountryIntakeItemDto)
  intakes!: CountryIntakeItemDto[];
}

export class StatisticsProfileDto extends ProfileVersionDto {
  @Transform(integer)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  universitiesCount?: number;
  @Transform(integer)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  publicUniversitiesCount?: number;
  @Transform(integer)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  privateUniversitiesCount?: number;
  @Transform(integer)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  coursesCount?: number;
  @Transform(integer)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  ugCoursesCount?: number;
  @Transform(integer)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  pgCoursesCount?: number;
  @Transform(integer)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  pgdmCoursesCount?: number;
  @Transform(integer)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  mbaCoursesCount?: number;
  @Transform(integer)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  phdCoursesCount?: number;
  @Transform(integer)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  scholarshipsCount?: number;
  @Transform(integer)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  citiesCount?: number;
  @Transform(integer)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  topRankedUniversitiesCount?: number;
  @Transform(integer)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  internationalStudentsCount?: number;
  @IsOptional() @IsString() studentSatisfactionPercentage?: string;
  @IsOptional() @IsIn(STATISTICS_SOURCE_MODES) sourceMode?: string;
  @IsOptional() @IsString() @MaxLength(2048) sourceReference?: string;
  @IsOptional() @IsISO8601() verifiedAt?: string;
}
