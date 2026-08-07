import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  MediaAdminController,
  MediaPublicController,
} from './media.controller';
import { MediaRecoveryAdminController } from './media-recovery.controller';
import { MediaService } from './media.service';

@Module({
  imports: [AuthModule],
  controllers: [
    MediaAdminController,
    MediaRecoveryAdminController,
    MediaPublicController,
  ],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
