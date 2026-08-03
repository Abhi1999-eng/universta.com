import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RedirectsController } from './redirects.controller';
import { RedirectsService } from './redirects.service';

@Module({
  imports: [AuthModule],
  controllers: [RedirectsController],
  providers: [RedirectsService],
})
export class RedirectsModule {}
