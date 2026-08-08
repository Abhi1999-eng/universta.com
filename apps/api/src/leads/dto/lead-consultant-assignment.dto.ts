import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsUUID } from 'class-validator';

export class UpdateLeadConsultantAssignmentDto {
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Consultant to assign. Send null to unassign the lead.',
  })
  @IsOptional()
  @IsUUID()
  consultantId?: string | null;

  @ApiProperty({ description: 'Timestamp last displayed by the editor' })
  @IsISO8601()
  expectedUpdatedAt!: string;
}
