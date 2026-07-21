import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { createHash, randomUUID } from 'node:crypto';
import { ContentSubscriber } from '@/database/models/content-subscriber.model';
import {
  DownloadableResource,
  DownloadableVisibility,
} from '@/database/models/downloadable-resource.model';
import { DownloadableDownloadEvent } from '@/database/models/downloadable-download-event.model';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { CreateDownloadableDto, UpdateDownloadableDto, HotmartConfigDto } from './dto/downloadable.dto';
import { HotmartAdapter } from './hotmart.adapter';

/** Acción que el frontend puede renderizar (decidida por el backend). */
export type DownloadableAction =
  | 'DIRECT_DOWNLOAD'
  | 'PREMIUM_DOWNLOAD'
  | 'HOTMART_CHECKOUT'
  | 'HOTMART_PRODUCT_ACCESS'
  | 'EXTERNAL_RESOURCE'
  | 'LOGIN_REQUIRED'
  | 'UPGRADE_REQUIRED'
  | 'NOT_AVAILABLE';

export interface AccessDecision {
  allowed: boolean;
  action: DownloadableAction;
  reason?: string;
  /** URL de checkout comercial cuando aplica (no expone el archivo real). */
  checkoutUrl?: string;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 160);
}

@Injectable()
export class DownloadablesService {
  constructor(
    @InjectModel(DownloadableResource)
    private readonly resourceModel: typeof DownloadableResource,
    @InjectModel(DownloadableDownloadEvent)
    private readonly eventModel: typeof DownloadableDownloadEvent,
    @InjectModel(ContentSubscriber)
    private readonly subscriberModel: typeof ContentSubscriber,
    private readonly hotmart: HotmartAdapter,
  ) {}

  // ── Premium / entitlements ──────────────────────────────────────
  private async hasActivePremium(userId?: string): Promise<boolean> {
    if (!userId) return false;
    const sub = await this.subscriberModel.findOne({ where: { userId } });
    if (!sub) return false;
    if (sub.status !== 'ACTIVE' || sub.subscriptionTier !== 'PREMIUM') return false;
    if (sub.premiumUntil && new Date(sub.premiumUntil).getTime() < Date.now()) return false;
    return true;
  }

  /**
   * Evalúa el derecho efectivo de acceso a un recurso para un usuario.
   * El backend es la única fuente de verdad: el frontend solo renderiza
   * la `action` devuelta.
   */
  async evaluateAccess(
    resource: DownloadableResource,
    user?: AuthenticatedUser,
  ): Promise<AccessDecision> {
    const isAdmin = (user?.roles ?? []).some((r) => ['ADMIN', 'SUPER_ADMIN'].includes(r));

    if (resource.status !== 'PUBLISHED' && !isAdmin) {
      return { allowed: false, action: 'NOT_AVAILABLE', reason: 'Recurso no publicado' };
    }
    if (resource.expiresAt && new Date(resource.expiresAt).getTime() < Date.now() && !isAdmin) {
      return { allowed: false, action: 'NOT_AVAILABLE', reason: 'Recurso expirado' };
    }
    if (isAdmin) {
      return { allowed: true, action: 'DIRECT_DOWNLOAD' };
    }

    const visibility = resource.visibility as DownloadableVisibility;
    switch (visibility) {
      case 'PUBLIC':
      case 'UNLISTED':
        return { allowed: true, action: 'DIRECT_DOWNLOAD' };

      case 'PREMIUM': {
        if (!user) return { allowed: false, action: 'LOGIN_REQUIRED', reason: 'Requiere iniciar sesión' };
        const premium = await this.hasActivePremium(user.sub);
        return premium
          ? { allowed: true, action: 'PREMIUM_DOWNLOAD' }
          : { allowed: false, action: 'UPGRADE_REQUIRED', reason: 'Requiere membresía premium' };
      }

      case 'PRIVATE': {
        // Acceso privado: solo por asignación explícita (rol/equipo). Sin
        // asignación → denegado en backend (no solo oculto en frontend).
        return { allowed: false, action: 'NOT_AVAILABLE', reason: 'Recurso privado' };
      }

      case 'PURCHASE_REQUIRED': {
        // Sin registro de compra confirmada, se ofrece el checkout comercial.
        const checkoutUrl = resource.hotmartCheckoutUrl ?? undefined;
        if (resource.hotmartProductId && checkoutUrl) {
          return {
            allowed: false,
            action: 'HOTMART_CHECKOUT',
            reason: 'Requiere compra',
            checkoutUrl,
          };
        }
        return { allowed: false, action: 'NOT_AVAILABLE', reason: 'Requiere compra' };
      }

      default:
        return { allowed: false, action: 'NOT_AVAILABLE' };
    }
  }

