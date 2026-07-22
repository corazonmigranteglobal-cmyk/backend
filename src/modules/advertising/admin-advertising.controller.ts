import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { AdvertisingCampaignsService } from './advertising-campaigns.service';
import { AdvertisingCompaniesService } from './advertising-companies.service';
import { AdvertisingCreativesService } from './advertising-creatives.service';
import { AdvertisingPlacementsService } from './advertising-placements.service';
import { AdvertisingQueryDto } from './dto/advertising-query.dto';
import {
  CreateAdsCampaignDto,
  SetAdsCampaignStatusDto,
  UpdateAdsCampaignDto,
} from './dto/campaign.dto';
import { CreateAdsCompanyDto, UpdateAdsCompanyDto } from './dto/company.dto';
import { CreateAdsAdDto, CreateAdsCreativeDto, UpdateAdsCreativeDto } from './dto/creative.dto';
import { CreateAdsPlacementDto, UpdateAdsPlacementDto } from './dto/placement.dto';

@ApiTags('Administración de publicidad')
@ApiBearerAuth()
@Controller('admin/advertising')
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminAdvertisingController {
  constructor(
    private readonly campaigns: AdvertisingCampaignsService,
    private readonly companies: AdvertisingCompaniesService,
    private readonly creatives: AdvertisingCreativesService,
    private readonly placements: AdvertisingPlacementsService,
  ) {}

  @Get('companies')
  listCompanies() {
    return this.companies.list();
  }

  @Post('companies')
  createCompany(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAdsCompanyDto) {
    return this.companies.create(user.sub, dto);
  }

  @Patch('companies/:id')
  updateCompany(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAdsCompanyDto,
  ) {
    return this.companies.update(user.sub, id, dto);
  }

  @Delete('companies/:id')
  removeCompany(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.companies.remove(user.sub, id);
  }

  @Get('placements')
  listPlacements() {
    return this.placements.list();
  }

  @Post('placements')
  createPlacement(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAdsPlacementDto) {
    return this.placements.create(user.sub, dto);
  }

  @Patch('placements/:id')
  updatePlacement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAdsPlacementDto,
  ) {
    return this.placements.update(user.sub, id, dto);
  }

  @Get('ads')
  listAds() {
    return this.creatives.listAll();
  }

  @Post('ads')
  async createAd(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAdsAdDto) {
    const {
      campaignId,
      publicationId,
      publicationIds = [],
      categoryId,
      categoryIds = [],
      placementId,
      placementIds = [],
      pageSlug,
      pageSlugs = [],
      ...creative
    } = dto;
    const normalizedPublicationIds = [...(publicationId ? [publicationId] : []), ...publicationIds];
    const normalizedCategoryIds = [...(categoryId ? [categoryId] : []), ...categoryIds];
    const normalizedPlacementIds = [...(placementId ? [placementId] : []), ...placementIds];
    const normalizedPageSlugs = [...(pageSlug ? [pageSlug] : []), ...pageSlugs];

    const created = await this.creatives.create(user.sub, campaignId, creative);

    if (
      normalizedPublicationIds.length ||
      normalizedCategoryIds.length ||
      normalizedPlacementIds.length ||
      normalizedPageSlugs.length
    ) {
      await this.campaigns.addAssociations(user.sub, campaignId, {
        publicationIds: normalizedPublicationIds,
        categoryIds: normalizedCategoryIds,
        placementIds: normalizedPlacementIds,
        pageSlugs: normalizedPageSlugs,
      });
    }

    return created;
  }

  @Patch('ads/:id')
  updateAd(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAdsCreativeDto,
  ) {
    return this.creatives.update(user.sub, id, dto);
  }

  @Delete('ads/:id')
  removeAd(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.creatives.remove(user.sub, id);
  }

  @Get('campaigns')
  listCampaigns(@Query() query: AdvertisingQueryDto) {
    return this.campaigns.list(query);
  }

  @Post('campaigns')
  createCampaign(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAdsCampaignDto) {
    return this.campaigns.create(user.sub, dto);
  }

  @Get('campaigns/:id')
  getCampaign(@Param('id') id: string) {
    return this.campaigns.get(id);
  }

  @Patch('campaigns/:id')
  updateCampaign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAdsCampaignDto,
  ) {
    return this.campaigns.update(user.sub, id, dto);
  }

  @Delete('campaigns/:id')
  removeCampaign(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.campaigns.remove(user.sub, id);
  }

  @Post('campaigns/:id/status')
  setCampaignStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetAdsCampaignStatusDto,
  ) {
    return this.campaigns.setStatus(user.sub, id, dto);
  }

  @Get('campaigns/:campaignId/creatives')
  listCreatives(@Param('campaignId') campaignId: string) {
    return this.creatives.list(campaignId);
  }

  @Post('campaigns/:campaignId/creatives')
  createCreative(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateAdsCreativeDto,
  ) {
    return this.creatives.create(user.sub, campaignId, dto);
  }

  @Patch('creatives/:id')
  updateCreative(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAdsCreativeDto,
  ) {
    return this.creatives.update(user.sub, id, dto);
  }
}
