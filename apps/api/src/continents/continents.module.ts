import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminContinentsController } from './admin-continents.controller';
import { ContinentsController } from './continents.controller';
import { ContinentsService } from './continents.service';

@Module({
  imports: [AuthModule],
  controllers: [ContinentsController, AdminContinentsController],
  providers: [ContinentsService],
  exports: [ContinentsService],
})
export class ContinentsModule {}
