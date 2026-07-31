import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VersionsModule } from '../versions/versions.module';
import {
  SettingsAdminController,
  SettingsPublicController,
  SiteChromePublicController,
} from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [AuthModule, VersionsModule],
  controllers: [
    SettingsPublicController,
    SiteChromePublicController,
    SettingsAdminController,
  ],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
