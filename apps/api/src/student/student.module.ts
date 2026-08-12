import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StudentAuthController } from './student-auth.controller';
import { StudentAuthService } from './student-auth.service';
import { StudentAccessGuard } from './student-access.guard';
import { StudentProfileController } from './student-profile.controller';
import { StudentProfileService } from './student-profile.service';
import { StudentDocumentController } from './student-document.controller';
import { StudentDocumentService } from './student-document.service';
import { EmailDeliveryService } from './email-delivery.service';
import { MediaModule } from '../media/media.module';

/**
 * The student portal's own surface.
 *
 * It imports AuthModule rather than re-implementing sessions: password
 * hashing, refresh rotation and revocation are shared, and only eligibility
 * and JWT audience differ.
 */
@Module({
  imports: [AuthModule, CommonModule, PrismaModule, MediaModule],
  controllers: [
    StudentAuthController,
    StudentProfileController,
    StudentDocumentController,
  ],
  providers: [
    StudentAuthService,
    StudentProfileService,
    StudentDocumentService,
    EmailDeliveryService,
    StudentAccessGuard,
  ],
  exports: [StudentAuthService, StudentProfileService, StudentAccessGuard],
})
export class StudentModule {}
