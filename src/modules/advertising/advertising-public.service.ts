import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import {
  AdsCampaign,
  AdsCampaignContentTarget,
  AdsCampaignCreative,
  AdsCompany,
  AdsPlacement,
  ContentPublication,
} from '@/database/models';
import { PublicAdSlotsQueryDto } from './dto/advertising-query.dto';

type PublicationContext = { publicationId?: string; categoryId?: string; pageSlug?: string };

@Injectable()
export class AdvertisingPublicService {
  constructor(
    @InjectModel(AdsCampaign) private readonly campaignModel: typeof AdsCampaign,
    @InjectModel(ContentPublication) private readonly publicationModel: typeof ContentPublication,
  ) {}

  async getSlots(query: PublicAdSlotsQueryDto) {
    const requestedPublicationId = query.publicationId ?? query.postId;
    const requestedPlacementCode = query.placementCode ?? query.placement;
    const requestedPageSlug = this.normalizePageSlug(query.pageSlug);
    const publication = requestedPublicationId
      ? await this.publicationModel.findByPk(requestedPublicationId, {
          attributes: ['id', 'categoryId'],
        })
      : null;
    const context: PublicationContext = publication
      ? {
          publicationId: publication.id,
          categoryId: publication.categoryId,
          pageSlug: requestedPageSlug,
        }
      : { pageSlug: requestedPageSlug };

    const campaigns = await this.campaignModel.findAll({
      where: {
        status: 'ACTIVE',
        startsAt: { [Op.lte]: new Date() } as any,
        endsAt: { [Op.gt]: new Date() } as any,
      },
      include: [
        { model: AdsCompany, where: { status: 'ACTIVE' }, required: true },
        { model: AdsCampaignCreative, where: { approvalStatus: 'APPROVED' }, required: true },
        { model: AdsCampaignContentTarget, required: false },
        {
          model: AdsPlacement,
          where: {
            isActive: true,
            ...(requestedPlacementCode ? { code: requestedPlacementCode } : {}),
          },
          required: true,
          through: { attributes: [] },
        },
      ],
      order: [
        ['priority', 'ASC'],
        ['createdAt', 'DESC'],
      ],
      limit: 50,
    });

    return campaigns
      .filter((campaign) => this.isEligibleForContext(campaign.contentTargets ?? [], context))
      .slice(0, 20)
      .flatMap((campaign) =>
        (campaign.creatives ?? []).map((creative) => ({
          campaignId: campaign.id,
          campaignName: campaign.name,
          company: campaign.company?.commercialName,
          creativeId: creative.id,
          title: creative.title,
          mediaType: creative.mediaType,
          assetUrl: creative.assetUrl,
          destinationUrl: creative.destinationUrl,
          altText: creative.altText,
          sponsorLabel: 'Contenido patrocinado',
          placements: campaign.placements?.map((placement) => placement.code) ?? [],
        })),
      );
  }

  private isEligibleForContext(targets: AdsCampaignContentTarget[], context: PublicationContext) {
    if (!targets.length) return true;
    const hasContext = Boolean(context.publicationId || context.categoryId || context.pageSlug);
    if (!hasContext) return true;

    const matches = (target: AdsCampaignContentTarget) =>
      Boolean(target.publicationId && target.publicationId === context.publicationId) ||
      Boolean(target.categoryId && target.categoryId === context.categoryId) ||
      Boolean(target.pageSlug && context.pageSlug && target.pageSlug === context.pageSlug);

    const excluded = targets.some(
      (target) => target.targetingMode === 'EXCLUDE' && matches(target),
    );
    if (excluded) return false;

    const includeTargets = targets.filter((target) => target.targetingMode !== 'EXCLUDE');
    if (!includeTargets.length) return true;
    return includeTargets.some(matches);
  }

  private normalizePageSlug(value?: string) {
    const slug = String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/^\/+|\/+$/g, '');
    return slug || undefined;
  }
}
