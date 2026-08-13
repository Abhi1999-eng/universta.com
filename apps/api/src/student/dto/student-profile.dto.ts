import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { STUDENT_DOCUMENT_TYPES } from '../student-document.service';

/** Every editable profile field, and nothing else. With the global whitelist
 * validation, a request naming anything outside this list is rejected. */
export class UpdateStudentProfileDto {
  @ApiPropertyOptional({ example: '2003-04-17' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  gender?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  nationalityCountryId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  currentCountryId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  currentCityText?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  preferredSubjectId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  preferredCourseLevelId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  preferredIntakeId?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  preferredCountryIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetMin?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetMax?: number | null;

  @ApiPropertyOptional({ example: 'INR' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  budgetCurrency?: string | null;
}

export class StudentAcademicDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  qualificationName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  qualificationLevel?: string | null;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  institutionName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  boardOrUniversity?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  countryId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  specialization?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  currentlyStudying?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  gpa?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  gpaScale?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

/** Same fields, all optional: a PATCH may carry only what changed. */
export class UpdateStudentAcademicDto extends StudentAcademicDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  declare qualificationName: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  declare institutionName: string;
}

export class StudentWorkDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  companyName!: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  jobTitle!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  employmentType?: string | null;

  @ApiPropertyOptional()
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  currentlyWorking?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}

export class UpdateStudentWorkDto extends StudentWorkDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  declare companyName: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  declare jobTitle: string;

  @IsOptional()
  @IsDateString()
  declare startDate: string;
}

export const ENGLISH_TEST_TYPES = [
  'IELTS',
  'PTE',
  'TOEFL',
  'DUOLINGO',
  'OTHER',
] as const;

export class StudentEnglishTestDto {
  @ApiPropertyOptional({ enum: ENGLISH_TEST_TYPES })
  @IsIn(ENGLISH_TEST_TYPES)
  testType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  testDate?: string | null;

  @ApiPropertyOptional({ example: 7.5 })
  @IsNumber()
  @Min(0)
  @Max(200)
  overallScore!: number;

  /** Free-form per exam: IELTS has four bands, PTE and TOEFL score other
   * things, and fixed columns for one exam make the rest awkward. */
  @ApiPropertyOptional({ example: { listening: 7.5, reading: 7 } })
  @IsOptional()
  @IsObject()
  componentScores?: Record<string, number>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiryDate?: string | null;
}

export class UpdateStudentEnglishTestDto extends StudentEnglishTestDto {
  @IsOptional()
  @IsIn(ENGLISH_TEST_TYPES)
  declare testType: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(200)
  declare overallScore: number;
}

export class StudentPassportDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(60)
  passportNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  issuingCountryId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  issueDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiryDate?: string | null;
}

export class StudentDocumentUploadDto {
  @ApiPropertyOptional({ enum: STUDENT_DOCUMENT_TYPES })
  @IsIn(STUDENT_DOCUMENT_TYPES)
  documentType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateStudentDocumentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ApiPropertyOptional({ enum: STUDENT_DOCUMENT_TYPES })
  @IsOptional()
  @IsIn(STUDENT_DOCUMENT_TYPES)
  documentType?: string;
}

/** Used only to coerce multipart string fields before validation. */
export class NumericIdParam {
  @Type(() => String)
  @IsUUID()
  id!: string;
}
