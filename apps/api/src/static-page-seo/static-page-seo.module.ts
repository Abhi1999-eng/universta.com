import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  StaticPageSeoAdminController,
  StaticPageSeoPublicController,
} from './static-page-seo.controller';
import { StaticPageSeoService } from './static-page-seo.service';

@Module({
  imports: [AuthModule],
  controllers: [StaticPageSeoPublicController, StaticPageSeoAdminController],
  providers: [StaticPageSeoService],
  exports: [StaticPageSeoService],
})
export class StaticPageSeoModule {}
