import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  InternalLinksAdminController,
  InternalLinksPublicController,
} from './internal-links.controller';
import { InternalLinksService } from './internal-links.service';

@Module({
  imports: [AuthModule],
  controllers: [InternalLinksAdminController, InternalLinksPublicController],
  providers: [InternalLinksService],
})
export class InternalLinksModule {}
