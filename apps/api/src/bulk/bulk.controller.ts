import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { Roles } from '../auth/auth.decorators';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { successEnvelope } from '../catalog/catalog.responses';
import { BULK_RESOURCES, bulkResource } from './bulk-resources';
import { BulkOperationsService } from './bulk.service';

const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const CONTENT_TYPES: Record<string, string> = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function actorId(req: AuthenticatedRequest): string {
  if (!req.user?.sub)
    throw new BadRequestException('Authenticated admin is required');
  return req.user.sub;
}

function format(value: unknown): 'csv' | 'xlsx' {
  return value === 'xlsx' ? 'xlsx' : 'csv';
}

@ApiTags('bulk-admin')
@ApiBearerAuth()
@Controller('admin/bulk')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class BulkOperationsController {
  constructor(private readonly bulk: BulkOperationsService) {}

  @Get('resources') async resources(@Req() req: AuthenticatedRequest) {
    return successEnvelope(
      req,
      Object.values(BULK_RESOURCES).map((definition) => ({
        key: definition.key,
        label: definition.label,
        columns: definition.columns,
        requiredColumns: definition.requiredColumns,
        updatableColumns: definition.updatableColumns,
      })),
    );
  }

  @Get(':resource/records') async records(
    @Req() req: AuthenticatedRequest,
    @Param('resource') resource: string,
  ) {
    return successEnvelope(req, await this.bulk.listRecords(resource));
  }

  @Get(':resource/template') async template(
    @Param('resource') resource: string,
    @Query('format') formatQuery: string | undefined,
    @Res() res: Response,
  ) {
    bulkResource(resource);
    const { buffer, extension } = await this.bulk.template(
      resource,
      format(formatQuery),
    );
    res.setHeader('Content-Type', CONTENT_TYPES[extension]);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${resource}-template.${extension}"`,
    );
    res.send(buffer);
  }

  @Get(':resource/export') async export(
    @Param('resource') resource: string,
    @Query('format') formatQuery: string | undefined,
    @Res() res: Response,
  ) {
    bulkResource(resource);
    const { buffer, extension } = await this.bulk.export(
      resource,
      format(formatQuery),
    );
    res.setHeader('Content-Type', CONTENT_TYPES[extension]);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${resource}-export.${extension}"`,
    );
    res.send(buffer);
  }

  @Post(':resource/dry-run')
  @UseInterceptors(FileInterceptor('file'))
  async dryRun(
    @Req() req: AuthenticatedRequest,
    @Param('resource') resource: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file)
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'A file is required',
        details: null,
      });
    if (file.size > MAX_UPLOAD_BYTES)
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'File exceeds the 3MB limit',
        details: null,
      });
    return successEnvelope(
      req,
      await this.bulk.dryRun(resource, file.buffer, file.originalname),
    );
  }

  @Post(':resource/import')
  @UseInterceptors(FileInterceptor('file'))
  async import(
    @Req() req: AuthenticatedRequest,
    @Param('resource') resource: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('mode') mode: string | undefined,
  ) {
    if (!file)
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'A file is required',
        details: null,
      });
    if (file.size > MAX_UPLOAD_BYTES)
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'File exceeds the 3MB limit',
        details: null,
      });
    const importMode = mode === 'upsert' ? 'upsert' : 'create';
    return successEnvelope(
      req,
      await this.bulk.import(
        resource,
        file.buffer,
        file.originalname,
        importMode,
        req,
        actorId(req),
      ),
    );
  }

  @Post(':resource/bulk-update') async bulkUpdate(
    @Req() req: AuthenticatedRequest,
    @Param('resource') resource: string,
    @Body() body: { ids?: string[]; fields?: Record<string, unknown> },
  ) {
    return successEnvelope(
      req,
      await this.bulk.bulkUpdate(
        resource,
        body.ids ?? [],
        body.fields ?? {},
        req,
        actorId(req),
      ),
    );
  }

  @Post(':resource/bulk-archive') async bulkArchive(
    @Req() req: AuthenticatedRequest,
    @Param('resource') resource: string,
    @Body() body: { ids?: string[] },
  ) {
    return successEnvelope(
      req,
      await this.bulk.bulkArchive(resource, body.ids ?? [], req, actorId(req)),
    );
  }
}
