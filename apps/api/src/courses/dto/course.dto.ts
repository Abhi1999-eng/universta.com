import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
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
  ValidateNested,
} from 'class-validator';
import {
  COURSE_AVAILABILITY_STATUSES,
  COURSE_DURATION_UNITS,
  COURSE_INTAKE_STATUSES,
  COURSE_MAPPING_STATUSES,
  COURSE_RELATIONSHIP_TYPES,
  COURSE_SECTION_KEYS,
  COURSE_SECTION_TYPES,
  COURSE_STATUSES,
  COURSE_TUITION_PERIODS,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
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
const decimal = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;

export class CourseFieldsDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() subjectId!: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  subSubjectId?: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() courseLevelId!: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 255) name!: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  shortName?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  qualificationName?: string;
  @ApiPropertyOptional()
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
  @MaxLength(100)
  courseCode?: string;
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
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @Matches(decimal)
  durationMin?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @Matches(decimal)
  durationMax?: string;
  @ApiPropertyOptional({ enum: COURSE_DURATION_UNITS })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsOptional()
  @IsIn(COURSE_DURATION_UNITS)
  durationUnit?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @Matches(decimal)
  credits?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  featuredMediaId?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  careerSummary?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @Matches(decimal)
  popularityScore?: string;
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
export class CreateCourseDto extends CourseFieldsDto {}
export class UpdateCourseDto extends CourseFieldsDto {
  @ApiPropertyOptional() @IsOptional() @IsISO8601() expectedUpdatedAt?: string;
}
export class CourseActionDto {
  @ApiPropertyOptional() @IsOptional() @IsISO8601() expectedUpdatedAt?: string;
}

export class CourseListQueryDto {
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  subject?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  subSubject?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  level?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  country?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  studyMode?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  intake?: string;
  @ApiPropertyOptional()
  @Transform(bool)
  @IsOptional()
  @IsBoolean()
  scholarshipAvailable?: boolean;
  @ApiPropertyOptional()
  @Transform(bool)
  @IsOptional()
  @IsBoolean()
  featured?: boolean;
  @ApiPropertyOptional({ enum: COURSE_STATUSES })
  @IsOptional()
  @IsIn(COURSE_STATUSES)
  status?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @Matches(decimal)
  minTuition?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @Matches(decimal)
  maxTuition?: string;
  @ApiPropertyOptional({
    enum: [
      'featured',
      'name',
      'newest',
      'duration',
      'tuition-low',
      'popularity',
    ],
  })
  @IsOptional()
  @IsIn(['featured', 'name', 'newest', 'duration', 'tuition-low', 'popularity'])
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

export class CourseSuggestionsQueryDto {
  @ApiProperty({ minLength: 2, maxLength: 100 })
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  q!: string;
}

export class StudyModeReplacementDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  studyModeIds!: string[];
  @ApiPropertyOptional() @IsOptional() @IsISO8601() expectedUpdatedAt?: string;
}

export class CountryCourseFieldsDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() countryId!: string;
  @ApiPropertyOptional({ enum: COURSE_AVAILABILITY_STATUSES })
  @IsOptional()
  @IsIn(COURSE_AVAILABILITY_STATUSES)
  availabilityStatus?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @Matches(decimal)
  indicativeTuitionMin?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @Matches(decimal)
  indicativeTuitionMax?: string;
  @ApiPropertyOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  currencyCode?: string;
  @ApiPropertyOptional({ enum: COURSE_TUITION_PERIODS })
  @IsOptional()
  @IsIn(COURSE_TUITION_PERIODS)
  tuitionPeriod?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @Matches(decimal)
  applicationFeeMin?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @Matches(decimal)
  applicationFeeMax?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @Matches(decimal)
  durationMinOverride?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @Matches(decimal)
  durationMaxOverride?: string;
  @ApiPropertyOptional({ enum: COURSE_DURATION_UNITS })
  @IsOptional()
  @IsIn(COURSE_DURATION_UNITS)
  durationUnitOverride?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @Matches(decimal)
  academicMinPercentage?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @Matches(decimal)
  academicMinCgpa?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @Matches(decimal)
  ieltsMinScore?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @Matches(decimal)
  pteMinScore?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @Matches(decimal)
  toeflMinScore?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @Matches(decimal)
  duolingoMinScore?: string;
  @ApiPropertyOptional()
  @Transform(num)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  workExperienceMonths?: number;
  @ApiPropertyOptional()
  @Transform(bool)
  @IsOptional()
  @IsBoolean()
  scholarshipAvailable?: boolean;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(30000)
  admissionRequirements?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(30000)
  englishRequirements?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  applicationNotes?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  careerOpportunities?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(/^https:\/\//i)
  sourceReference?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() verifiedAt?: string;
  @ApiPropertyOptional({ enum: COURSE_MAPPING_STATUSES })
  @IsOptional()
  @IsIn(COURSE_MAPPING_STATUSES)
  status?: string;
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
export class CreateCountryCourseDto extends CountryCourseFieldsDto {}
export class UpdateCountryCourseDto extends CountryCourseFieldsDto {
  @ApiPropertyOptional() @IsOptional() @IsISO8601() expectedUpdatedAt?: string;
}

export class IntakeReplacementItemDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() intakeId!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  applicationDeadline?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  deadlineNotes?: string;
  @ApiPropertyOptional({ enum: COURSE_INTAKE_STATUSES })
  @IsOptional()
  @IsIn(COURSE_INTAKE_STATUSES)
  status?: string;
}
export class IntakeReplacementDto {
  @ApiProperty({ type: [IntakeReplacementItemDto] })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => IntakeReplacementItemDto)
  intakes!: IntakeReplacementItemDto[];
  @ApiPropertyOptional() @IsOptional() @IsISO8601() expectedUpdatedAt?: string;
}

export class ContentSectionDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  @IsIn(COURSE_SECTION_KEYS)
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
export class CreateContentSectionDto extends ContentSectionDto {}
export class UpdateContentSectionDto extends ContentSectionDto {
  @ApiPropertyOptional() @IsOptional() @IsISO8601() expectedUpdatedAt?: string;
}

export class FaqDto {
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
export class CreateFaqDto extends FaqDto {}
export class UpdateFaqDto extends FaqDto {
  @ApiPropertyOptional() @IsOptional() @IsISO8601() expectedUpdatedAt?: string;
}

export class RelatedCourseItemDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() relatedCourseId!: string;
  @ApiPropertyOptional({ enum: COURSE_RELATIONSHIP_TYPES })
  @IsOptional()
  @IsIn(COURSE_RELATIONSHIP_TYPES)
  relationshipType?: string;
  @ApiPropertyOptional()
  @Transform(num)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999999)
  displayOrder?: number;
}
export class RelatedCourseReplacementDto {
  @ApiProperty({ type: [RelatedCourseItemDto] })
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => RelatedCourseItemDto)
  related!: RelatedCourseItemDto[];
  @ApiPropertyOptional() @IsOptional() @IsISO8601() expectedUpdatedAt?: string;
}
