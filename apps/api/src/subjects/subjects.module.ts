import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SubjectsController } from './subjects.controller';
import { AdminSubjectsController } from './admin-subjects.controller';
import { SubjectsService } from './subjects.service';

@Module({
  imports: [AuthModule],
  controllers: [SubjectsController, AdminSubjectsController],
  providers: [SubjectsService],
  exports: [SubjectsService],
})
export class SubjectsModule {}
