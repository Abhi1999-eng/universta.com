import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { Roles } from '../auth/auth.decorators';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { successEnvelope } from '../catalog/catalog.responses';
import type { RequestWithId } from '../common/http.types';
import { ExpandedService } from './expanded.service';

const CONTENT = ['universities', 'scholarships', 'consultants', 'jobs', 'events', 'success-stories', 'testimonials'] as const;
type Content = (typeof CONTENT)[number];
function content(value: string): Content { if (!(CONTENT as readonly string[]).includes(value)) throw new Error('Unknown public content resource'); return value as Content; }

@ApiTags('expanded-phase1-public')
@Controller('phase1')
export class ExpandedPublicController {
  constructor(private readonly service: ExpandedService) {}

  @Get('pages/:slug') async page(@Req() req: RequestWithId, @Param('slug') slug: string) { return successEnvelope(req, await this.service.editorial(slug)); }
  @Get('navigation/:menuKey') async navigation(@Req() req: RequestWithId, @Param('menuKey') menuKey: string) { return successEnvelope(req, await this.service.navigation(menuKey)); }
  @Post('public/contact-inquiries') @Header('Cache-Control', 'no-store') async contact(@Req() req: AuthenticatedRequest, @Body() body: Record<string, unknown>) { return successEnvelope(req, await this.service.createContact(body, req.get('origin'))); }
  @Get('universities') async universities(@Req() req: RequestWithId, @Query() query: Record<string, string>) { const result = await this.service.list('universities', query); return successEnvelope(req, result.data, result.meta); }
  @Get('universities/:slug') async university(@Req() req: RequestWithId, @Param('slug') slug: string) { return successEnvelope(req, await this.service.detail('universities', slug)); }
  @Get('universities/:slug/courses') async universityCourses(@Req() req: RequestWithId, @Param('slug') slug: string, @Query() query: Record<string, string>) { const result = await this.service.universityOfferings(slug, undefined, query); return successEnvelope(req, result); }
  @Get('universities/:slug/courses/:offeringSlug') async universityCourse(@Req() req: RequestWithId, @Param('slug') slug: string, @Param('offeringSlug') offeringSlug: string) { return successEnvelope(req, await this.service.universityOfferings(slug, offeringSlug)); }
  @Get('consultant-locations/:slug') async location(@Req() req: RequestWithId, @Param('slug') slug: string) { return successEnvelope(req, await this.service.consultantLocation(slug)); }
  @Get('compare/:type') async compare(@Req() req: RequestWithId, @Param('type') type: 'countries' | 'universities' | 'courses' | 'consultants', @Query('items') raw = '') { if (!['countries', 'universities', 'courses', 'consultants'].includes(type)) throw new Error('Unknown comparison type'); return successEnvelope(req, await this.service.compare(type, raw.split(','))); }
  @Get(':resource') async list(@Req() req: RequestWithId, @Param('resource') resource: string, @Query() query: Record<string, string>) { const result = await this.service.list(content(resource), query); return successEnvelope(req, result.data, result.meta); }
  @Get(':resource/:slug') async detail(@Req() req: RequestWithId, @Param('resource') resource: string, @Param('slug') slug: string) { return successEnvelope(req, await this.service.detail(content(resource), slug)); }
}

@ApiTags('expanded-phase1-admin')
@ApiBearerAuth()
@Controller('admin/phase1')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class ExpandedAdminController {
  constructor(private readonly service: ExpandedService) {}
  @Get(':resource') async list(@Req() req: AuthenticatedRequest, @Param('resource') resource: any, @Query() query: Record<string, string>) { const result = await this.service.adminList(resource, query); return successEnvelope(req, result.data, result.meta); }
  @Get(':resource/:id') async detail(@Req() req: AuthenticatedRequest, @Param('resource') resource: any, @Param('id') id: string) { return successEnvelope(req, await this.service.adminDetail(resource, id)); }
  @Post(':resource') async create(@Req() req: AuthenticatedRequest, @Param('resource') resource: any, @Body() body: Record<string, unknown>) { return successEnvelope(req, await this.service.adminCreate(resource, body)); }
  @Patch(':resource/:id') async update(@Req() req: AuthenticatedRequest, @Param('resource') resource: any, @Param('id') id: string, @Body() body: Record<string, unknown>) { return successEnvelope(req, await this.service.adminUpdate(resource, id, body)); }
  @Post(':resource/:id/publish') async publish(@Req() req: AuthenticatedRequest, @Param('resource') resource: any, @Param('id') id: string) { return successEnvelope(req, await this.service.adminPublish(resource, id, true)); }
  @Post(':resource/:id/unpublish') async unpublish(@Req() req: AuthenticatedRequest, @Param('resource') resource: any, @Param('id') id: string) { return successEnvelope(req, await this.service.adminPublish(resource, id, false)); }
  @Delete(':resource/:id') async remove(@Req() req: AuthenticatedRequest, @Param('resource') resource: any, @Param('id') id: string) { return successEnvelope(req, await this.service.adminDelete(resource, id)); }
  @Post('contact-inquiries/:id/convert') async convert(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return successEnvelope(req, await this.service.convertContact(id, req.user)); }
}
