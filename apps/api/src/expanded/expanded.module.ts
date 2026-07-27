import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ExpandedAdminController, ExpandedPublicController } from './expanded.controller';
import { ExpandedService } from './expanded.service';

@Module({
  imports: [AuthModule],
  controllers: [ExpandedPublicController, ExpandedAdminController],
  providers: [ExpandedService],
  exports: [ExpandedService],
})
export class ExpandedModule {}
