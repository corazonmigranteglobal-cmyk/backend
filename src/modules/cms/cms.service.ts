import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CmsElement, CmsPage, ContentPublication } from '@/database/models';
import { AuditService } from '../audit/audit.service';
import { CreateElementDto, CreatePageDto, UpdatePageDto } from './dto/cms.dto';

@Injectable()
export class CmsService {
  constructor(
    @InjectModel(CmsPage) private readonly pageModel: typeof CmsPage,
    @InjectModel(CmsElement) private readonly elementModel: typeof CmsElement,
    @InjectModel(ContentPublication) private readonly publicationModel: typeof ContentPublication,
    private readonly audit: AuditService,
  ) {}

  /**
   * Endpoint publico: GET /public/pages/:slug
   *
   * Nota importante:
   * No usamos `include + order` aqui porque en sequelize-typescript puede romperse
   * si el alias generado para la relacion HasMany no coincide con el alias usado
   * al ordenar. Eso fue lo que generaba 500 en /public/pages/inicio.
   *
   * Se hace en dos consultas simples y estables:
   * 1. buscar pagina publicada
   * 2. buscar elementos activos de esa pagina ordenados por sortOrder
   */
  async getPublicPage(slug: string) {
    const page = await this.pageModel.findOne({
      where: { slug, status: 'PUBLISHED' },
    });

    if (!page) {
      throw new NotFoundException({ code: 'CMS_PAGE_NOT_FOUND', message: 'Página no encontrada.' });
    }

    const elements = await this.elementModel.findAll({
      where: { pageId: page.id, status: 'ACTIVE' },
      order: [
        ['sortOrder', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    });

    return {
      ...page.toJSON(),
      elements: elements.map((element) => element.toJSON()),
    };
  }

  async listPages(status?: string) {
    const normalizedStatus = String(status ?? '').trim().toUpperCase();
    const where = normalizedStatus ? { status: normalizedStatus } : undefined;
    const pages = await this.pageModel.findAll({
      where,
      order: [
        ['updatedAt', 'DESC'],
        ['createdAt', 'DESC'],
      ],
    });

    return {
      items: pages.map((page) => page.toJSON()),
      total: pages.length,
    };
  }


  async getAdminPage(id: string) {
    const page = await this.pageModel.findByPk(id);
    if (!page) {
      throw new NotFoundException({ code: 'CMS_PAGE_NOT_FOUND', message: 'Página no encontrada.' });
    }

    const elements = await this.elementModel.findAll({
      where: { pageId: page.id },
      order: [
        ['sortOrder', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    });

    return {
      ...page.toJSON(),
      elements: elements.map((element) => element.toJSON()),
    };
  }

  async updatePage(actorUserId: string, id: string, dto: UpdatePageDto) {
    const page = await this.pageModel.findByPk(id);
    if (!page) {
      throw new NotFoundException({ code: 'CMS_PAGE_NOT_FOUND', message: 'Página no encontrada.' });
    }

    const before = page.toJSON();
    return page.sequelize!.transaction(async (transaction) => {
      await page.update(
        {
          ...dto,
          publishedAt: dto.status === 'PUBLISHED' && !page.publishedAt ? new Date() : page.publishedAt,
        } as any,
        { transaction },
      );
      await this.audit.log(
        {
          actorUserId,
          action: 'cms.update_page',
          entityType: 'CmsPage',
          entityId: page.id,
          before,
          after: page.toJSON(),
        },
        { transaction },
      );
      const elements = await this.elementModel.findAll({
        where: { pageId: page.id },
        order: [
          ['sortOrder', 'ASC'],
          ['createdAt', 'ASC'],
        ],
        transaction,
      });
      return {
        ...page.toJSON(),
        elements: elements.map((element) => element.toJSON()),
      };
    });
  }

  async deletePage(actorUserId: string, id: string) {
    const page = await this.pageModel.findByPk(id);
    if (!page) {
      throw new NotFoundException({ code: 'CMS_PAGE_NOT_FOUND', message: 'Página no encontrada.' });
    }

    const before = page.toJSON();
    return page.sequelize!.transaction(async (transaction) => {
      await page.destroy({ transaction });
      await this.audit.log(
        {
          actorUserId,
          action: 'cms.delete_page',
          entityType: 'CmsPage',
          entityId: page.id,
          before,
          after: { deleted: true },
        },
        { transaction },
      );
      return { id: page.id, deleted: true };
    });
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

  async attachPublication(actorUserId: string, pageId: string, publicationId: string) {
    const page = await this.pageModel.findByPk(pageId);
    if (!page) {
      throw new NotFoundException({ code: 'CMS_PAGE_NOT_FOUND', message: 'Página no encontrada.' });
    }
    const publication = await this.publicationModel.findByPk(publicationId);
    if (!publication) {
      throw new NotFoundException({ code: 'CONTENT_PUBLICATION_NOT_FOUND', message: 'Publicación no encontrada.' });
    }

    const before = publication.toJSON();
    const metadata = { ...(publication.seoMetadata ?? {}) } as Record<string, any>;
    const currentSlugs = Array.isArray(metadata.embedPageSlugs) ? metadata.embedPageSlugs.map((slug: unknown) => String(slug).trim()).filter(Boolean) : [];
    const currentPages = Array.isArray(metadata.embedPages) ? metadata.embedPages.filter((item: unknown) => item && typeof item === 'object') : [];
    metadata.embedPageSlugs = Array.from(new Set([...currentSlugs, page.slug]));
    metadata.embedPages = [
      ...currentPages.filter((item: any) => String(item.slug ?? '') !== page.slug),
      { id: page.id, slug: page.slug, title: page.title },
    ];

    return publication.sequelize!.transaction(async (transaction) => {
      await publication.update({ seoMetadata: metadata } as any, { transaction });
      await this.audit.log(
        {
          actorUserId,
          action: 'public_pages.attach_publication',
          entityType: 'ContentPublication',
          entityId: publication.id,
          before,
          after: publication.toJSON(),
        },
        { transaction },
      );
      return { pageId: page.id, pageSlug: page.slug, publicationId: publication.id, attached: true };
    });
  }

  async detachPublication(actorUserId: string, pageId: string, publicationId: string) {
    const page = await this.pageModel.findByPk(pageId);
    if (!page) {
      throw new NotFoundException({ code: 'CMS_PAGE_NOT_FOUND', message: 'Página no encontrada.' });
    }
    const publication = await this.publicationModel.findByPk(publicationId);
    if (!publication) {
      throw new NotFoundException({ code: 'CONTENT_PUBLICATION_NOT_FOUND', message: 'Publicación no encontrada.' });
    }

    const before = publication.toJSON();
    const metadata = { ...(publication.seoMetadata ?? {}) } as Record<string, any>;
    metadata.embedPageSlugs = Array.isArray(metadata.embedPageSlugs)
      ? metadata.embedPageSlugs.map((slug: unknown) => String(slug).trim()).filter((slug: string) => slug && slug !== page.slug)
      : [];
    metadata.embedPages = Array.isArray(metadata.embedPages)
      ? metadata.embedPages.filter((item: any) => String(item?.slug ?? '') !== page.slug && String(item?.id ?? '') !== page.id)
      : [];

    return publication.sequelize!.transaction(async (transaction) => {
      await publication.update({ seoMetadata: metadata } as any, { transaction });
      await this.audit.log(
        {
          actorUserId,
          action: 'public_pages.detach_publication',
          entityType: 'ContentPublication',
          entityId: publication.id,
          before,
          after: publication.toJSON(),
        },
        { transaction },
      );
      return { pageId: page.id, pageSlug: page.slug, publicationId: publication.id, attached: false };
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
}
