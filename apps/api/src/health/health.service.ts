import { Injectable } from '@nestjs/common';
import { RequestContextService } from '../common/request-context.service';
import { StructuredLogger } from '../common/structured-logger.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: RequestContextService,
    private readonly logger: StructuredLogger,
  ) {}

  async isDatabaseUp(): Promise<boolean> {
    try {
      await this.prisma.checkDatabaseConnection();
      return true;
    } catch {
      this.logger.logError('database health check failed', {
        requestId: this.context.getRequestId(),
        reason: 'DATABASE_UNAVAILABLE',
      });
      return false;
    }
  }
}
