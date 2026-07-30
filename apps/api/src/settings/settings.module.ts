import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  SettingsAdminController,
  SettingsPublicController,
} from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [AuthModule],
  controllers: [SettingsPublicController, SettingsAdminController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
