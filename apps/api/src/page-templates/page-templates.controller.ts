import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { Roles } from '../auth/auth.decorators';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { successEnvelope } from '../catalog/catalog.responses';
import { VersionsService } from '../versions/versions.service';
import { PageTemplatesService } from './page-templates.service';

@ApiTags('page-templates-admin')
@ApiBearerAuth()
@Controller('admin/page-templates')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class PageTemplatesAdminController {
  constructor(
    private readonly templates: PageTemplatesService,
    private readonly versions: VersionsService,
  ) {}

  @Get() async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: Record<string, string>,
  ) {
    return successEnvelope(
      req,
      await this.templates.list({
        pageFamily: query.pageFamily,
        includeArchived: query.includeArchived === 'true',
      }),
    );
  }

  @Get(':id') async detail(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(req, await this.templates.detail(id));
  }

  @Post() async create(
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    const created = await this.templates.create(
      {
        name: body.name as string,
        templateKey: body.templateKey as string | undefined,
        description: body.description as string | null | undefined,
        pageFamily: body.pageFamily as string,
        defaultSections: body.defaultSections,
        layoutConfig: body.layoutConfig as
          Record<string, unknown> | null | undefined,
        isActive: body.isActive as boolean | undefined,
      },
      req.user?.sub,
    );
    await this.versions.record({
      resourceType: 'PAGE_TEMPLATE',
      resourceId: created.id,
      changeSummary: 'Template created',
      sourceAction: 'create',
      actorUserId: req.user?.sub ?? null,
    });
    return successEnvelope(req, created);
  }

  @Patch(':id') async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const updated = await this.templates.update(
      id,
      {
        name: body.name as string | undefined,
        templateKey: body.templateKey as string | undefined,
        description: body.description as string | null | undefined,
        pageFamily: body.pageFamily as string | undefined,
        defaultSections: body.defaultSections,
        layoutConfig: body.layoutConfig as
          Record<string, unknown> | null | undefined,
        isActive: body.isActive as boolean | undefined,
        chrome: body.chrome,
      },
      req.user?.sub,
    );
    await this.versions.record({
      resourceType: 'PAGE_TEMPLATE',
      resourceId: id,
      changeSummary: 'Template updated',
      sourceAction: 'update',
      actorUserId: req.user?.sub ?? null,
    });
    return successEnvelope(req, updated);
  }

  @Post(':id/duplicate') async duplicate(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(
      req,
      await this.templates.duplicate(id, req.user?.sub),
    );
  }

  @Delete(':id') async archive(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(req, await this.templates.archive(id));
  }

  @Post('assign/:pageId') async assign(
    @Req() req: AuthenticatedRequest,
    @Param('pageId') pageId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return successEnvelope(
      req,
      await this.templates.assignToPage(
        pageId,
        (body.templateId as string | null) ?? null,
      ),
    );
  }

  /** One action for the admin's single "Apply template" button: assigns the
   * template when `templateId` is supplied, then applies its sections.
   * Kept on the historical path so existing clients keep working. */
  @Post('apply-defaults/:pageId') async applyDefaults(
    @Req() req: AuthenticatedRequest,
    @Param('pageId') pageId: string,
    @Body() body?: Record<string, unknown>,
  ) {
    const templateId = body?.templateId as string | null | undefined;
    return successEnvelope(
      req,
      await this.templates.applyTemplateToPage(pageId, templateId),
    );
  }
}