  // ── Auditoría de descargas ──────────────────────────────────────
  async recordDownloadEvent(params: {
    resource: DownloadableResource;
    user?: AuthenticatedUser;
    result: 'REQUESTED' | 'AUTHORIZED' | 'DENIED' | 'COMPLETED' | 'FAILED';
    action: DownloadableAction;
    ip?: string;
    userAgent?: string;
    correlationId?: string;
  }): Promise<void> {
    const ipHash = params.ip
      ? createHash('sha256').update(params.ip).digest('hex')
      : null;
    await this.eventModel.create({
      resourceId: params.resource.id,
      resourceVersion: params.resource.version,
      userId: params.user?.sub ?? null,
      result: params.result,
      accessMethod: params.action,
      visibility: params.resource.visibility,
      correlationId: params.correlationId ?? randomUUID(),
      ipHash,
      userAgent: params.userAgent?.slice(0, 400) ?? null,
    } as DownloadableDownloadEvent['_creationAttributes']);
  }

  // ── Admin CRUD ──────────────────────────────────────────────────
  async create(dto: CreateDownloadableDto, actorId?: string): Promise<DownloadableResource> {
    const slug = dto.slug?.trim() || slugify(dto.title);
    const publicId = `dl_${randomUUID().slice(0, 12)}`;
    return this.resourceModel.create({
      publicId,
      slug,
      title: dto.title,
      shortDescription: dto.shortDescription ?? null,
      description: dto.description ?? null,
      category: dto.category ?? null,
      tags: dto.tags ?? [],
      coverUrl: dto.coverUrl ?? null,
      fileUrl: dto.fileUrl ?? null,
      originalName: dto.originalName ?? null,
      mimeType: dto.mimeType ?? null,
      visibility: (dto.visibility as DownloadableVisibility) ?? 'PUBLIC',
      requiresPremium: dto.requiresPremium ?? false,
      requiresPurchase: dto.requiresPurchase ?? false,
      status: 'DRAFT',
      version: 1,
      downloadCount: 0,
      createdBy: actorId ?? null,
    } as DownloadableResource['_creationAttributes']);
  }

