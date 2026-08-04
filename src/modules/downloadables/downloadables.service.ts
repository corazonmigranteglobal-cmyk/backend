import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
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
import { DownloadableResourceVersion } from '@/database/models/downloadable-resource-version.model';
import { DownloadableEntitlement } from '@/database/models/downloadable-entitlement.model';
import { DownloadablePublicationLink } from '@/database/models/downloadable-publication-link.model';
import { DownloadableExternalEvent } from '@/database/models/downloadable-external-event.model';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { APP_ATTR } from '@/observability/telemetry.constants';
import { TracingService } from '@/observability/tracing.service';
import {
  CreateDownloadableDto,
  UpdateDownloadableDto,
  HotmartConfigDto,
} from './dto/downloadable.dto';
import { HotmartAdapter, HotmartPurchaseNotification } from './hotmart.adapter';

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
  checkoutUrl?: string;
}

/**
 * Estado del usuario precalculado para evaluar un lote de recursos sin repetir
 * consultas por cada uno.
 */
interface AccessContext {
  hasActivePremium: boolean;
  entitledResourceIds: Set<string>;
}

const REVIEW_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['IN_REVIEW'],
  IN_REVIEW: ['APPROVED', 'REJECTED', 'CHANGES_REQUESTED'],
  CHANGES_REQUESTED: ['IN_REVIEW'],
  APPROVED: ['PUBLISHED'],
  PUBLISHED: ['ARCHIVED'],
  REJECTED: ['IN_REVIEW'],
  ARCHIVED: [],
};

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
  private readonly logger = new Logger(DownloadablesService.name);

  constructor(
    @InjectModel(DownloadableResource)
    private readonly resourceModel: typeof DownloadableResource,
    @InjectModel(DownloadableDownloadEvent)
    private readonly eventModel: typeof DownloadableDownloadEvent,
    @InjectModel(DownloadableResourceVersion)
    private readonly versionModel: typeof DownloadableResourceVersion,
    @InjectModel(DownloadableEntitlement)
    private readonly entitlementModel: typeof DownloadableEntitlement,
    @InjectModel(DownloadablePublicationLink)
    private readonly linkModel: typeof DownloadablePublicationLink,
    @InjectModel(DownloadableExternalEvent)
    private readonly externalEventModel: typeof DownloadableExternalEvent,
    @InjectModel(ContentSubscriber)
    private readonly subscriberModel: typeof ContentSubscriber,
    private readonly hotmart: HotmartAdapter,
    private readonly notifications: NotificationsService,
    private readonly tracing: TracingService,
  ) {}

  /**
   * Emisión best-effort: el evento nunca debe tumbar la operación de negocio.
   * Sin el `catch` el rechazo queda sin manejar y Node aborta el proceso.
   */
  private emit(
    type: string,
    resource: { id: string },
    payload: Record<string, unknown> = {},
  ): void {
    void this.notifications
      .emit({
        type,
        entityType: 'DownloadableResource',
        entityId: resource.id,
        payload,
      })
      .catch((error: unknown) => {
        this.logger.error(
          `No se pudo emitir el evento ${type}: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
  }

  private async hasActivePremium(userId?: string): Promise<boolean> {
    if (!userId) return false;
    const sub = await this.subscriberModel.findOne({ where: { userId } });
    if (!sub) return false;
    if (sub.status !== 'ACTIVE' || sub.subscriptionTier !== 'PREMIUM') return false;
    if (sub.premiumUntil && new Date(sub.premiumUntil).getTime() < Date.now()) return false;
    return true;
  }

  private async hasActiveEntitlement(resourceId: string, userId?: string): Promise<boolean> {
    if (!userId) return false;
    const now = new Date();
    const ent = await this.entitlementModel.findOne({
      where: {
        resourceId,
        userId,
        status: 'ACTIVE',
        [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: now } }],
      },
    });
    return Boolean(ent);
  }

  /**
   * Precalcula, con dos consultas, todo lo que hace falta para decidir el
   * acceso de un usuario a un conjunto de recursos. Sin esto cada recurso de un
   * listado disparaba sus propias consultas de premium y de entitlement.
   */
  private async buildAccessContext(
    resourceIds: string[],
    user?: AuthenticatedUser,
  ): Promise<AccessContext> {
    if (!user?.sub || !resourceIds.length) {
      return { hasActivePremium: false, entitledResourceIds: new Set() };
    }

    const now = new Date();
    const [hasActivePremium, entitlements] = await Promise.all([
      this.hasActivePremium(user.sub),
      this.entitlementModel.findAll({
        where: {
          resourceId: { [Op.in]: [...new Set(resourceIds)] },
          userId: user.sub,
          status: 'ACTIVE',
          [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: now } }],
        },
        attributes: ['resourceId'],
      }),
    ]);

    return {
      hasActivePremium,
      entitledResourceIds: new Set(entitlements.map((entitlement) => entitlement.resourceId)),
    };
  }

  /**
   * `downloadable.evaluate-access` explica por qué un usuario obtuvo o no un
   * recurso: la decisión combina visibilidad, entitlements, premium y Hotmart, y
   * es la fuente habitual de incidencias de soporte.
   */
  async evaluateAccess(
    resource: DownloadableResource,
    user?: AuthenticatedUser,
    context?: AccessContext,
  ): Promise<AccessDecision> {
    return this.tracing.runInSpan(
      'downloadable.evaluate-access',
      {
        [APP_ATTR.module]: 'downloadables',
        [APP_ATTR.operation]: 'evaluate-access',
        [APP_ATTR.entityType]: 'downloadable-resource',
        [APP_ATTR.entityId]: resource.id,
        'app.downloadable.visibility': resource.visibility,
      },
      async (span) => {
        const decision = await this.decideAccess(resource, user, context);
        span.setAttributes({
          [APP_ATTR.result]: decision.allowed ? 'granted' : 'denied',
          'app.downloadable.action': decision.action,
        });
        return decision;
      },
    );
  }

  private async decideAccess(
    resource: DownloadableResource,
    user?: AuthenticatedUser,
    context?: AccessContext,
  ): Promise<AccessDecision> {
    const isAdmin = (user?.roles ?? []).some((r) => ['ADMIN', 'SUPER_ADMIN'].includes(r));
    const isEntitled = context
      ? async () => context.entitledResourceIds.has(resource.id)
      : () => this.hasActiveEntitlement(resource.id, user?.sub);
    const isPremium = context
      ? async () => context.hasActivePremium
      : () => this.hasActivePremium(user?.sub);

    if (resource.status !== 'PUBLISHED' && !isAdmin) {
      return { allowed: false, action: 'NOT_AVAILABLE', reason: 'Recurso no publicado' };
    }
    if (resource.expiresAt && new Date(resource.expiresAt).getTime() < Date.now() && !isAdmin) {
      return { allowed: false, action: 'NOT_AVAILABLE', reason: 'Recurso expirado' };
    }
    if (isAdmin) return { allowed: true, action: 'DIRECT_DOWNLOAD' };

    const visibility = resource.visibility as DownloadableVisibility;
    switch (visibility) {
      case 'PUBLIC':
      case 'UNLISTED':
        return { allowed: true, action: 'DIRECT_DOWNLOAD' };

      case 'PREMIUM': {
        if (!user)
          return { allowed: false, action: 'LOGIN_REQUIRED', reason: 'Requiere iniciar sesion' };
        if (await isEntitled()) {
          return { allowed: true, action: 'PREMIUM_DOWNLOAD' };
        }
        return (await isPremium())
          ? { allowed: true, action: 'PREMIUM_DOWNLOAD' }
          : { allowed: false, action: 'UPGRADE_REQUIRED', reason: 'Requiere membresia premium' };
      }

      case 'PRIVATE': {
        if (!user)
          return { allowed: false, action: 'LOGIN_REQUIRED', reason: 'Requiere iniciar sesion' };
        return (await isEntitled())
          ? { allowed: true, action: 'DIRECT_DOWNLOAD' }
          : { allowed: false, action: 'NOT_AVAILABLE', reason: 'Recurso privado' };
      }

      case 'PURCHASE_REQUIRED': {
        if (user && (await isEntitled())) {
          return { allowed: true, action: 'HOTMART_PRODUCT_ACCESS' };
        }
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

  async recordDownloadEvent(params: {
    resource: DownloadableResource;
    user?: AuthenticatedUser;
    result: 'REQUESTED' | 'AUTHORIZED' | 'DENIED' | 'COMPLETED' | 'FAILED';
    action: DownloadableAction;
    ip?: string;
    userAgent?: string;
    correlationId?: string;
  }): Promise<void> {
    const ipHash = params.ip ? createHash('sha256').update(params.ip).digest('hex') : null;
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

  async create(dto: CreateDownloadableDto, actorId?: string): Promise<DownloadableResource> {
    const slug = dto.slug?.trim() || slugify(dto.title);
    const publicId = `dl_${randomUUID().slice(0, 12)}`;
    const resource = await this.resourceModel.create({
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

    await this.versionModel.create({
      resourceId: resource.id,
      versionNumber: 1,
      status: 'DRAFT',
      title: resource.title,
      fileUrl: resource.fileUrl,
      authorId: actorId ?? null,
      changeReason: 'Version inicial',
    } as unknown as DownloadableResourceVersion['_creationAttributes']);

    this.emit('DownloadableCreated', resource, { title: resource.title });
    return resource;
  }

  async adminList(page = 1, pageSize = 20, search?: string) {
    const where = search ? { title: { [Op.iLike]: `%${search}%` } } : undefined;
    const { rows, count } = await this.resourceModel.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return { items: rows, pagination: this.paginate(page, pageSize, count) };
  }

  async getByIdOrFail(id: string): Promise<DownloadableResource> {
    const resource = await this.resourceModel.findByPk(id);
    if (!resource) throw new NotFoundException('Descargable no encontrado');
    return resource;
  }

  async update(
    id: string,
    dto: UpdateDownloadableDto,
    actorId?: string,
  ): Promise<DownloadableResource> {
    const resource = await this.getByIdOrFail(id);
    if (resource.status === 'PUBLISHED') {
      throw new BadRequestException(
        'La version publicada es inmutable. Crea una nueva version para editar.',
      );
    }
    await resource.update({
      ...dto,
      visibility: (dto.visibility as DownloadableVisibility) ?? resource.visibility,
      updatedBy: actorId ?? resource.updatedBy,
    } as Partial<DownloadableResource>);
    this.emit('DownloadableUpdated', resource, {});
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
    this.emit('HotmartProductLinked', resource, { productId: dto.hotmartProductId });
    return resource;
  }

  async archive(id: string): Promise<DownloadableResource> {
    const resource = await this.getByIdOrFail(id);
    await resource.update({ status: 'ARCHIVED' } as Partial<DownloadableResource>);
    this.emit('DownloadableArchived', resource, {});
    return resource;
  }

  async remove(id: string): Promise<void> {
    const resource = await this.getByIdOrFail(id);
    await resource.destroy();
  }

  async listVersions(resourceId: string) {
    await this.getByIdOrFail(resourceId);
    return this.versionModel.findAll({ where: { resourceId }, order: [['versionNumber', 'DESC']] });
  }

  async getVersionOrFail(resourceId: string, versionId: string) {
    const version = await this.versionModel.findOne({ where: { id: versionId, resourceId } });
    if (!version) throw new NotFoundException('Version no encontrada');
    return version;
  }

  async createVersion(resourceId: string, changeReason: string | undefined, actorId?: string) {
    const resource = await this.getByIdOrFail(resourceId);
    const last = await this.versionModel.findOne({
      where: { resourceId },
      order: [['versionNumber', 'DESC']],
    });
    const nextNumber = (last?.versionNumber ?? 0) + 1;
    const version = await this.versionModel.create({
      resourceId,
      versionNumber: nextNumber,
      status: 'DRAFT',
      title: resource.title,
      fileUrl: resource.fileUrl,
      metadata: { visibility: resource.visibility },
      changeReason: changeReason ?? null,
      authorId: actorId ?? null,
    } as unknown as DownloadableResourceVersion['_creationAttributes']);
    await resource.update({ status: 'DRAFT' } as Partial<DownloadableResource>);
    this.emit('DownloadableVersionCreated', resource, { versionNumber: nextNumber });
    return version;
  }

  private async transitionVersion(
    resourceId: string,
    versionId: string,
    to: string,
    opts: { comment?: string; actorId?: string } = {},
  ) {
    const version = await this.getVersionOrFail(resourceId, versionId);
    const allowed = REVIEW_TRANSITIONS[version.status] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(`Transicion no permitida: ${version.status} -> ${to}`);
    }
    await version.update({
      status: to,
      reviewComment: opts.comment ?? version.reviewComment,
      reviewedBy: opts.actorId ?? version.reviewedBy,
      reviewedAt: new Date(),
    } as Partial<DownloadableResourceVersion>);
    const resource = await this.getByIdOrFail(resourceId);
    await resource.update({ status: to } as Partial<DownloadableResource>);
    return version;
  }

  // El evento se emite DESPUÉS de que la transición se valide y persista: si la
  // transición es inválida no debe quedar rastro de una revisión que no ocurrió.
  async submitReview(resourceId: string, versionId: string, actorId?: string) {
    const version = await this.transitionVersion(resourceId, versionId, 'IN_REVIEW', { actorId });
    this.emit('DownloadableSubmittedForReview', { id: resourceId }, {});
    return version;
  }
  async approveVersion(resourceId: string, versionId: string, actorId?: string) {
    const version = await this.transitionVersion(resourceId, versionId, 'APPROVED', { actorId });
    this.emit('DownloadableApproved', { id: resourceId }, {});
    return version;
  }
  async rejectVersion(resourceId: string, versionId: string, comment?: string, actorId?: string) {
    const version = await this.transitionVersion(resourceId, versionId, 'REJECTED', {
      comment,
      actorId,
    });
    this.emit('DownloadableRejected', { id: resourceId }, {});
    return version;
  }
  requestChanges(resourceId: string, versionId: string, comment?: string, actorId?: string) {
    return this.transitionVersion(resourceId, versionId, 'CHANGES_REQUESTED', { comment, actorId });
  }

  async publishVersion(resourceId: string, versionId: string, actorId?: string) {
    const version = await this.getVersionOrFail(resourceId, versionId);
    if (version.status !== 'APPROVED') {
      throw new BadRequestException('Solo se puede publicar una version aprobada');
    }
    await version.update({
      status: 'PUBLISHED',
      isPublished: true,
    } as Partial<DownloadableResourceVersion>);
    const resource = await this.getByIdOrFail(resourceId);
    await resource.update({
      status: 'PUBLISHED',
      publishedAt: new Date(),
      version: version.versionNumber,
      fileUrl: version.fileUrl ?? resource.fileUrl,
      approvedBy: actorId ?? resource.approvedBy,
      approvedAt: new Date(),
    } as Partial<DownloadableResource>);
    this.emit('DownloadablePublished', resource, { versionNumber: version.versionNumber });
    return resource;
  }

  async restoreVersion(resourceId: string, versionId: string, actorId?: string) {
    const base = await this.getVersionOrFail(resourceId, versionId);
    const last = await this.versionModel.findOne({
      where: { resourceId },
      order: [['versionNumber', 'DESC']],
    });
    const created = await this.versionModel.create({
      resourceId,
      versionNumber: (last?.versionNumber ?? 0) + 1,
      status: 'DRAFT',
      title: base.title,
      fileUrl: base.fileUrl,
      metadata: { ...base.metadata, restoredFrom: base.versionNumber },
      changeReason: `Restaurado desde v${base.versionNumber}`,
      authorId: actorId ?? null,
    } as unknown as DownloadableResourceVersion['_creationAttributes']);
    return created;
  }

  async grantEntitlement(params: {
    resourceId: string;
    userId?: string;
    subjectEmail?: string;
    source?: DownloadableEntitlement['source'];
    externalReference?: string;
    externalTransaction?: string;
    grantedBy?: string;
    expiresAt?: Date;
  }): Promise<DownloadableEntitlement> {
    await this.getByIdOrFail(params.resourceId);
    return this.upsertEntitlement(params);
  }

  /**
   * Alta/reactivación del permiso. Se separa de `grantEntitlement` porque los
   * flujos que ya tienen el recurso cargado (webhook de Hotmart) no deben
   * volver a leerlo de la base por cada concesión.
   */
  private async upsertEntitlement(params: {
    resourceId: string;
    userId?: string;
    subjectEmail?: string;
    source?: DownloadableEntitlement['source'];
    externalReference?: string;
    externalTransaction?: string;
    grantedBy?: string;
    expiresAt?: Date;
  }): Promise<DownloadableEntitlement> {
    const existing = params.userId
      ? await this.entitlementModel.findOne({
          where: {
            resourceId: params.resourceId,
            userId: params.userId,
            externalReference: params.externalReference ?? null,
          },
        })
      : null;
    if (existing) {
      if (existing.status !== 'ACTIVE') {
        await existing.update({
          status: 'ACTIVE',
          revokedAt: null,
        } as Partial<DownloadableEntitlement>);
      }
      return existing;
    }
    const ent = await this.entitlementModel.create({
      resourceId: params.resourceId,
      userId: params.userId ?? null,
      subjectEmail: params.subjectEmail ?? null,
      source: params.source ?? 'ADMIN_GRANT',
      status: 'ACTIVE',
      externalReference: params.externalReference ?? null,
      externalTransaction: params.externalTransaction ?? null,
      grantedBy: params.grantedBy ?? null,
      expiresAt: params.expiresAt ?? null,
    } as unknown as DownloadableEntitlement['_creationAttributes']);
    this.emit('PremiumAccessGranted', { id: params.resourceId }, { userId: params.userId });
    return ent;
  }

  async revokeEntitlement(resourceId: string, userId: string, externalReference?: string) {
    const ent = await this.entitlementModel.findOne({
      where: { resourceId, userId, externalReference: externalReference ?? null },
    });
    if (!ent) throw new NotFoundException('Entitlement no encontrado');
    await ent.update({
      status: 'REVOKED',
      revokedAt: new Date(),
    } as Partial<DownloadableEntitlement>);
    this.emit('PremiumAccessRevoked', { id: resourceId }, { userId });
    return ent;
  }

  listUserEntitlements(userId: string) {
    return this.entitlementModel.findAll({
      where: { userId, status: 'ACTIVE' },
      order: [['grantedAt', 'DESC']],
    });
  }

  async attachToPublication(
    publicationId: string,
    resourceId: string,
    opts: { label?: string; isPrimary?: boolean; sortOrder?: number; actorId?: string } = {},
  ) {
    await this.getByIdOrFail(resourceId);
    const [link] = await this.linkModel.findOrCreate({
      where: { publicationId, resourceId },
      defaults: {
        publicationId,
        resourceId,
        label: opts.label ?? null,
        isPrimary: opts.isPrimary ?? false,
        sortOrder: opts.sortOrder ?? 0,
        createdBy: opts.actorId ?? null,
      } as unknown as DownloadablePublicationLink['_creationAttributes'],
    });
    this.emit('DownloadableLinkedToPublication', { id: resourceId }, { publicationId });
    return link;
  }

  async detachFromPublication(publicationId: string, resourceId: string) {
    const n = await this.linkModel.destroy({ where: { publicationId, resourceId } });
    if (!n) throw new NotFoundException('Relacion no encontrada');
    this.emit('DownloadableUnlinkedFromPublication', { id: resourceId }, { publicationId });
    return { ok: true };
  }

  async reorderPublicationLinks(publicationId: string, orderedResourceIds: string[]) {
    await Promise.all(
      orderedResourceIds.map((resourceId, index) =>
        this.linkModel.update({ sortOrder: index }, { where: { publicationId, resourceId } }),
      ),
    );
    return { ok: true };
  }

  async listForPublication(publicationId: string, user?: AuthenticatedUser) {
    const links = await this.linkModel.findAll({
      where: { publicationId },
      order: [['sortOrder', 'ASC']],
    });
    const resources = await this.resourceModel.findAll({
      where: { id: { [Op.in]: links.map((l) => l.resourceId) }, status: 'PUBLISHED' },
    });
    const byId = new Map(resources.map((r) => [r.id, r]));
    const context = await this.buildAccessContext(
      resources.map((r) => r.id),
      user,
    );
    const out: Array<Record<string, unknown>> = [];
    for (const link of links) {
      const resource = byId.get(link.resourceId);
      if (!resource) continue;
      const decision = await this.evaluateAccess(resource, user, context);
      out.push({
        ...this.toPublicCard(resource),
        label: link.label,
        isPrimary: link.isPrimary,
        access: decision,
      });
    }
    return out;
  }

  async processHotmartNotification(payload: HotmartPurchaseNotification) {
    return this.tracing.runInSpan(
      'downloadable.hotmart-notification',
      {
        [APP_ATTR.module]: 'downloadables',
        [APP_ATTR.operation]: 'hotmart-notification',
        [APP_ATTR.entityType]: 'external-event',
        // `status` es un enum cerrado de Hotmart; el email del comprador y la
        // firma del webhook nunca se registran.
        [APP_ATTR.eventType]: payload.status,
      },
      () => this.applyHotmartNotification(payload),
    );
  }

  private async applyHotmartNotification(payload: HotmartPurchaseNotification) {
    const verification = this.hotmart.verifyNotification(payload);
    if (!verification.valid) {
      throw new ForbiddenException({
        code: 'HOTMART_INVALID_SIGNATURE',
        reason: verification.reason,
      });
    }
    const [event, created] = await this.externalEventModel.findOrCreate({
      where: { provider: 'HOTMART', eventId: payload.eventId },
      defaults: {
        provider: 'HOTMART',
        eventId: payload.eventId,
        productId: payload.productId ?? null,
        status: payload.status,
        externalReference: payload.externalReference ?? null,
        payload: { ...payload, rawSignature: undefined },
        processed: false,
      } as unknown as DownloadableExternalEvent['_creationAttributes'],
    });
    if (!created && event.processed) {
      return { idempotent: true, result: event.result };
    }

    const resources = await this.resourceModel.findAll({
      where: { hotmartProductId: payload.productId },
    });
    let result = 'NO_MATCHING_RESOURCE';
    for (const resource of resources) {
      if (this.hotmart.grantsAccess(payload)) {
        await this.upsertEntitlement({
          resourceId: resource.id,
          userId: payload.buyerUserId,
          subjectEmail: payload.buyerEmail,
          source: 'PURCHASE',
          externalReference: payload.externalReference,
          externalTransaction: payload.eventId,
        });
        result = 'ACCESS_GRANTED';
        this.emit('HotmartPurchaseConfirmed', resource, { eventId: payload.eventId });
      } else if (this.hotmart.revokesAccess(payload) && payload.buyerUserId) {
        await this.entitlementModel.update(
          { status: 'REVOKED', revokedAt: new Date() },
          { where: { resourceId: resource.id, userId: payload.buyerUserId } },
        );
        result = 'ACCESS_REVOKED';
        this.emit('HotmartPurchaseRevoked', resource, { eventId: payload.eventId });
      }
    }
    await event.update({ processed: true, result } as Partial<DownloadableExternalEvent>);
    return { idempotent: false, result };
  }

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
      pagination: this.paginate(page, pageSize, count),
    };
  }

  async getBySlugOrFail(slug: string): Promise<DownloadableResource> {
    const resource = await this.resourceModel.findOne({ where: { slug } });
    if (!resource) throw new NotFoundException('Descargable no encontrado');
    return resource;
  }

  /**
   * Resolución de slug para el detalle anónimo. A diferencia de
   * `getBySlugOrFail`, nunca revela borradores, archivados, recursos privados ni
   * expirados: responde 404 igual que si no existieran.
   */
  async getPublicBySlugOrFail(slug: string): Promise<DownloadableResource> {
    const resource = await this.resourceModel.findOne({
      where: {
        slug,
        status: 'PUBLISHED',
        visibility: { [Op.in]: ['PUBLIC', 'UNLISTED', 'PREMIUM', 'PURCHASE_REQUIRED'] },
      },
    });
    if (!resource) throw new NotFoundException('Descargable no encontrado');
    if (resource.expiresAt && new Date(resource.expiresAt).getTime() < Date.now()) {
      throw new NotFoundException('Descargable no encontrado');
    }
    return resource;
  }

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

  async myLibrary(user: AuthenticatedUser, page = 1, pageSize = 24) {
    const { rows, count } = await this.resourceModel.findAndCountAll({
      where: {
        status: 'PUBLISHED',
        visibility: { [Op.in]: ['PUBLIC', 'PREMIUM', 'PURCHASE_REQUIRED'] },
      },
      order: [['publishedAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    const context = await this.buildAccessContext(
      rows.map((r) => r.id),
      user,
    );
    const items: Array<Record<string, unknown>> = [];
    for (const r of rows) {
      const access = await this.evaluateAccess(r, user, context);
      items.push({ ...this.toPublicCard(r), access });
    }
    return { items, pagination: this.paginate(page, pageSize, count) };
  }

  async resolveDownload(
    resource: DownloadableResource,
    user: AuthenticatedUser | undefined,
    ctx: { ip?: string; userAgent?: string },
  ): Promise<{ url: string; action: DownloadableAction }> {
    await this.recordDownloadEvent({
      resource,
      user,
      result: 'REQUESTED',
      action: 'DIRECT_DOWNLOAD',
      ...ctx,
    });
    this.emit('DownloadRequested', resource, { userId: user?.sub });
    const decision = await this.evaluateAccess(resource, user);
    if (!decision.allowed) {
      await this.recordDownloadEvent({
        resource,
        user,
        result: 'DENIED',
        action: decision.action,
        ...ctx,
      });
      this.emit('DownloadDenied', resource, { userId: user?.sub, action: decision.action });
      throw new ForbiddenException({
        code: 'DOWNLOAD_NOT_AUTHORIZED',
        action: decision.action,
        checkoutUrl: decision.checkoutUrl,
      });
    }
    if (!resource.fileUrl) {
      await this.recordDownloadEvent({
        resource,
        user,
        result: 'FAILED',
        action: decision.action,
        ...ctx,
      });
      throw new NotFoundException('El recurso no tiene archivo asociado');
    }
    await this.resourceModel.increment('downloadCount', { where: { id: resource.id } });
    await this.recordDownloadEvent({
      resource,
      user,
      result: 'AUTHORIZED',
      action: decision.action,
      ...ctx,
    });
    this.emit('DownloadAuthorized', resource, { userId: user?.sub, action: decision.action });
    return { url: resource.fileUrl, action: decision.action };
  }

  async downloadHistory(userId: string, page = 1, pageSize = 20) {
    const { rows, count } = await this.eventModel.findAndCountAll({
      where: { userId, result: { [Op.in]: ['AUTHORIZED', 'COMPLETED'] } },
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return { items: rows, pagination: this.paginate(page, pageSize, count) };
  }

  async metrics() {
    const [total, published, premium, hotmart] = await Promise.all([
      this.resourceModel.count(),
      this.resourceModel.count({ where: { status: 'PUBLISHED' } }),
      this.resourceModel.count({ where: { visibility: 'PREMIUM' } }),
      this.resourceModel.count({ where: { commercialProvider: 'HOTMART' } }),
    ]);
    const downloads = await this.eventModel.count({
      where: { result: { [Op.in]: ['AUTHORIZED', 'COMPLETED'] } },
    });
    const denied = await this.eventModel.count({ where: { result: 'DENIED' } });
    return { total, published, premium, hotmart, downloads, denied };
  }

  private paginate(page: number, pageSize: number, total: number) {
    return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 };
  }
}
