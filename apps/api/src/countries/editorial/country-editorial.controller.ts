import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../../auth/access-token.guard';
import { Roles } from '../../auth/auth.decorators';
import { RolesGuard } from '../../auth/roles.guard';
import type { AuthenticatedRequest } from '../../auth/auth.types';
import type { RequestWithId } from '../../common/http.types';
import { successEnvelope } from '../../catalog/catalog.responses';
import { CountryEditorialService } from './country-editorial.service';
import {
  ConsultantCardDto,
  ContentSectionDto,
  FaqDto,
  MediaOptionsQueryDto,
  SeoMetadataDto,
} from './editorial.dto';

@ApiTags('country-editorial')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminCountryEditorialController {
  constructor(private readonly editorial: CountryEditorialService) {}
  @Get('countries/:countryId/editorial') async all(
    @Req() r: AuthenticatedRequest,
    @Param('countryId') id: string,
  ) {
    return successEnvelope(r, await this.editorial.adminEditorial(id));
  }
  @Get('countries/:countryId/content-sections') async sections(
    @Req() r: AuthenticatedRequest,
    @Param('countryId') id: string,
  ) {
    return successEnvelope(
      r,
      (await this.editorial.adminEditorial(id)).sections,
    );
  }
  @Post('countries/:countryId/content-sections') async createSection(
    @Req() r: AuthenticatedRequest,
    @Param('countryId') id: string,
    @Body() dto: ContentSectionDto,
  ) {
    return successEnvelope(r, await this.editorial.createSection(id, dto, r));
  }
  @Patch('countries/:countryId/content-sections/:sectionId')
  async updateSection(
    @Req() r: AuthenticatedRequest,
    @Param('countryId') id: string,
    @Param('sectionId') sectionId: string,
    @Body() dto: ContentSectionDto,
  ) {
    return successEnvelope(
      r,
      await this.editorial.updateSection(id, sectionId, dto, r),
    );
  }
  @Delete('countries/:countryId/content-sections/:sectionId')
  async deleteSection(
    @Req() r: AuthenticatedRequest,
    @Param('countryId') id: string,
    @Param('sectionId') sectionId: string,
    @Body() dto: { expectedUpdatedAt?: string },
  ) {
    return successEnvelope(
      r,
      await this.editorial.deleteSection(
        id,
        sectionId,
        dto.expectedUpdatedAt,
        r,
      ),
    );
  }
  @Get('countries/:countryId/faqs') async faqs(
    @Req() r: AuthenticatedRequest,
    @Param('countryId') id: string,
  ) {
    return successEnvelope(r, (await this.editorial.adminEditorial(id)).faqs);
  }
  @Post('countries/:countryId/faqs') async createFaq(
    @Req() r: AuthenticatedRequest,
    @Param('countryId') id: string,
    @Body() dto: FaqDto,
  ) {
    return successEnvelope(r, await this.editorial.createFaq(id, dto, r));
  }
  @Patch('countries/:countryId/faqs/:faqId') async updateFaq(
    @Req() r: AuthenticatedRequest,
    @Param('countryId') id: string,
    @Param('faqId') faqId: string,
    @Body() dto: FaqDto,
  ) {
    return successEnvelope(
      r,
      await this.editorial.updateFaq(id, faqId, dto, r),
    );
  }
  @Delete('countries/:countryId/faqs/:faqId') async deleteFaq(
    @Req() r: AuthenticatedRequest,
    @Param('countryId') id: string,
    @Param('faqId') faqId: string,
    @Body() dto: { expectedUpdatedAt?: string },
  ) {
    return successEnvelope(
      r,
      await this.editorial.deleteFaq(id, faqId, dto.expectedUpdatedAt, r),
    );
  }
  @Get('countries/:countryId/seo') async seo(
    @Req() r: AuthenticatedRequest,
    @Param('countryId') id: string,
  ) {
    return successEnvelope(r, (await this.editorial.adminEditorial(id)).seo);
  }
  @Put('countries/:countryId/seo') async saveSeo(
    @Req() r: AuthenticatedRequest,
    @Param('countryId') id: string,
    @Body() dto: SeoMetadataDto,
  ) {
    return successEnvelope(r, await this.editorial.saveSeo(id, dto, r));
  }
  @Delete('countries/:countryId/seo') async deleteSeo(
    @Req() r: AuthenticatedRequest,
    @Param('countryId') id: string,
    @Body() dto: { expectedUpdatedAt?: string },
  ) {
    return successEnvelope(
      r,
      await this.editorial.deleteSeo(id, dto.expectedUpdatedAt, r),
    );
  }
  @Get('countries/:countryId/consultant-cards') async cards(
    @Req() r: AuthenticatedRequest,
    @Param('countryId') id: string,
  ) {
    return successEnvelope(
      r,
      (await this.editorial.adminEditorial(id)).consultantCards,
    );
  }
  @Post('countries/:countryId/consultant-cards') async createCard(
    @Req() r: AuthenticatedRequest,
    @Param('countryId') id: string,
    @Body() dto: ConsultantCardDto,
  ) {
    return successEnvelope(r, await this.editorial.createCard(id, dto, r));
  }
  @Patch('countries/:countryId/consultant-cards/:cardId') async updateCard(
    @Req() r: AuthenticatedRequest,
    @Param('countryId') id: string,
    @Param('cardId') cardId: string,
    @Body() dto: ConsultantCardDto,
  ) {
    return successEnvelope(
      r,
      await this.editorial.updateCard(id, cardId, dto, r),
    );
  }
  @Delete('countries/:countryId/consultant-cards/:cardId') async deleteCard(
    @Req() r: AuthenticatedRequest,
    @Param('countryId') id: string,
    @Param('cardId') cardId: string,
    @Body() dto: { expectedUpdatedAt?: string },
  ) {
    return successEnvelope(
      r,
      await this.editorial.deleteCard(id, cardId, dto.expectedUpdatedAt, r),
    );
  }
  @Get('media-options') async media(
    @Req() r: AuthenticatedRequest,
    @Query() query: MediaOptionsQueryDto,
  ) {
    return successEnvelope(r, await this.editorial.mediaOptions(query));
  }
}

@ApiTags('countries')
@Controller('countries')
export class PublicCountryEditorialController {
  constructor(private readonly editorial: CountryEditorialService) {}
  @Get(':slug/page') async page(
    @Req() r: RequestWithId,
    @Param('slug') slug: string,
  ) {
    return successEnvelope(r, await this.editorial.publicPage(slug));
  }
}
