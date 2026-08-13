import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoursesController } from './courses.controller';
import { AdminCoursesController } from './admin-courses.controller';
import { CoursesService } from './courses.service';
import { SeoManagementModule } from '../seo-management/seo-management.module';
@Module({
  imports: [AuthModule, SeoManagementModule],
  controllers: [CoursesController, AdminCoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
