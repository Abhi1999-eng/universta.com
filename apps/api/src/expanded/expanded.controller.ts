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
    throw new Error('Unknown public content resource');
  return value as Content;
}

const ADMIN_CONTENT = [
  ...CONTENT,
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
    return successEnvelope(req, await this.service.editorial(slug));
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
  constructor(private readonly service: ExpandedService) {}
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
    return successEnvelope(
      req,
      await this.service.adminCreate(writableAdminContent(resource), body),
    );
  }
  @Patch(':resource/:id') async update(
    @Req() req: AuthenticatedRequest,
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return successEnvelope(
      req,
      await this.service.adminUpdate(writableAdminContent(resource), id, body),
    );
  }
  @Post(':resource/:id/publish') async publish(
    @Req() req: AuthenticatedRequest,
    @Param('resource') resource: string,
    @Param('id') id: string,
  ) {
    return successEnvelope(
      req,
      await this.service.adminPublish(writableAdminContent(resource), id, true),
    );
  }
  @Post(':resource/:id/unpublish') async unpublish(
    @Req() req: AuthenticatedRequest,
    @Param('resource') resource: string,
    @Param('id') id: string,
  ) {
    return successEnvelope(
      req,
      await this.service.adminPublish(
        writableAdminContent(resource),
        id,
        false,
      ),
    );
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
}
