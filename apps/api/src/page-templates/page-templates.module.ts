import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PageTemplatesAdminController } from './page-templates.controller';
import { PageTemplatesService } from './page-templates.service';

@Module({
  imports: [AuthModule],
  controllers: [PageTemplatesAdminController],
  providers: [PageTemplatesService],
  exports: [PageTemplatesService],
})
export class PageTemplatesModule {}
