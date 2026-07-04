import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CmsElement, CmsPage } from '@/database/models';
import { AuditService } from '../audit/audit.service';
import { CreateElementDto, CreatePageDto } from './dto/cms.dto';

const LEGACY_PUBLIC_VIEW_SLUG_BY_ID: Record<string, string> = {
  '1': 'inicio',
};

@Injectable()
export class CmsService {
  constructor(
    @InjectModel(CmsPage) private readonly pageModel: typeof CmsPage,
    @InjectModel(CmsElement) private readonly elementModel: typeof CmsElement,
    private readonly audit: AuditService,
  ) {}

  async getPublicPage(slug: string) {
    const page = await this.findPublishedPage({ slug });
    const elements = await this.findActiveElements(page.id);
    return this.serializePage(page, elements);
  }

  async getPublicPageById(idOrSlug: string) {
    const page = await this.findPublishedPage(this.resolvePublicPageLookup(idOrSlug));
    const elements = await this.findActiveElements(page.id);
    return this.serializePage(page, elements);
  }

  async getPublicElementByCode(slug: string, code: string) {
    const page = await this.findPublishedPage({ slug });
    const element = await this.findActiveElement({ pageId: page.id, code });
    return element.toJSON();
  }

  async getPublicElementByPageIdAndCode(idOrSlug: string, code: string) {
    const page = await this.findPublishedPage(this.resolvePublicPageLookup(idOrSlug));
    const element = await this.findActiveElement({ pageId: page.id, code });
    return element.toJSON();
  }

  async getPublicElementById(id: string) {
    if (!this.isUuid(id)) {
      throw new NotFoundException({
        code: 'CMS_ELEMENT_NOT_FOUND',
        message: 'Elemento público no encontrado.',
      });
    }

    const element = await this.findActiveElement({ id });
    await this.findPublishedPage({ id: element.pageId });
    return element.toJSON();
  }

  async createPage(actorUserId: string, dto: CreatePageDto) {
    return this.pageModel.sequelize!.transaction(async (transaction) => {
      const page = await this.pageModel.create(
        {
          ...dto,
          status: dto.status ?? 'DRAFT',
          publishedAt: dto.status === 'PUBLISHED' ? new Date() : undefined,
          seoMetadata: dto.seoMetadata ?? {},
        } as any,
        { transaction },
      );
      await this.audit.log(
        {
          actorUserId,
          action: 'cms.create_page',
          entityType: 'CmsPage',
          entityId: page.id,
          after: page.toJSON(),
        },
        { transaction },
      );
      return page;
    });
  }

  async addElement(actorUserId: string, pageId: string, dto: CreateElementDto) {
    const page = await this.pageModel.findByPk(pageId);
    if (!page) {
      throw new NotFoundException({ code: 'CMS_PAGE_NOT_FOUND', message: 'Página no encontrada.' });
    }
    return this.elementModel.sequelize!.transaction(async (transaction) => {
      const element = await this.elementModel.create(
        {
          pageId,
          ...dto,
          sortOrder: dto.sortOrder ?? 0,
          status: 'ACTIVE',
        } as any,
        { transaction },
      );
      await this.audit.log(
        {
          actorUserId,
          action: 'cms.add_element',
          entityType: 'CmsElement',
          entityId: element.id,
          after: element.toJSON(),
        },
        { transaction },
      );
      return element;
    });
  }

  private resolvePublicPageLookup(value: string): { id?: string; slug?: string } {
    const normalized = String(value ?? '').trim();

    if (!normalized) {
      throw new NotFoundException({ code: 'CMS_PAGE_NOT_FOUND', message: 'Página no encontrada.' });
    }

    if (this.isUuid(normalized)) {
      return { id: normalized };
    }

    const legacySlug = LEGACY_PUBLIC_VIEW_SLUG_BY_ID[normalized];
    if (legacySlug) {
      return { slug: legacySlug };
    }

    if (/^\d+$/.test(normalized)) {
      throw new NotFoundException({ code: 'CMS_PAGE_NOT_FOUND', message: 'Página no encontrada.' });
    }

    return { slug: normalized };
  }

  private async findPublishedPage(where: { id?: string; slug?: string }) {
    const page = await this.pageModel.findOne({
      where: { ...where, status: 'PUBLISHED' },
    });

    if (!page) {
      throw new NotFoundException({ code: 'CMS_PAGE_NOT_FOUND', message: 'Página no encontrada.' });
    }

    return page;
  }

  private findActiveElements(pageId: string) {
    return this.elementModel.findAll({
      where: { pageId, status: 'ACTIVE' },
      order: [
        ['sortOrder', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    });
  }

  private async findActiveElement(where: { id?: string; pageId?: string; code?: string }) {
    const element = await this.elementModel.findOne({
      where: { ...where, status: 'ACTIVE' },
    });

    if (!element) {
      throw new NotFoundException({
        code: 'CMS_ELEMENT_NOT_FOUND',
        message: 'Elemento público no encontrado.',
      });
    }

    return element;
  }

  private serializePage(page: CmsPage, elements: CmsElement[]) {
    return {
      ...page.toJSON(),
      elements: elements.map((element) => element.toJSON()),
    };
  }

  private isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }
}
