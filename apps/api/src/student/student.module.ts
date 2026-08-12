import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StudentAuthController } from './student-auth.controller';
import { StudentAuthService } from './student-auth.service';
import { StudentAccessGuard } from './student-access.guard';

/**
 * The student portal's own surface.
 *
 * It imports AuthModule rather than re-implementing sessions: password
 * hashing, refresh rotation and revocation are shared, and only eligibility
 * and JWT audience differ.
 */
@Module({
  imports: [AuthModule, CommonModule, PrismaModule],
  controllers: [StudentAuthController],
  providers: [StudentAuthService, StudentAccessGuard],
  exports: [StudentAuthService, StudentAccessGuard],
})
export class StudentModule {}
