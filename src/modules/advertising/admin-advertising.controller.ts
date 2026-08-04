import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AdsCampaignDto,
  AdsCompanyDto,
  AdsCreativeDto,
  AdsPlacementDto,
} from '@/common/openapi/domain-response.dto';
import { ApiEnvelope } from '@/common/openapi/api-envelope.decorator';
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

@ApiTags('Publicidad')
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
  @ApiOperation({ summary: 'Listar empresas anunciantes' })
  @ApiEnvelope(AdsCompanyDto, { paginated: true, description: 'Empresas anunciantes registradas.' })
  listCompanies() {
    return this.companies.list();
  }

  @Post('companies')
  @ApiOperation({ summary: 'Registrar una empresa anunciante' })
  @ApiEnvelope(AdsCompanyDto, { status: 201, description: 'Empresa anunciante registrada.' })
  createCompany(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAdsCompanyDto) {
    return this.companies.create(user.sub, dto);
  }

  @Patch('companies/:id')
  @ApiOperation({ summary: 'Actualizar una empresa anunciante' })
  @ApiEnvelope(AdsCompanyDto, { description: 'Empresa actualizada.' })
  updateCompany(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAdsCompanyDto,
  ) {
    return this.companies.update(user.sub, id, dto);
  }

  @Delete('companies/:id')
  @ApiOperation({ summary: 'Dar de baja una empresa anunciante' })
  @ApiEnvelope(
    {
      type: 'object',
      properties: { success: { type: 'boolean', example: true } },
      required: ['success'],
    },
    { description: 'Empresa dada de baja.' },
  )
  removeCompany(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.companies.remove(user.sub, id);
  }

  @Get('placements')
  @ApiOperation({ summary: 'Listar emplazamientos publicitarios disponibles' })
  @ApiEnvelope(AdsPlacementDto, {
    paginated: true,
    description: 'Emplazamientos publicitarios disponibles.',
  })
  listPlacements() {
    return this.placements.list();
  }

  @Post('placements')
  @ApiOperation({ summary: 'Crear un emplazamiento publicitario' })
  @ApiEnvelope(AdsPlacementDto, { status: 201, description: 'Emplazamiento creado.' })
  createPlacement(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAdsPlacementDto) {
    return this.placements.create(user.sub, dto);
  }

  @Patch('placements/:id')
  @ApiOperation({ summary: 'Actualizar un emplazamiento publicitario' })
  @ApiEnvelope(AdsPlacementDto, { description: 'Emplazamiento actualizado.' })
  updatePlacement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAdsPlacementDto,
  ) {
    return this.placements.update(user.sub, id, dto);
  }

  @Get('ads')
  @ApiOperation({ summary: 'Listar creatividades del catálogo' })
  @ApiEnvelope(AdsCreativeDto, { paginated: true, description: 'Creatividades del catalogo.' })
  listAds() {
    return this.creatives.listAll();
  }

  @Post('ads')
  @ApiOperation({ summary: 'Crear una creatividad' })
  @ApiEnvelope(AdsCreativeDto, { status: 201, description: 'Creatividad creada.' })
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
  @ApiOperation({ summary: 'Actualizar una creatividad' })
  @ApiEnvelope(AdsCreativeDto, { description: 'Creatividad actualizada.' })
  updateAd(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAdsCreativeDto,
  ) {
    return this.creatives.update(user.sub, id, dto);
  }

  @Delete('ads/:id')
  @ApiOperation({ summary: 'Eliminar una creatividad' })
  @ApiEnvelope(
    {
      type: 'object',
      properties: { success: { type: 'boolean', example: true } },
      required: ['success'],
    },
    { description: 'Creatividad eliminada.' },
  )
  removeAd(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.creatives.remove(user.sub, id);
  }

  @Get('campaigns')
  @ApiOperation({ summary: 'Listar campañas publicitarias' })
  @ApiEnvelope(AdsCampaignDto, { paginated: true, description: 'Campanas publicitarias.' })
  listCampaigns(@Query() query: AdvertisingQueryDto) {
    return this.campaigns.list(query);
  }

  @Post('campaigns')
  @ApiOperation({ summary: 'Crear una campaña publicitaria' })
  @ApiEnvelope(AdsCampaignDto, {
    status: 201,
    description: 'Campana creada. Las fechas se validan: no puede terminar antes de empezar.',
  })
  createCampaign(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAdsCampaignDto) {
    return this.campaigns.create(user.sub, dto);
  }

  @Get('campaigns/:id')
  @ApiOperation({ summary: 'Consultar el detalle de una campaña' })
  @ApiEnvelope(AdsCampaignDto, { description: 'Detalle de la campana.' })
  getCampaign(@Param('id') id: string) {
    return this.campaigns.get(id);
  }

  @Patch('campaigns/:id')
  @ApiOperation({ summary: 'Actualizar una campaña publicitaria' })
  @ApiEnvelope(AdsCampaignDto, { description: 'Campana actualizada.' })
  updateCampaign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAdsCampaignDto,
  ) {
    return this.campaigns.update(user.sub, id, dto);
  }

  @Delete('campaigns/:id')
  @ApiOperation({ summary: 'Eliminar una campaña publicitaria' })
  @ApiEnvelope(
    {
      type: 'object',
      properties: { success: { type: 'boolean', example: true } },
      required: ['success'],
    },
    { description: 'Campana eliminada.' },
  )
  removeCampaign(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.campaigns.remove(user.sub, id);
  }

  @Post('campaigns/:id/status')
  @ApiOperation({ summary: 'Cambiar el estado de una campaña' })
  @ApiEnvelope(AdsCampaignDto, { status: 201, description: 'Campana con el estado nuevo.' })
  setCampaignStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetAdsCampaignStatusDto,
  ) {
    return this.campaigns.setStatus(user.sub, id, dto);
  }

  @Get('campaigns/:campaignId/creatives')
  @ApiOperation({ summary: 'Listar las creatividades asociadas a una campaña' })
  @ApiEnvelope(AdsCreativeDto, {
    isArray: true,
    description: 'Creatividades asociadas a la campana.',
  })
  listCreatives(@Param('campaignId') campaignId: string) {
    return this.creatives.list(campaignId);
  }

  @Post('campaigns/:campaignId/creatives')
  @ApiOperation({ summary: 'Asociar una creatividad a una campaña' })
  @ApiEnvelope(AdsCreativeDto, { status: 201, description: 'Creatividad asociada a la campana.' })
  createCreative(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateAdsCreativeDto,
  ) {
    return this.creatives.create(user.sub, campaignId, dto);
  }

  @Patch('creatives/:id')
  @ApiOperation({ summary: 'Actualizar una creatividad de campaña' })
  @ApiEnvelope(AdsCreativeDto, { description: 'Creatividad de campana actualizada.' })
  updateCreative(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAdsCreativeDto,
  ) {
    return this.creatives.update(user.sub, id, dto);
  }
}
