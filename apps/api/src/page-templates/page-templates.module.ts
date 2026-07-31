import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VersionsModule } from '../versions/versions.module';
import { PageTemplatesAdminController } from './page-templates.controller';
import { PageTemplatesService } from './page-templates.service';

@Module({
  imports: [AuthModule, VersionsModule],
  controllers: [PageTemplatesAdminController],
  providers: [PageTemplatesService],
  exports: [PageTemplatesService],
})
export class PageTemplatesModule {}
