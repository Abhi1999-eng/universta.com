import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  RedirectsController,
  RedirectsPublicController,
} from './redirects.controller';
import { RedirectsService } from './redirects.service';

@Module({
  imports: [AuthModule],
  controllers: [RedirectsController, RedirectsPublicController],
  providers: [RedirectsService],
})
export class RedirectsModule {}
