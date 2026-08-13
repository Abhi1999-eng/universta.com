import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SubjectsController } from './subjects.controller';
import { AdminSubjectsController } from './admin-subjects.controller';
import { SubjectsService } from './subjects.service';
import { SeoManagementModule } from '../seo-management/seo-management.module';

@Module({
  imports: [AuthModule, SeoManagementModule],
  controllers: [SubjectsController, AdminSubjectsController],
  providers: [SubjectsService],
  exports: [SubjectsService],
})
export class SubjectsModule {}
