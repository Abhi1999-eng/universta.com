import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import {
  SeoManagementAdminController,
  SeoManagementPublicController,
} from './seo-management.controller';
import { SeoManagementService } from './seo-management.service';
import { SEO_MANAGEMENT_RESOLVER } from './seo-management.tokens';

@Module({
  imports: [AuthModule, SettingsModule],
  controllers: [SeoManagementPublicController, SeoManagementAdminController],
  providers: [
    SeoManagementService,
    { provide: SEO_MANAGEMENT_RESOLVER, useExisting: SeoManagementService },
  ],
  exports: [SeoManagementService, SEO_MANAGEMENT_RESOLVER],
})
export class SeoManagementModule {}
