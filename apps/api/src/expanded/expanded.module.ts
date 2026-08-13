import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ExperimentsModule } from '../experiments/experiments.module';
import { VersionsModule } from '../versions/versions.module';
import { SeoManagementModule } from '../seo-management/seo-management.module';
import {
  ExpandedAdminController,
  ExpandedPublicController,
} from './expanded.controller';
import { ExpandedService } from './expanded.service';

@Module({
  imports: [AuthModule, ExperimentsModule, VersionsModule, SeoManagementModule],
  controllers: [ExpandedPublicController, ExpandedAdminController],
  providers: [ExpandedService],
  exports: [ExpandedService],
})
export class ExpandedModule {}
