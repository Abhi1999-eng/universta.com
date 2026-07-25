import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StudyModesController } from './study-modes.controller';
import { AdminStudyModesController } from './admin-study-modes.controller';
import { StudyModesService } from './study-modes.service';
@Module({
  imports: [AuthModule],
  controllers: [StudyModesController, AdminStudyModesController],
  providers: [StudyModesService],
  exports: [StudyModesService],
})
export class StudyModesModule {}
