import { Global, Module } from '@nestjs/common';
import { RequestContextService } from './request-context.service';
import { StructuredLogger } from './structured-logger.service';

@Global()
@Module({
  providers: [RequestContextService, StructuredLogger],
  exports: [RequestContextService, StructuredLogger],
})
export class CommonModule {}
