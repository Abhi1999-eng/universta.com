import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WebsitePagesAdminController } from './website-pages.controller';
import { WebsitePagesService } from './website-pages.service';

@Module({
  imports: [AuthModule],
  controllers: [WebsitePagesAdminController],
  providers: [WebsitePagesService],
  exports: [WebsitePagesService],
})
export class WebsiteBuilderModule {}
