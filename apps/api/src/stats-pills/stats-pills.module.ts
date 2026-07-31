import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VersionsModule } from '../versions/versions.module';
import {
  StatsPillsAdminController,
  StatsPillsPublicController,
} from './stats-pills.controller';
import { StatsPillsService } from './stats-pills.service';

@Module({
  imports: [AuthModule, VersionsModule],
  controllers: [StatsPillsPublicController, StatsPillsAdminController],
  providers: [StatsPillsService],
  exports: [StatsPillsService],
})
export class StatsPillsModule {}
