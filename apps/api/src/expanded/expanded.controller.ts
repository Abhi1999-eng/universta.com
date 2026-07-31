import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  NotFoundException,
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
import type { RequestWithId } from '../common/http.types';
import { VersionsService } from '../versions/versions.service';
import { ExpandedService, type Resource } from './expanded.service';

const CONTENT = [
  'universities',
  'scholarships',
  'consultants',
  'jobs',
  'events',
  'success-stories',
  'testimonials',
] as const;
type Content = (typeof CONTENT)[number];
function content(value: string): Content {
  if (!(CONTENT as readonly string[]).includes(value))
    throw new NotFoundException('Public resource not found');
  return value as Content;
}

const ADMIN_CONTENT = [
  ...CONTENT,
  'offerings',
  'pages',
  'navigation-menus',
  'contact-inquiries',
] as const;

function adminContent(value: string): Resource {
  if (!(ADMIN_CONTENT as readonly string[]).includes(value))
    throw new NotFoundException('Admin resource not found');
  return value as Resource;
}

function writableAdminContent(
  value: string,
): Exclude<Resource, 'contact-inquiries'> {
  const resource = adminContent(value);
  if (resource === 'contact-inquiries')
    throw new NotFoundException('Admin resource not found');
  return resource;
}

@ApiTags('expanded-phase1-public')
@Controller('phase1')
export class ExpandedPublicController {
  constructor(private readonly service: ExpandedService) {}

  @Get('pages/:slug') async page(
    @Req() req: RequestWithId,
    @Param('slug') slug: string,
  ) {
    const header = req.headers['x-anon-id'];
    const anonymousId = Array.isArray(header) ? header[0] : header;
    return successEnvelope(
      req,
      await this.service.editorial(slug, anonymousId),
    );
  }
  @Get('navigation/:menuKey') async navigation(
    @Req() req: RequestWithId,
    @Param('menuKey') menuKey: string,
  ) {
    return successEnvelope(req, await this.service.navigation(menuKey));
  }
  @Post('public/contact-inquiries')
  @Header('Cache-Control', 'no-store')
  async contact(
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return successEnvelope(
      req,
      await this.service.createContact(body, req.get('origin')),
    );
  }
  @Get('universities') async universities(
    @Req() req: RequestWithId,
    @Query() query: Record<string, string>,
  ) {
    const result = await this.service.list('universities', query);
    return successEnvelope(req, result.data, result.meta);
  }
  @Get('universities/:slug') async university(
    @Req() req: RequestWithId,
    @Param('slug') slug: string,
  ) {
    return successEnvelope(
      req,
      await this.service.detail('universities', slug),
    );
  }
  @Get('universities/:slug/courses') async universityCourses(
    @Req() req: RequestWithId,
    @Param('slug') slug: string,
    @Query() query: Record<string, string>,
  ) {
    const result = await this.service.universityOfferings(
      slug,
      undefined,
      query,
    );
    return successEnvelope(req, result);
  }
  @Get('universities/:slug/courses/:offeringSlug') async universityCourse(
    @Req() req: RequestWithId,
    @Param('slug') slug: string,
    @Param('offeringSlug') offeringSlug: string,
  ) {
    return successEnvelope(
      req,
      await this.service.universityOfferings(slug, offeringSlug),
    );
  }
  @Get('consultant-locations/:slug') async location(
    @Req() req: RequestWithId,
    @Param('slug') slug: string,
  ) {
    return successEnvelope(req, await this.service.consultantLocation(slug));
  }
  @Get('compare/:type') async compare(
    @Req() req: RequestWithId,
    @Param('type')
    type: 'countries' | 'universities' | 'courses' | 'consultants',
    @Query('items') raw = '',
  ) {
    if (!['countries', 'universities', 'courses', 'consultants'].includes(type))
      throw new Error('Unknown comparison type');
    return successEnvelope(
      req,
      await this.service.compare(type, raw.split(',')),
    );
  }
  @Get('redirects') async redirect(
    @Req() req: RequestWithId,
    @Query('path') path: string,
  ) {
    return successEnvelope(req, await this.service.resolveRedirect(path));
  }
  @Get(':resource') async list(
    @Req() req: RequestWithId,
    @Param('resource') resource: string,
    @Query() query: Record<string, string>,
  ) {
    const result = await this.service.list(content(resource), query);
    return successEnvelope(req, result.data, result.meta);
  }
  @Get(':resource/:slug') async detail(
    @Req() req: RequestWithId,
    @Param('resource') resource: string,
    @Param('slug') slug: string,
  ) {
    return successEnvelope(
      req,
      await this.service.detail(content(resource), slug),
    );
  }
}

