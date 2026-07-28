import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  AdminLeadsController,
  PublicLeadsController,
} from './leads.controller';
import { LeadProtectionService } from './lead-protection.service';
import { LeadsService } from './leads.service';

@Module({
  imports: [AuthModule],
  controllers: [PublicLeadsController, AdminLeadsController],
  providers: [LeadsService, LeadProtectionService],
})
export class LeadsModule {}