  async adminList(page = 1, pageSize = 20, search?: string) {
    const where = search
      ? { title: { [Op.iLike]: `%${search}%` } }
      : undefined;
    const { rows, count } = await this.resourceModel.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return {
      items: rows,
      pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) || 1 },
    };
  }

  async getByIdOrFail(id: string): Promise<DownloadableResource> {
    const resource = await this.resourceModel.findByPk(id);
    if (!resource) throw new NotFoundException('Descargable no encontrado');
    return resource;
  }

  async update(id: string, dto: UpdateDownloadableDto, actorId?: string): Promise<DownloadableResource> {
    const resource = await this.getByIdOrFail(id);
    await resource.update({
      ...dto,
      visibility: (dto.visibility as DownloadableVisibility) ?? resource.visibility,
      updatedBy: actorId ?? resource.updatedBy,
    } as Partial<DownloadableResource>);
    return resource;
  }

  async setHotmart(id: string, dto: HotmartConfigDto): Promise<DownloadableResource> {
    const resource = await this.getByIdOrFail(id);
    await resource.update({
      commercialProvider: 'HOTMART',
      hotmartProductId: dto.hotmartProductId ?? null,
      hotmartOfferId: dto.hotmartOfferId ?? null,
      hotmartCheckoutUrl: dto.hotmartCheckoutUrl ?? null,
      externalReference: dto.externalReference ?? null,
      integrationStatus: this.hotmart.isConfigured() ? 'CONFIGURED' : 'PENDING_CREDENTIALS',
    } as Partial<DownloadableResource>);
    return resource;
  }

  /** Publica el recurso incrementando su versión (la publicada es inmutable). */
  async publish(id: string, actorId?: string): Promise<DownloadableResource> {
    const resource = await this.getByIdOrFail(id);
    await resource.update({
      status: 'PUBLISHED',
      publishedAt: new Date(),
      version: (resource.version ?? 1) + 1,
      approvedBy: actorId ?? resource.approvedBy,
      approvedAt: new Date(),
    } as Partial<DownloadableResource>);
    return resource;
  }

  async archive(id: string): Promise<DownloadableResource> {
    const resource = await this.getByIdOrFail(id);
    await resource.update({ status: 'ARCHIVED' } as Partial<DownloadableResource>);
    return resource;
  }

  async remove(id: string): Promise<void> {
    const resource = await this.getByIdOrFail(id);
    await resource.destroy(); // soft delete (paranoid)
  }

  // ── Usuario final ───────────────────────────────────────────────
  /** Listado público: solo PUBLISHED y visibilidades listables. */
  async publicList(page = 1, pageSize = 20) {
    const { rows, count } = await this.resourceModel.findAndCountAll({
      where: {
        status: 'PUBLISHED',
        visibility: { [Op.in]: ['PUBLIC', 'PREMIUM', 'PURCHASE_REQUIRED'] },
      },
      order: [['publishedAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return {
      items: rows.map((r) => this.toPublicCard(r)),
      pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) || 1 },
    };
  }

  async getBySlugOrFail(slug: string): Promise<DownloadableResource> {
    const resource = await this.resourceModel.findOne({ where: { slug } });
    if (!resource) throw new NotFoundException('Descargable no encontrado');
    return resource;
  }

  /** Proyección ligera para tarjetas (sin exponer la URL privada del archivo). */
  toPublicCard(r: DownloadableResource) {
    return {
      id: r.id,
      publicId: r.publicId,
      slug: r.slug,
      title: r.title,
      shortDescription: r.shortDescription,
      category: r.category,
      tags: r.tags,
      coverUrl: r.coverUrl,
      visibility: r.visibility,
      requiresPremium: r.requiresPremium,
      requiresPurchase: r.requiresPurchase,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      publishedAt: r.publishedAt,
    };
  }

  /**
   * Resuelve la descarga: verifica el derecho en backend y solo entonces
   * devuelve la URL. Para recursos no públicos, esta URL debería ser firmada
   * de corta duración (la infraestructura de storage lo provee).
   */
  async resolveDownload(
    resource: DownloadableResource,
    user: AuthenticatedUser | undefined,
    ctx: { ip?: string; userAgent?: string },
  ): Promise<{ url: string; action: DownloadableAction }> {
    await this.recordDownloadEvent({ resource, user, result: 'REQUESTED', action: 'DIRECT_DOWNLOAD', ...ctx });
    const decision = await this.evaluateAccess(resource, user);
    if (!decision.allowed) {
      await this.recordDownloadEvent({ resource, user, result: 'DENIED', action: decision.action, ...ctx });
      throw new ForbiddenException({ code: 'DOWNLOAD_NOT_AUTHORIZED', action: decision.action, checkoutUrl: decision.checkoutUrl });
    }
    if (!resource.fileUrl) {
      await this.recordDownloadEvent({ resource, user, result: 'FAILED', action: decision.action, ...ctx });
      throw new NotFoundException('El recurso no tiene archivo asociado');
    }
    await this.resourceModel.increment('downloadCount', { where: { id: resource.id } });
    await this.recordDownloadEvent({ resource, user, result: 'AUTHORIZED', action: decision.action, ...ctx });
    return { url: resource.fileUrl, action: decision.action };
  }

  async downloadHistory(userId: string, page = 1, pageSize = 20) {
    const { rows, count } = await this.eventModel.findAndCountAll({
      where: { userId, result: { [Op.in]: ['AUTHORIZED', 'COMPLETED'] } },
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return {
      items: rows,
      pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) || 1 },
    };
  }

  async metrics() {
    const [total, published, premium, hotmart] = await Promise.all([
      this.resourceModel.count(),
      this.resourceModel.count({ where: { status: 'PUBLISHED' } }),
      this.resourceModel.count({ where: { visibility: 'PREMIUM' } }),
      this.resourceModel.count({ where: { commercialProvider: 'HOTMART' } }),
    ]);
    const downloads = await this.eventModel.count({ where: { result: { [Op.in]: ['AUTHORIZED', 'COMPLETED'] } } });
    const denied = await this.eventModel.count({ where: { result: 'DENIED' } });
    return { total, published, premium, hotmart, downloads, denied };
  }
}
