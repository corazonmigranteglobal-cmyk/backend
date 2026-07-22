import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Includeable, Op } from 'sequelize';
import {
  AdsCampaign,
  AdsCampaignContentTarget,
  AdsCampaignCreative,
  AdsCampaignPlacement,
  AdsCompany,
  AdsPlacement,
  ContentCategory,
  ContentPublication,
  CmsPage,
} from '@/database/models';
import {
  buildPagination,
  buildSafeOrder,
  getEffectiveStatusFilter,
  toLimitOffset,
} from '@/common/pagination/pagination.dto';
import { AuditService } from '../audit/audit.service';
import { AdvertisingQueryDto } from './dto/advertising-query.dto';
import {
  CreateAdsCampaignDto,
  SetAdsCampaignStatusDto,
  UpdateAdsCampaignDto,
} from './dto/campaign.dto';
import { toAdsCampaignDto } from './mappers/advertising.mapper';
import { assertCampaignDates } from './policies/campaign-date.policy';

const CAMPAIGN_STATUS_ALIASES: Record<string, string> = {
  ACTIVE: 'ACTIVE',
  ACTIVO: 'ACTIVE',
  ACTIVA: 'ACTIVE',
  DRAFT: 'DRAFT',
  BORRADOR: 'DRAFT',
  PAUSED: 'PAUSED',
  PAUSADO: 'PAUSED',
  PAUSADA: 'PAUSED',
  ENDED: 'ENDED',
  FINALIZADO: 'ENDED',
  FINALIZADA: 'ENDED',
  CANCELLED: 'CANCELLED',
  CANCELADO: 'CANCELLED',
  CANCELADA: 'CANCELLED',
  REJECTED: 'REJECTED',
  RECHAZADO: 'REJECTED',
  RECHAZADA: 'REJECTED',
};

function normalizeCampaignStatusFilter(value?: string) {
  if (!value) return undefined;
  const token = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (!token || ['ALL', 'TODOS', 'TODAS', '*'].includes(token)) return undefined;
  return CAMPAIGN_STATUS_ALIASES[token] ?? token;
}

@Injectable()
export class AdvertisingCampaignsService {
  private readonly include: Includeable[] = [
    { model: AdsCompany },
    { model: AdsCampaignCreative },
    { model: AdsPlacement, through: { attributes: [] } },
    { model: AdsCampaignContentTarget },
  ];

  constructor(
    @InjectModel(AdsCampaign) private readonly campaignModel: typeof AdsCampaign,
    @InjectModel(AdsCampaignPlacement)
    private readonly campaignPlacementModel: typeof AdsCampaignPlacement,
    @InjectModel(AdsCampaignContentTarget)
    private readonly campaignTargetModel: typeof AdsCampaignContentTarget,
    @InjectModel(AdsCampaignCreative)
    private readonly creativeModel: typeof AdsCampaignCreative,
    @InjectModel(AdsCompany) private readonly companyModel: typeof AdsCompany,
    @InjectModel(AdsPlacement) private readonly placementModel: typeof AdsPlacement,
    @InjectModel(ContentPublication) private readonly publicationModel: typeof ContentPublication,
    @InjectModel(ContentCategory) private readonly categoryModel: typeof ContentCategory,
    @InjectModel(CmsPage) private readonly pageModel: typeof CmsPage,
    private readonly audit: AuditService,
  ) {}

  async list(query: AdvertisingQueryDto) {
    const status = normalizeCampaignStatusFilter(getEffectiveStatusFilter(query));
    const { rows, count } = await this.campaignModel.findAndCountAll({
      ...toLimitOffset(query),
      distinct: true,
      where: {
        ...(status ? { status } : {}),
        ...(query.companyId ? { companyId: query.companyId } : {}),
      },
      include: this.include,
      order: buildSafeOrder(
        query,
        {
          id: 'id',
          name: 'name',
          status: 'status',
          objective: 'objective',
          startsAt: 'startsAt',
          starts_at: 'startsAt',
          endsAt: 'endsAt',
          ends_at: 'endsAt',
          budgetAmount: 'budgetAmount',
          budget_amount: 'budgetAmount',
          priority: 'priority',
          createdAt: 'createdAt',
          created_at: 'createdAt',
          updatedAt: 'updatedAt',
          updated_at: 'updatedAt',
        },
        'createdAt',
      ),
    });
    return { items: rows.map(toAdsCampaignDto), pagination: buildPagination(query, count) };
  }

  async get(id: string) {
    return toAdsCampaignDto(await this.find(id));
  }

