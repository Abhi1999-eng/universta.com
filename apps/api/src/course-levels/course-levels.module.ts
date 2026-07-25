import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CourseLevelsController } from './course-levels.controller';
import { AdminCourseLevelsController } from './admin-course-levels.controller';
import { CourseLevelsService } from './course-levels.service';
@Module({
  imports: [AuthModule],
  controllers: [CourseLevelsController, AdminCourseLevelsController],
  providers: [CourseLevelsService],
  exports: [CourseLevelsService],
})
export class CourseLevelsModule {}
