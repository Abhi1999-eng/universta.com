import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
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
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { Roles } from '../auth/auth.decorators';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { successEnvelope } from '../catalog/catalog.responses';
import type { RequestWithId } from '../common/http.types';
import { MediaService } from './media.service';

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

@ApiTags('media-admin')
@ApiBearerAuth()
@Controller('admin/media')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class MediaAdminController {
  constructor(private readonly media: MediaService) {}

  @Get() async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: Record<string, string>,
  ) {
    const result = await this.media.list(query);
    return successEnvelope(req, result.data, result.meta);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: Record<string, string>,
  ) {
    if (!file)
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'A file is required',
        details: null,
      });
    const created = await this.media.upload(
      file,
      {
        title: body.title,
        altText: body.altText,
        caption: body.caption,
        folder: body.folder,
      },
      req.user?.sub,
    );
    return successEnvelope(req, created);
  }

  @Patch(':id') async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: Record<string, string>,
  ) {
    return successEnvelope(req, await this.media.update(id, body));
  }

  @Delete(':id') async archive(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(req, await this.media.archive(id));
  }
}

@ApiTags('media-public')
@Controller('media')
export class MediaPublicController {
  constructor(private readonly media: MediaService) {}

  @Get(':filename') async serve(
    @Req() req: RequestWithId,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const path = this.media.resolveServablePath(filename);
    if (!(await this.media.isPubliclyServable(filename))) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Media file not found',
        details: null,
      });
    }
    try {
      await stat(path);
    } catch {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Media file not found',
        details: null,
      });
    }
    const extension = filename.slice(filename.lastIndexOf('.'));
    res.setHeader(
      'Content-Type',
      CONTENT_TYPES[extension] ?? 'application/octet-stream',
    );
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    createReadStream(path).pipe(res);
  }
}