  async create(actorUserId: string, dto: CreateAdsCampaignDto) {
    const { placementIds, publicationIds, categoryIds, pageSlugs, ...campaignInput } = dto;
    assertCampaignDates(dto.startsAt, dto.endsAt);
    await this.assertCompany(dto.companyId);
    await this.assertPlacements(placementIds);
    await this.assertTargets(publicationIds, categoryIds, pageSlugs);
    return this.campaignModel.sequelize!.transaction(async (transaction) => {
      const campaign = await this.campaignModel.create(
        {
          ...campaignInput,
          startsAt: new Date(dto.startsAt),
          endsAt: new Date(dto.endsAt),
          status: 'DRAFT',
          objective: dto.objective ?? 'AWARENESS',
          budgetAmount: dto.budgetAmount ?? 0,
          currency: dto.currency ?? 'BOB',
          priority: dto.priority ?? 100,
          pacing: 'STANDARD',
          createdByUserId: actorUserId,
        } as any,
        { transaction },
      );
      await this.replacePlacements(campaign.id, placementIds ?? [], transaction);
      await this.replaceTargets(
        campaign.id,
        publicationIds ?? [],
        categoryIds ?? [],
        pageSlugs ?? [],
        transaction,
      );
      await this.auditCampaign(actorUserId, 'create', campaign, undefined, transaction);
      return this.get(campaign.id);
    });
  }

  async update(actorUserId: string, id: string, dto: UpdateAdsCampaignDto) {
    const { placementIds, publicationIds, categoryIds, pageSlugs, ...campaignInput } = dto;
    const campaign = await this.find(id);
    const startsAt = dto.startsAt ?? campaign.startsAt;
    const endsAt = dto.endsAt ?? campaign.endsAt;
    assertCampaignDates(startsAt, endsAt);
    if (dto.companyId) await this.assertCompany(dto.companyId);
    await this.assertPlacements(placementIds);
    await this.assertTargets(publicationIds, categoryIds, pageSlugs);
    const before = campaign.toJSON();
    return campaign.sequelize!.transaction(async (transaction) => {
      await campaign.update(
        {
          ...campaignInput,
          startsAt: dto.startsAt ? new Date(dto.startsAt) : campaign.startsAt,
          endsAt: dto.endsAt ? new Date(dto.endsAt) : campaign.endsAt,
        } as any,
        { transaction },
      );
      if (placementIds) await this.replacePlacements(campaign.id, placementIds, transaction);
      if (publicationIds || categoryIds || pageSlugs)
        await this.replaceTargets(
          campaign.id,
          publicationIds ?? [],
          categoryIds ?? [],
          pageSlugs ?? [],
          transaction,
        );
      await this.auditCampaign(actorUserId, 'update', campaign, before, transaction);
      return this.get(campaign.id);
    });
  }

  async addAssociations(
    actorUserId: string,
    id: string,
    associations: {
      placementIds?: string[];
      publicationIds?: string[];
      categoryIds?: string[];
      pageSlugs?: string[];
    },
  ) {
    const campaign = await this.find(id);
    const existingPlacementIds = (campaign.placements ?? [])
      .map((placement) => placement.id)
      .filter((value): value is string => Boolean(value));
    const existingPublicationIds = (campaign.contentTargets ?? [])
      .map((target) => target.publicationId)
      .filter((value): value is string => Boolean(value));
    const existingCategoryIds = (campaign.contentTargets ?? [])
      .map((target) => target.categoryId)
      .filter((value): value is string => Boolean(value));
    const existingPageSlugs = (campaign.contentTargets ?? [])
      .map((target) => target.pageSlug)
      .filter((value): value is string => Boolean(value));

    const placementIds = Array.from(
      new Set([...existingPlacementIds, ...(associations.placementIds ?? [])]),
    );
    const publicationIds = Array.from(
      new Set([...existingPublicationIds, ...(associations.publicationIds ?? [])]),
    );
    const categoryIds = Array.from(
      new Set([...existingCategoryIds, ...(associations.categoryIds ?? [])]),
    );
    const incomingPageSlugs = (associations.pageSlugs ?? [])
      .map((slug) => this.normalizePageSlug(slug))
      .filter((value): value is string => Boolean(value));
    const pageSlugs = Array.from(new Set([...existingPageSlugs, ...incomingPageSlugs]));

    await this.assertPlacements(placementIds);
    await this.assertTargets(publicationIds, categoryIds, pageSlugs);
    const before = campaign.toJSON();

    return campaign.sequelize!.transaction(async (transaction) => {
      await this.replacePlacements(campaign.id, placementIds, transaction);
      await this.replaceTargets(campaign.id, publicationIds, categoryIds, pageSlugs, transaction);
      await this.auditCampaign(actorUserId, 'associate_ad', campaign, before, transaction);
      return this.get(campaign.id);
    });
  }

  async setStatus(actorUserId: string, id: string, dto: SetAdsCampaignStatusDto) {
    const campaign = await this.find(id);
    const before = campaign.toJSON();
    return campaign.sequelize!.transaction(async (transaction) => {
      await campaign.update({ status: dto.status } as any, { transaction });
      await this.auditCampaign(actorUserId, 'status', campaign, before, transaction);
      return this.get(campaign.id);
    });
  }

