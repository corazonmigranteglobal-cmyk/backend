import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { ContentSubscriber, PatientProfile, User } from '@/database/models';
import {
  PaginationQueryDto,
  buildPagination,
  buildSafeOrder,
  getEffectiveSearch,
  getEffectiveStatusFilter,
  toLimitOffset,
} from '@/common/pagination/pagination.dto';
import { containsPattern } from '@/common/utils/like.util';
import { AuditService } from '../audit/audit.service';
import { UpdateContentSubscriberDto, UpsertContentSubscriberDto } from './dto/subscriber.dto';

function toIso(value?: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeEmail(value: string) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function isPremiumActive(subscriber?: ContentSubscriber | null) {
  if (!subscriber) return false;
  if (subscriber.status !== 'ACTIVE' || subscriber.subscriptionTier !== 'PREMIUM') return false;
  if (!subscriber.premiumUntil) return true;
  return new Date(subscriber.premiumUntil).getTime() > Date.now();
}

function patientDisplayName(profile?: PatientProfile | null) {
  return [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim() || null;
}

export function toContentSubscriberDto(subscriber: ContentSubscriber) {
  const premium = isPremiumActive(subscriber);
  return {
    id: subscriber.id,
    userId: subscriber.userId,
    patientProfileId: subscriber.userId,
    email: subscriber.email,
    fullName: subscriber.displayName,
    displayName: subscriber.displayName,
    status: subscriber.status,
    subscriptionStatus: premium ? 'ACTIVE' : 'FREE',
    subscriptionTier: subscriber.subscriptionTier,
    premiumUntil: toIso(subscriber.premiumUntil),
    source: subscriber.source,
    consentMetadata: subscriber.consentMetadata ?? {},
    metadata: subscriber.metadata ?? {},
    isPremium: premium,
    isPremiumActive: premium,
    message: premium ? 'Premium activo' : 'Premium no activo',
    createdAt: toIso((subscriber as any).createdAt),
    updatedAt: toIso((subscriber as any).updatedAt),
  };
}

function toPatientSubscriptionDto(user: User, subscriber?: ContentSubscriber | null) {
  const profile = user.patientProfile as PatientProfile | undefined;
  const displayName = subscriber?.displayName || patientDisplayName(profile);
  const premium = isPremiumActive(subscriber);
  return {
    id: subscriber?.id ?? user.id,
    userId: user.id,
    patientProfileId: user.id,
    email: user.email,
    fullName: displayName,
    displayName,
    status: subscriber?.status ?? 'ACTIVE',
    subscriptionStatus: premium ? 'ACTIVE' : 'FREE',
    subscriptionTier: subscriber?.subscriptionTier ?? 'FREE',
    premiumUntil: toIso(subscriber?.premiumUntil),
    source: subscriber?.source ?? 'patient-account',
    consentMetadata: subscriber?.consentMetadata ?? {},
    metadata: subscriber?.metadata ?? {},
    isPremium: premium,
    isPremiumActive: premium,
    message: premium ? 'Premium activo' : 'Premium no activo',
    createdAt: toIso((subscriber as any)?.createdAt ?? (user as any).createdAt),
    updatedAt: toIso((subscriber as any)?.updatedAt ?? (user as any).updatedAt),
  };
}

@Injectable()
export class ContentSubscribersService {
  constructor(
    @InjectModel(ContentSubscriber) private readonly subscriberModel: typeof ContentSubscriber,
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(PatientProfile) private readonly patientProfileModel: typeof PatientProfile,
    private readonly audit: AuditService,
  ) {}

  /**
   * Lista pacientes reales con su estado de suscripción. No lista correos sueltos.
   * Esto evita que el panel administrativo trate como suscriptor a alguien sin cuenta paciente.
   */
  /**
   * Lista pacientes con su estado de suscripción.
   *
   * El filtro por estado se resuelve en SQL sobre `content_subscribers`. La
   * versión anterior traía la tabla de usuarios completa —sin LIMIT— y filtraba
   * y paginaba en memoria, así que el coste crecía con el padrón entero.
   */
  async list(query: PaginationQueryDto) {
    const search = getEffectiveSearch(query);
    const status = getEffectiveStatusFilter(query);
    const subscriberWhere = this.buildSubscriberStatusWhere(status);

    const where = {
      ...(search
        ? {
            [Op.or]: [
              { email: { [Op.iLike]: containsPattern(search) } },
              { '$patientProfile.firstName$': { [Op.iLike]: containsPattern(search) } },
              { '$patientProfile.lastName$': { [Op.iLike]: containsPattern(search) } },
            ],
          }
        : {}),
    } as any;

    const { rows, count } = await this.userModel.findAndCountAll({
      where,
      include: [
        { model: PatientProfile, required: true },
        ...(subscriberWhere
          ? [
              {
                model: ContentSubscriber,
                required: subscriberWhere.required,
                where: subscriberWhere.where,
              } as any,
            ]
          : []),
      ],
      distinct: true,
      ...toLimitOffset(query),
      order: buildSafeOrder(
        query,
        {
          id: 'id',
          email: 'email',
          createdAt: 'createdAt',
          created_at: 'createdAt',
          updatedAt: 'updatedAt',
          updated_at: 'updatedAt',
        },
        'createdAt',
      ),
    });

    const subscribers = rows.length
      ? await this.subscriberModel.findAll({ where: { userId: rows.map((row) => row.id) } })
      : [];
    const byUserId = new Map(subscribers.map((subscriber) => [subscriber.userId, subscriber]));
    const items = rows.map((user) => toPatientSubscriptionDto(user, byUserId.get(user.id) ?? null));

    return { items, pagination: buildPagination(query, count) };
  }

  /**
   * Traduce el filtro de estado del panel a una condición sobre la suscripción.
   * `FREE` incluye a los pacientes sin fila de suscriptor, por eso allí el join
   * no es obligatorio y se compara contra NULL.
   */
  private buildSubscriberStatusWhere(status?: string) {
    const normalized = status?.trim().toUpperCase();
    if (!normalized) return undefined;

    const activePremium = {
      status: 'ACTIVE',
      subscriptionTier: 'PREMIUM',
      [Op.or]: [{ premiumUntil: null }, { premiumUntil: { [Op.gt]: new Date() } }],
    };

    if (normalized === 'PREMIUM') return { required: true, where: { subscriptionTier: 'PREMIUM' } };
    if (normalized === 'ACTIVE') return { required: true, where: { status: 'ACTIVE' } };
    if (normalized === 'FREE') {
      return {
        required: false,
        where: { [Op.not]: activePremium },
      };
    }
    return { required: true, where: { status: normalized } };
  }

  async upsert(actorUserId: string | undefined, dto: UpsertContentSubscriberDto) {
    const payload = await this.buildWritePayload(dto);
    const existing = await this.findExistingSubscriber(payload.userId, payload.email);
    this.assertExistingBelongsToPatient(existing, payload.userId);
    return this.subscriberModel.sequelize!.transaction(async (transaction) => {
      if (existing) {
        const before = existing.toJSON();
        await existing.update(payload as any, { transaction });
        await this.auditWrite(actorUserId, 'update', existing, before, transaction);
        return toContentSubscriberDto(existing);
      }

      const subscriber = await this.subscriberModel.create(payload as any, { transaction });
      await this.auditWrite(actorUserId, 'create', subscriber, undefined, transaction);
      return toContentSubscriberDto(subscriber);
    });
  }

  async requestMine(actorUserId: string) {
    const current = await this.getMine(actorUserId);
    if (current.subscriptionTier === 'PREMIUM' && current.isPremiumActive) {
      return current;
    }
    const now = new Date().toISOString();
    return this.updateByUserId(actorUserId, actorUserId, {
      status: 'PENDING',
      subscriptionTier: 'FREE',
      source: 'patient_request',
      metadata: { ...(current.metadata ?? {}), requestedPremiumAt: now },
    });
  }

  async approveRequest(actorUserId: string, userId: string, premiumUntil?: string) {
    const subscriber = await this.subscriberModel.findOne({ where: { userId } });
    const current = subscriber?.metadata ?? {};
    return this.updateByUserId(actorUserId, userId, {
      status: 'ACTIVE',
      subscriptionTier: 'PREMIUM',
      ...(premiumUntil !== undefined ? { premiumUntil } : {}),
      source: 'admin_approval',
      metadata: { ...current, approvedPremiumAt: new Date().toISOString() },
    });
  }

  async rejectRequest(actorUserId: string, userId: string) {
    const subscriber = await this.subscriberModel.findOne({ where: { userId } });
    const current = subscriber?.metadata ?? {};
    return this.updateByUserId(actorUserId, userId, {
      status: 'ACTIVE',
      subscriptionTier: 'FREE',
      source: 'admin_rejection',
      metadata: { ...current, rejectedPremiumAt: new Date().toISOString() },
    });
  }

  async update(actorUserId: string, id: string, dto: UpdateContentSubscriberDto) {
    const subscriber = await this.find(id);
    const payload = await this.buildWritePayload(dto, subscriber);
    const duplicated = await this.findDuplicatedSubscriber(
      subscriber.id,
      payload.userId,
      payload.email,
    );
    this.assertExistingBelongsToPatient(duplicated, payload.userId);
    const before = subscriber.toJSON();
    return subscriber.sequelize!.transaction(async (transaction) => {
      await subscriber.update(payload as any, { transaction });
      await this.auditWrite(actorUserId, 'update', subscriber, before, transaction);
      return toContentSubscriberDto(subscriber);
    });
  }

  async updateByUserId(actorUserId: string, userId: string, dto: UpdateContentSubscriberDto) {
    const payload = await this.buildWritePayload({
      ...dto,
      userId,
    } as Partial<UpsertContentSubscriberDto>);
    const existing = await this.subscriberModel.findOne({ where: { userId } });

    return this.subscriberModel.sequelize!.transaction(async (transaction) => {
      if (existing) {
        const duplicated = await this.findDuplicatedSubscriber(
          existing.id,
          payload.userId,
          payload.email,
        );
        this.assertExistingBelongsToPatient(duplicated, payload.userId);
        const before = existing.toJSON();
        await existing.update(payload as any, { transaction });
        await this.auditWrite(actorUserId, 'update_by_user', existing, before, transaction);
        return toContentSubscriberDto(existing);
      }

      const duplicated = await this.findExistingSubscriber(payload.userId, payload.email);
      this.assertExistingBelongsToPatient(duplicated, payload.userId);
      if (duplicated) {
        const before = duplicated.toJSON();
        await duplicated.update(payload as any, { transaction });
        await this.auditWrite(actorUserId, 'update_by_user', duplicated, before, transaction);
        return toContentSubscriberDto(duplicated);
      }

      const subscriber = await this.subscriberModel.create(payload as any, { transaction });
      await this.auditWrite(actorUserId, 'create_by_user', subscriber, undefined, transaction);
      return toContentSubscriberDto(subscriber);
    });
  }

  async getMine(userId: string) {
    const user = await this.userModel.findByPk(userId, { include: [PatientProfile] });
    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Usuario no encontrado.' });
    }

    const subscriber = await this.subscriberModel.findOne({ where: { userId } });
    if (subscriber) return toContentSubscriberDto(subscriber);
    return toPatientSubscriptionDto(user, null);
  }

  async assertPremiumAccess(userId: string) {
    const subscription = await this.getMine(userId);
    if (!subscription.isPremiumActive) {
      throw new BadRequestException({
        code: 'PREMIUM_SUBSCRIPTION_REQUIRED',
        message: 'Tu cuenta no tiene una suscripción premium activa.',
      });
    }
    return subscription;
  }

  private async buildWritePayload(
    dto: Partial<UpsertContentSubscriberDto>,
    current?: ContentSubscriber,
  ) {
    const targetUserId = dto.userId ?? current?.userId;
    if (!targetUserId) {
      throw new BadRequestException({
        code: 'SUBSCRIBER_PATIENT_USER_REQUIRED',
        message:
          'Los suscriptores premium deben estar vinculados a una cuenta de paciente existente.',
      });
    }

    const user = await this.assertPatient(targetUserId);
    const userEmail = normalizeEmail(user.email);
    const requestedEmail = dto.email ? normalizeEmail(dto.email) : undefined;
    if (requestedEmail && requestedEmail !== userEmail) {
      throw new BadRequestException({
        code: 'SUBSCRIBER_EMAIL_MUST_MATCH_PATIENT',
        message:
          'El correo del suscriptor debe coincidir con el correo del usuario paciente seleccionado.',
      });
    }

    const profile = user.patientProfile as PatientProfile | undefined;
    const profileName = patientDisplayName(profile);

    return {
      userId: targetUserId,
      email: userEmail,
      ...(dto.displayName !== undefined || profileName
        ? { displayName: dto.displayName?.trim() || profileName || null }
        : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.subscriptionTier !== undefined ? { subscriptionTier: dto.subscriptionTier } : {}),
      ...(dto.premiumUntil !== undefined
        ? { premiumUntil: dto.premiumUntil ? new Date(dto.premiumUntil) : null }
        : {}),
      ...(dto.source !== undefined ? { source: dto.source || 'admin' } : {}),
      ...(dto.consentMetadata !== undefined ? { consentMetadata: dto.consentMetadata ?? {} } : {}),
      ...(dto.metadata !== undefined ? { metadata: dto.metadata ?? {} } : {}),
    };
  }

  private async assertPatient(userId: string) {
    const user = await this.userModel.findByPk(userId, { include: [PatientProfile] });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Usuario paciente no encontrado.',
      });
    }
    if (!user.patientProfile) {
      throw new BadRequestException({
        code: 'SUBSCRIBER_MUST_BE_PATIENT',
        message: 'Los suscriptores premium deben estar vinculados a usuarios pacientes.',
      });
    }
    return user;
  }

  private async find(id: string) {
    const subscriber = await this.subscriberModel.findByPk(id);
    if (!subscriber) {
      throw new NotFoundException({
        code: 'CONTENT_SUBSCRIBER_NOT_FOUND',
        message: 'Suscriptor no encontrado.',
      });
    }
    return subscriber;
  }

  private findExistingSubscriber(userId: string, email: string) {
    return this.subscriberModel.findOne({
      where: {
        [Op.or]: [{ userId }, { email: { [Op.iLike]: normalizeEmail(email) } }],
      } as any,
    });
  }

  private findDuplicatedSubscriber(currentId: string, userId: string, email: string) {
    return this.subscriberModel.findOne({
      where: {
        id: { [Op.ne]: currentId },
        [Op.or]: [{ userId }, { email: { [Op.iLike]: normalizeEmail(email) } }],
      } as any,
    });
  }

  private assertExistingBelongsToPatient(existing: ContentSubscriber | null, userId: string) {
    if (existing?.userId && existing.userId !== userId) {
      throw new BadRequestException({
        code: 'SUBSCRIBER_ALREADY_LINKED_TO_OTHER_PATIENT',
        message: 'El correo o usuario seleccionado ya está vinculado a otro suscriptor paciente.',
      });
    }
  }

  private async auditWrite(
    actorUserId: string | undefined,
    action: string,
    subscriber: ContentSubscriber,
    before?: unknown,
    transaction?: unknown,
  ) {
    if (!actorUserId) return;
    await this.audit.log(
      {
        actorUserId,
        action: `content.subscriber.${action}`,
        entityType: 'ContentSubscriber',
        entityId: subscriber.id,
        before,
        after: subscriber.toJSON(),
      },
      { transaction: transaction as any },
    );
  }
}
