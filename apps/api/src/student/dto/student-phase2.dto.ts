import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  Max,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class StartApplicationDto {
  @IsUUID()
  offeringId!: string;

  @IsOptional()
  @IsUUID()
  intakeId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID(undefined, { each: true })
  documentIds?: string[];
}

export class AttachDocumentsDto {
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID(undefined, { each: true })
  documentIds!: string[];
}

export class ApplicationActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}

export class OfferDecisionDto extends ApplicationActionDto {
  @IsIn(['ACCEPTED', 'REJECTED'])
  decision!: 'ACCEPTED' | 'REJECTED';
}

export class StartScholarshipApplicationDto {
  @IsUUID()
  scholarshipId!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID(undefined, { each: true })
  documentIds?: string[];
}

export class SendMessageDto {
  @IsString()
  @MaxLength(5000)
  body!: string;
}

export class CreateSupportTicketDto extends SendMessageDto {
  @IsIn([
    'GENERAL',
    'APPLICATION',
    'DOCUMENT',
    'SCHOLARSHIP',
    'TECHNICAL',
    'OTHER',
  ])
  category!:
    | 'GENERAL'
    | 'APPLICATION'
    | 'DOCUMENT'
    | 'SCHOLARSHIP'
    | 'TECHNICAL'
    | 'OTHER';

  @IsString()
  @MaxLength(255)
  subject!: string;
}

export class ApplyReferralDto {
  @IsString()
  @MaxLength(40)
  code!: string;
}

export class AdminApplicationStatusDto extends ApplicationActionDto {
  @IsIn([
    'APPLICATION_STARTED',
    'SUBMITTED',
    'UNDER_REVIEW',
    'OFFER_RECEIVED',
    'ACCEPTED',
    'REJECTED',
    'WITHDRAWN',
    'ENROLLED',
  ])
  status!: string;

  @IsOptional()
  @IsUUID()
  offerMediaId?: string;
}

export class AdminScholarshipStatusDto extends ApplicationActionDto {
  @IsIn([
    'STARTED',
    'SUBMITTED',
    'UNDER_REVIEW',
    'AWARDED',
    'REJECTED',
    'WITHDRAWN',
  ])
  status!: string;
}

export class AdminConsultantAssignmentDto {
  @IsUUID()
  consultantId!: string;
}

export class AdminSupportStatusDto {
  @IsIn(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])
  status!: string;
}

export class AdminReplyDto extends SendMessageDto {}

export class PaginationDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class InviteReferralDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;
}
