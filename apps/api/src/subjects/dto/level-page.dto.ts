import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { COURSE_MAPPING_STATUSES } from '../../catalog/catalog.constants';
import { LEVEL_PAGE_STATUSES } from '../level-pages.shared';
import { SeoMetadataDto } from './subject.dto';

const trim = ({ value }: TransformFnParams) =>
  typeof value === 'string' ? value.trim() : value;
const num = ({ value }: TransformFnParams) =>
  value === undefined || value === '' ? value : Number(value);

/** One question on a level page. The limits are a specialization FAQ's. */
export class LevelPageFaqDto {
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

/* A level page's SEO travels inside the page's own save, so the page's
   version covers it and this has no version of its own. */
export class LevelPageSeoDto extends OmitType(SeoMetadataDto, [
  'expectedUpdatedAt',
] as const) {}

/**
 * Saving a level page: every key is optional, and one left out leaves that
 * part of the page as it is. The questions and the SEO are each replaced
 * whole when sent; `seo: null` removes the page's own SEO.
 */
export class UpsertLevelPageDto {
  /* The seven texts are sanitised rich text; the limit is a subject
     overview's. An empty one, or one with nothing visible, is stored as
     nothing. */
  @ApiPropertyOptional({ nullable: true })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  intro?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  studyTopics?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  admissionNote?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  careersNote?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  industries?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  employers?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  lookingAhead?: string | null;
  @ApiPropertyOptional({ enum: LEVEL_PAGE_STATUSES })
  @IsOptional()
  @IsIn(LEVEL_PAGE_STATUSES)
  status?: string;
  /* The whole list, in order; [] clears it. Null is refused rather than
     read as either. */
  @ApiPropertyOptional({ type: [LevelPageFaqDto] })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => LevelPageFaqDto)
  faqs?: LevelPageFaqDto[];
  @ApiPropertyOptional({ type: LevelPageSeoDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => LevelPageSeoDto)
  seo?: LevelPageSeoDto | null;
  /** The page's `updatedAt` from the last read. Null says "I saw no page
   * yet"; left out, no check is made. */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string | null;
}
