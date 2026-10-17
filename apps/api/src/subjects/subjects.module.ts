import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  CountryFieldPagesController,
  SpecializationsController,
  SubjectLevelPagesController,
  SubjectsController,
} from './subjects.controller';
import { AdminSubjectsController } from './admin-subjects.controller';
import { AdminSpecializationsController } from './admin-specializations.controller';
import { SubjectsService } from './subjects.service';
import { SubjectLevelPagesService } from './level-pages.service';
import { SeoManagementModule } from '../seo-management/seo-management.module';

@Module({
  imports: [AuthModule, SeoManagementModule],
  controllers: [
    SubjectsController,
    SpecializationsController,
    SubjectLevelPagesController,
    CountryFieldPagesController,
    AdminSubjectsController,
    AdminSpecializationsController,
  ],
  providers: [SubjectsService, SubjectLevelPagesService],
  exports: [SubjectsService, SubjectLevelPagesService],
})
export class SubjectsModule {}
