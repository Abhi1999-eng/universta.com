import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  UniversityClaimsAdminController,
  UniversityClaimsPublicController,
} from './university-claims.controller';
import { UniversityClaimsService } from './university-claims.service';

@Module({
  imports: [AuthModule],
  controllers: [
    UniversityClaimsAdminController,
    UniversityClaimsPublicController,
  ],
  providers: [UniversityClaimsService],
  exports: [UniversityClaimsService],
})
export class UniversityClaimsModule {}
