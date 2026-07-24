import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AppService } from './app.service';
import { HealthService } from './health/health.service';

@ApiTags('system')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly healthService: HealthService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({ summary: 'Check API and database health' })
  @ApiResponse({
    status: HttpStatus.OK,
    schema: {
      example: {
        status: 'ok',
        database: 'up',
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    schema: {
      example: {
        status: 'degraded',
        database: 'down',
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    },
  })
  async getHealth(
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ status: string; database: string; timestamp: string }> {
    const databaseUp = await this.healthService.isDatabaseUp();
    if (!databaseUp) {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
      return {
        status: 'degraded',
        database: 'down',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      status: 'ok',
      database: 'up',
      timestamp: new Date().toISOString(),
    };
  }
}