@ApiTags('expanded-phase1-admin')
@ApiBearerAuth()
@Controller('admin/phase1')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class ExpandedAdminController {
  constructor(
    private readonly service: ExpandedService,
    private readonly versions: VersionsService,
  ) {}

  /** Records a version after a successful Website Builder write.
   *
   * This lives in the controller rather than inside ExpandedService because
   * only the Website Builder resources are versioned, while the service's
   * generic CRUD is shared by every editorial resource. Recording after the
   * write means the newest version always equals the live state. */
  /** Captures the pre-change state the first time a resource is edited. */
  private async baseline(
    resourceType: 'PAGE' | 'PAGE_SECTION',
    resourceId: string,
    req: AuthenticatedRequest,
  ) {
    await this.versions.ensureBaseline(resourceType, resourceId, req.user?.sub);
  }

  private async version(
    resourceType: 'PAGE' | 'PAGE_SECTION',
    resourceId: string,
    changeSummary: string,
    sourceAction: string,
    req: AuthenticatedRequest,
  ) {
    await this.versions.record({
      resourceType,
      resourceId,
      changeSummary,
      sourceAction,
      actorUserId: req.user?.sub ?? null,
    });
  }

  @Get('form-options') async formOptions(@Req() req: AuthenticatedRequest) {
    return successEnvelope(req, await this.service.formOptions());
  }
  @Get(':resource') async list(
    @Req() req: AuthenticatedRequest,
    @Param('resource') resource: string,
    @Query() query: Record<string, string>,
  ) {
    const result = await this.service.adminList(adminContent(resource), query);
    return successEnvelope(req, result.data, result.meta);
  }
  @Get(':resource/:id') async detail(
    @Req() req: AuthenticatedRequest,
    @Param('resource') resource: string,
    @Param('id') id: string,
  ) {
    return successEnvelope(
      req,
      await this.service.adminDetail(adminContent(resource), id),
    );
  }
  @Post(':resource') async create(
    @Req() req: AuthenticatedRequest,
    @Param('resource') resource: string,
    @Body() body: Record<string, unknown>,
  ) {
    const created = await this.service.adminCreate(
      writableAdminContent(resource),
      body,
    );
    if (resource === 'pages' && created?.id)
      await this.version('PAGE', created.id, 'Page created', 'create', req);
    return successEnvelope(req, created);
  }
  @Patch(':resource/:id') async update(
    @Req() req: AuthenticatedRequest,
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    if (resource === 'pages') await this.baseline('PAGE', id, req);
    const updated = await this.service.adminUpdate(
      writableAdminContent(resource),
      id,
      body,
    );
    if (resource === 'pages')
      await this.version(
        'PAGE',
        id,
        `Page details updated (${
          Object.keys(body ?? {})
            .slice(0, 6)
            .join(', ') || 'no fields'
        })`,
        'update',
        req,
      );
    return successEnvelope(req, updated);
  }
  @Post(':resource/:id/publish') async publish(
    @Req() req: AuthenticatedRequest,
    @Param('resource') resource: string,
    @Param('id') id: string,
  ) {
    if (resource === 'pages') await this.baseline('PAGE', id, req);
    const published = await this.service.adminPublish(
      writableAdminContent(resource),
      id,
      true,
    );
    if (resource === 'pages')
      await this.version('PAGE', id, 'Page published', 'publish', req);
    return successEnvelope(req, published);
  }
  @Post(':resource/:id/unpublish') async unpublish(
    @Req() req: AuthenticatedRequest,
    @Param('resource') resource: string,
    @Param('id') id: string,
  ) {
    if (resource === 'pages') await this.baseline('PAGE', id, req);
    const unpublished = await this.service.adminPublish(
      writableAdminContent(resource),
      id,
      false,
    );
    if (resource === 'pages')
      await this.version('PAGE', id, 'Page unpublished', 'unpublish', req);
    return successEnvelope(req, unpublished);
  }
  @Delete(':resource/:id') async remove(
    @Req() req: AuthenticatedRequest,
    @Param('resource') resource: string,
    @Param('id') id: string,
  ) {
    return successEnvelope(
      req,
      await this.service.adminDelete(adminContent(resource), id),
    );
  }
  @Post('contact-inquiries/:id/convert') async convert(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(
      req,
      await this.service.convertContact(id, req.user),
    );
  }
  @Get('pages/:id/preview') async pagePreview(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(req, await this.service.previewPage(id));
  }
  @Post('pages/:id/sections') async createSection(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    await this.baseline('PAGE', id, req);
    const section = await this.service.createPageSection(id, body);
    await this.version(
      'PAGE_SECTION',
      section.id,
      `Section "${section.heading ?? section.sectionKey}" added`,
      'create',
      req,
    );
    await this.version('PAGE', id, 'Section added to page', 'section-add', req);
    return successEnvelope(req, section);
  }
  @Patch('pages/:id/sections/:sectionId') async updateSection(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
    @Body() body: Record<string, unknown>,
  ) {
    await this.baseline('PAGE_SECTION', sectionId, req);
    const section = await this.service.updatePageSection(id, sectionId, body);
    // "visibility" is the only key on a device-visibility save, so naming it
    // makes the history readable without opening each version.
    const summary =
      body && Object.keys(body).length === 1 && 'visibility' in body
        ? 'Device visibility changed'
        : `Section "${section.heading ?? section.sectionKey}" edited`;
    await this.version(
      'PAGE_SECTION',
      sectionId,
      summary,
      'visibility' in (body ?? {}) ? 'visibility' : 'update',
      req,
    );
    return successEnvelope(req, section);
  }
  @Delete('pages/:id/sections/:sectionId') async deleteSection(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
  ) {
    await this.baseline('PAGE', id, req);
    const removed = await this.service.deletePageSection(id, sectionId);
    await this.version(
      'PAGE',
      id,
      'Section removed from page',
      'section-remove',
      req,
    );
    return successEnvelope(req, removed);
  }
  @Post('pages/:id/sections/:sectionId/duplicate') async duplicateSection(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
  ) {
    const copy = await this.service.duplicatePageSection(id, sectionId);
    await this.version(
      'PAGE_SECTION',
      copy.id,
      'Section duplicated',
      'duplicate',
      req,
    );
    await this.version(
      'PAGE',
      id,
      'Section duplicated on page',
      'section-add',
      req,
    );
    return successEnvelope(req, copy);
  }
  @Post('pages/:id/sections/reorder') async reorderSections(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { order?: string[] },
  ) {
    await this.baseline('PAGE', id, req);
    const ordered = await this.service.reorderPageSections(
      id,
      body.order ?? [],
    );
    await this.version('PAGE', id, 'Sections reordered', 'reorder', req);
    return successEnvelope(req, ordered);
  }
}
