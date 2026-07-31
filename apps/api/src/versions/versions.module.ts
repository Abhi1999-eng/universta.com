import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VersionsAdminController } from './versions.controller';
import { VersionsService } from './versions.service';

@Module({
  // AccessTokenGuard on the controller needs JwtService from AuthModule.
  imports: [AuthModule],
  controllers: [VersionsAdminController],
  providers: [VersionsService],
  // Exported so the editorial write paths can record a version after each
  // successful change without duplicating snapshot logic.
  exports: [VersionsService],
})
export class VersionsModule {}
