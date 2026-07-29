import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  ExperimentsAdminController,
  ExperimentsPublicController,
} from './experiments.controller';
import { ExperimentsService } from './experiments.service';

@Module({
  imports: [AuthModule],
  controllers: [ExperimentsAdminController, ExperimentsPublicController],
  providers: [ExperimentsService],
  exports: [ExperimentsService],
})
export class ExperimentsModule {}
