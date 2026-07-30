import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BulkOperationsController } from './bulk.controller';
import { BulkOperationsService } from './bulk.service';

@Module({
  imports: [AuthModule],
  controllers: [BulkOperationsController],
  providers: [BulkOperationsService],
  exports: [BulkOperationsService],
})
export class BulkModule {}