  async remove(actorUserId: string, id: string) {
    const campaign = await this.find(id);
    const before = campaign.toJSON();
    return campaign.sequelize!.transaction(async (transaction) => {
      await this.campaignPlacementModel.destroy({ where: { campaignId: id }, transaction });
      await this.campaignTargetModel.destroy({ where: { campaignId: id }, transaction });
      await this.creativeModel.destroy({ where: { campaignId: id }, transaction });
      await campaign.destroy({ transaction });
      await this.auditCampaign(actorUserId, 'delete', campaign, before, transaction);
      return { id, deleted: true };
    });
  }

  async find(id: string) {
    const campaign = await this.campaignModel.findByPk(id, { include: this.include });
    if (!campaign) {
      throw new NotFoundException({
        code: 'ADS_CAMPAIGN_NOT_FOUND',
        message: 'Campaña no encontrada.',
      });
    }
    return campaign;
  }

  private async assertCompany(companyId: string) {
    if (!(await this.companyModel.findByPk(companyId))) {
      throw new NotFoundException({
        code: 'ADS_COMPANY_NOT_FOUND',
        message: 'Empresa anunciante no encontrada.',
      });
    }
  }

  private async assertPlacements(placementIds?: string[]) {
    if (!placementIds?.length) return;
    const count = await this.placementModel.count({ where: { id: placementIds } });
    if (count !== new Set(placementIds).size) {
      throw new NotFoundException({
        code: 'ADS_PLACEMENT_NOT_FOUND',
        message: 'Uno o más placements no existen.',
      });
    }
  }

  private async assertTargets(
    publicationIds?: string[],
    categoryIds?: string[],
    pageSlugs?: string[],
  ) {
    if (publicationIds?.length) {
      const unique = [...new Set(publicationIds)];
      const count = await this.publicationModel.count({ where: { id: { [Op.in]: unique } } });
      if (count !== unique.length) {
        throw new NotFoundException({
          code: 'CONTENT_PUBLICATION_NOT_FOUND',
          message: 'Una o más publicaciones asociadas no existen.',
        });
      }
    }

    if (categoryIds?.length) {
      const unique = [...new Set(categoryIds)];
      const count = await this.categoryModel.count({ where: { id: { [Op.in]: unique } } });
      if (count !== unique.length) {
        throw new NotFoundException({
          code: 'CONTENT_CATEGORY_NOT_FOUND',
          message: 'Una o más categorías asociadas no existen.',
        });
      }
    }

    if (pageSlugs?.length) {
      const unique = [
        ...new Set(
          pageSlugs
            .map((slug) => this.normalizePageSlug(slug))
            .filter((slug): slug is string => Boolean(slug)),
        ),
      ];
      const count = await this.pageModel.count({ where: { slug: { [Op.in]: unique } } });
      if (count !== unique.length) {
        throw new NotFoundException({
          code: 'PUBLIC_PAGE_NOT_FOUND',
          message: 'Una o más páginas públicas asociadas no existen.',
        });
      }
    }
  }

  private async replacePlacements(campaignId: string, placementIds: string[], transaction: any) {
    await this.campaignPlacementModel.destroy({ where: { campaignId }, transaction });
    if (!placementIds.length) return;
    const rows = [...new Set(placementIds)].map((placementId) => ({ campaignId, placementId }));
    await this.campaignPlacementModel.bulkCreate(rows as any[], { transaction });
  }

  private async replaceTargets(
    campaignId: string,
    publicationIds: string[],
    categoryIds: string[],
    pageSlugs: string[],
    transaction: any,
  ) {
    await this.campaignTargetModel.destroy({ where: { campaignId }, transaction });
    const rows = [
      ...[...new Set(publicationIds)].map((publicationId) => ({
        campaignId,
        publicationId,
        targetingMode: 'INCLUDE',
        reason: 'Asociada desde administración a una publicación específica.',
      })),
      ...[...new Set(categoryIds)].map((categoryId) => ({
        campaignId,
        categoryId,
        targetingMode: 'INCLUDE',
        reason: 'Asociada desde administración a una categoría editorial.',
      })),
      ...[...new Set(pageSlugs.map((slug) => this.normalizePageSlug(slug)).filter(Boolean))].map(
        (pageSlug) => ({
          campaignId,
          pageSlug,
          targetingMode: 'INCLUDE',
          reason: 'Asociada desde administración a una página pública.',
        }),
      ),
    ];
    if (rows.length) await this.campaignTargetModel.bulkCreate(rows as any[], { transaction });
  }

  private normalizePageSlug(value?: string) {
    const slug = String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/^\/+|\/+$/g, '');
    return slug || undefined;
  }

  private async auditCampaign(
    actorUserId: string,
    action: string,
    campaign: AdsCampaign,
    before?: unknown,
    transaction?: any,
  ) {
    await this.audit.log(
      {
        actorUserId,
        action: `advertising.campaign.${action}`,
        entityType: 'AdsCampaign',
        entityId: campaign.id,
        before,
        after: campaign.toJSON(),
      },
      { transaction },
    );
  }
}
