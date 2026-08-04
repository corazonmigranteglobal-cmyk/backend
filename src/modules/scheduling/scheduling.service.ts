import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Transaction } from 'sequelize';
import { createHash } from 'node:crypto';
import { DateTime, IANAZone } from 'luxon';
import {
  Appointment,
  FileAsset,
  TherapistBlockedTime,
  TherapistProduct,
  TherapistProfile,
  TherapistSchedule,
  TherapyProduct,
  User,
} from '@/database/models';
import { containsPattern } from '@/common/utils/like.util';
import { AuditService } from '../audit/audit.service';
import {
  AvailabilityQueryDto,
  CreateBlockedTimeDto,
  CreateScheduleDto,
  UpdateScheduleDto,
} from './dto/scheduling.dto';

const ACTIVE_APPOINTMENT_STATUSES = ['REQUESTED', 'CONFIRMED'];

type UnavailableInterval = {
  startAt?: Date | string;
  endAt?: Date | string;
  scheduledStartAt?: Date | string;
  scheduledEndAt?: Date | string;
};
type NormalizedAvailabilityQuery = {
  therapistUserId: string;
  productId: string;
  from: string;
  to: string;
  timezone: string;
};

type ScheduleRangeInput = {
  weekday: number;
  startTime: string;
  endTime: string;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  status?: string;
};

const UUID_LIKE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function firstNonEmptyString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (Array.isArray(value)) {
      const item = value.find((entry) => typeof entry === 'string' && entry.trim());
      if (typeof item === 'string') return item.trim();
    }
  }
  return undefined;
}

function normalizeIsoDate(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  const dateOnly = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateOnly) return dateOnly[1];

  const parsed = DateTime.fromISO(trimmed, { setZone: true });
  if (parsed.isValid) return parsed.toISODate() ?? undefined;

  const jsDate = new Date(trimmed);
  if (!Number.isNaN(jsDate.getTime())) return DateTime.fromJSDate(jsDate).toISODate() ?? undefined;

  return undefined;
}

function normalizeTimezone(value?: string): string {
  const timezone = value?.trim() || 'America/La_Paz';
  return IANAZone.isValidZone(timezone) ? timezone : 'America/La_Paz';
}

function normalizeTime(value: string) {
  return value.length >= 5 ? value.slice(0, 5) : value;
}

/**
 * Deriva la clave del advisory lock de agenda a partir del id del terapeuta.
 *
 * `pg_advisory_xact_lock` toma un bigint con signo, así que se toman 63 bits del
 * SHA-256 del id. Las colisiones sólo harían que dos terapeutas compartan cola
 * de reserva; nunca permiten una doble reserva.
 */
function agendaLockKey(therapistUserId: string): string {
  const digest = createHash('sha256').update(`agenda:${therapistUserId}`).digest();
  return (digest.readBigUInt64BE(0) & 0x7fff_ffff_ffff_ffffn).toString();
}

/**
 * `GET /booking/*` recibe la query cruda (sin ValidationPipe) por compatibilidad
 * con los aliases del frontend legacy, así que la paginación se acota aquí.
 */
function normalizePublicPaging(source: Record<string, unknown>) {
  const rawPage = Number(firstNonEmptyString(source, ['page', 'p_page', 'pagina']) ?? 1);
  const rawPageSize = Number(
    firstNonEmptyString(source, ['pageSize', 'limit', 'p_limit', 'porPagina']) ?? 50,
  );
  const page = Number.isFinite(rawPage) ? Math.min(Math.max(Math.trunc(rawPage), 1), 1_000) : 1;
  const pageSize = Number.isFinite(rawPageSize)
    ? Math.min(Math.max(Math.trunc(rawPageSize), 1), 100)
    : 50;
  return { page, pageSize };
}

function compactScheduleDto(dto: CreateScheduleDto | UpdateScheduleDto) {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(dto)) {
    if (value === undefined) continue;
    if (typeof value === 'string' && value.trim() === '') {
      if (key === 'effectiveTo') payload[key] = null;
      continue;
    }
    payload[key] = typeof value === 'string' ? value.trim() : value;
  }
  return payload;
}

@Injectable()
export class SchedulingService {
  constructor(
    @InjectModel(TherapistSchedule) private readonly scheduleModel: typeof TherapistSchedule,
    @InjectModel(TherapistBlockedTime) private readonly blockedModel: typeof TherapistBlockedTime,
    @InjectModel(Appointment) private readonly appointmentModel: typeof Appointment,
    @InjectModel(TherapyProduct) private readonly productModel: typeof TherapyProduct,
    @InjectModel(TherapistProfile) private readonly therapistProfileModel: typeof TherapistProfile,
    @InjectModel(TherapistProduct) private readonly therapistProductModel: typeof TherapistProduct,
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(FileAsset) private readonly fileModel: typeof FileAsset,
    private readonly audit: AuditService,
  ) {}

  private assertValidScheduleRange(input: ScheduleRangeInput) {
    if (input.endTime <= input.startTime) {
      throw new BadRequestException({
        code: 'SCHEDULE_INVALID_RANGE',
        message: 'La hora final debe ser mayor a la hora inicial.',
        details: [`startTime=${input.startTime}`, `endTime=${input.endTime}`],
      });
    }
    if (input.effectiveFrom && input.effectiveTo && input.effectiveTo < input.effectiveFrom) {
      throw new BadRequestException({
        code: 'SCHEDULE_INVALID_EFFECTIVE_RANGE',
        message: 'La fecha de vigencia final debe ser posterior o igual a la fecha inicial.',
        details: [`effectiveFrom=${input.effectiveFrom}`, `effectiveTo=${input.effectiveTo}`],
      });
    }
  }

  private async assertNoScheduleOverlap(
    therapistUserId: string,
    input: ScheduleRangeInput,
    excludeScheduleId?: string,
  ) {
    if (input.status === 'INACTIVE') return;

    const where: any = {
      therapistUserId,
      weekday: input.weekday,
      status: 'ACTIVE',
      [Op.or]: [{ startTime: { [Op.lt]: input.endTime }, endTime: { [Op.gt]: input.startTime } }],
    };
    if (excludeScheduleId) where.id = { [Op.ne]: excludeScheduleId };

    const overlaps = await this.scheduleModel.findOne({ where: where as any });
    if (overlaps) {
      throw new BadRequestException({
        code: 'SCHEDULE_OVERLAP',
        message: 'El horario se solapa con otro horario activo del mismo terapeuta.',
        details: [
          `weekday=${input.weekday}`,
          `startTime=${input.startTime}`,
          `endTime=${input.endTime}`,
          `existingScheduleId=${overlaps.id}`,
        ],
      });
    }
  }

  private buildFileUrl(fileId?: string | null, file?: FileAsset | null) {
    const metadata = (file?.metadata ?? {}) as Record<string, unknown>;
    const explicitUrl = String(
      metadata.publicUrl ?? metadata.downloadUrl ?? metadata.url ?? '',
    ).trim();
    if (explicitUrl) return explicitUrl;
    if (!fileId) return undefined;
    const baseUrl = (
      process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`
    ).replace(/\/+$/, '');
    const apiPrefix = (process.env.API_PREFIX ?? 'api/v1').replace(/^\/+|\/+$/g, '');
    return `${baseUrl}/${apiPrefix}/files/${fileId}/download`;
  }

  /**
   * Directorio público de terapeutas.
   *
   * Es un endpoint anónimo: no expone el email del terapeuta ni ningún otro
   * dato de contacto. Búsqueda, filtro por producto y paginación se resuelven
   * en SQL para que la respuesta no crezca con el tamaño del catálogo.
   */
  async listPublicTherapists(rawQuery: Record<string, unknown> = {}) {
    const productId = firstNonEmptyString(rawQuery, [
      'productId',
      'therapyProductId',
      'product_id',
      'serviceId',
    ]);
    const search = firstNonEmptyString(rawQuery, ['search', 'q', 'query']);
    const { page, pageSize } = normalizePublicPaging(rawQuery);

    let allowedTherapistIds: string[] | undefined;
    if (productId && UUID_LIKE_PATTERN.test(productId)) {
      const links = await this.therapistProductModel.findAll({
        where: { productId, isActive: true } as any,
        attributes: ['therapistUserId'],
      });
      if (links.length > 0) {
        allowedTherapistIds = links.map((link) => link.therapistUserId);
      }
    }

    const searchPattern = search ? containsPattern(search) : undefined;
    const { rows: profiles, count } = await this.therapistProfileModel.findAndCountAll({
      where: {
        approvalStatus: { [Op.notIn]: ['REJECTED', 'SUSPENDED', 'INACTIVE'] },
        ...(allowedTherapistIds ? { userId: { [Op.in]: allowedTherapistIds } } : {}),
        ...(searchPattern
          ? {
              [Op.or]: [
                { firstName: { [Op.iLike]: searchPattern } },
                { lastName: { [Op.iLike]: searchPattern } },
                { title: { [Op.iLike]: searchPattern } },
                { mainSpecialty: { [Op.iLike]: searchPattern } },
              ],
            }
          : {}),
      } as any,
      include: [
        {
          model: User,
          required: true,
          attributes: ['id'],
          where: { status: 'ACTIVE' } as any,
        },
      ],
      order: [
        ['lastName', 'ASC'],
        ['firstName', 'ASC'],
      ],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      distinct: true,
    });

    const avatarIds = profiles.map((profile) => profile.avatarFileId).filter(Boolean) as string[];
    const avatarFiles = avatarIds.length
      ? await this.fileModel.findAll({
          where: { id: { [Op.in]: avatarIds }, status: 'ACTIVE' } as any,
        })
      : [];
    const avatarById = new Map(avatarFiles.map((file) => [file.id, file]));

    const items = profiles.map((profile) => {
      const name = `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() || 'Terapeuta';
      const avatarFile = profile.avatarFileId ? avatarById.get(profile.avatarFileId) : undefined;
      return {
        id: profile.userId,
        userId: profile.userId,
        therapistUserId: profile.userId,
        name,
        title: profile.title,
        mainSpecialty: profile.mainSpecialty,
        specialty: profile.mainSpecialty,
        bio: profile.bio ?? '',
        personalPhrase: profile.personalPhrase ?? '',
        city: profile.city ?? '',
        country: profile.country ?? '',
        approvalStatus: profile.approvalStatus,
        avatarFileId: profile.avatarFileId ?? null,
        avatarUrl: this.buildFileUrl(profile.avatarFileId, avatarFile),
        timezone: 'America/La_Paz',
      };
    });

    return {
      items,
      pagination: {
        page,
        pageSize,
        total: count,
        totalPages: Math.max(1, Math.ceil(count / pageSize)),
      },
    };
  }

  async createSchedule(
    therapistUserId: string,
    dto: CreateScheduleDto,
    actorUserId = therapistUserId,
  ) {
    const payload = compactScheduleDto(dto) as unknown as CreateScheduleDto;
    const scheduleInput: ScheduleRangeInput = {
      weekday: Number(payload.weekday),
      startTime: normalizeTime(String(payload.startTime)),
      endTime: normalizeTime(String(payload.endTime)),
      effectiveFrom: String(payload.effectiveFrom),
      effectiveTo: payload.effectiveTo ? String(payload.effectiveTo) : undefined,
      status: 'ACTIVE',
    };

    this.assertValidScheduleRange(scheduleInput);
    await this.assertNoScheduleOverlap(therapistUserId, scheduleInput);

    return this.scheduleModel.sequelize!.transaction(async (transaction) => {
      const schedule = await this.scheduleModel.create(
        {
          therapistUserId,
          weekday: scheduleInput.weekday,
          startTime: scheduleInput.startTime,
          endTime: scheduleInput.endTime,
          timezone: payload.timezone || 'America/La_Paz',
          effectiveFrom: scheduleInput.effectiveFrom,
          effectiveTo: scheduleInput.effectiveTo,
          status: 'ACTIVE',
          version: 1,
        } as any,
        { transaction },
      );
      await this.audit.log(
        {
          actorUserId,
          action: 'scheduling.create_schedule',
          entityType: 'TherapistSchedule',
          entityId: schedule.id,
          after: schedule.toJSON(),
        },
        { transaction },
      );
      return schedule;
    });
  }

  listSchedulesForTherapist(therapistUserId: string) {
    return this.scheduleModel.findAll({
      where: { therapistUserId },
      order: [
        ['weekday', 'ASC'],
        ['startTime', 'ASC'],
      ],
    });
  }

  listMySchedules(therapistUserId: string) {
    return this.listSchedulesForTherapist(therapistUserId);
  }

  async updateScheduleForTherapist(
    therapistUserId: string,
    scheduleId: string,
    dto: UpdateScheduleDto,
    actorUserId = therapistUserId,
  ) {
    const schedule = await this.scheduleModel.findOne({
      where: { id: scheduleId, therapistUserId },
    });
    if (!schedule) {
      throw new NotFoundException({
        code: 'SCHEDULE_NOT_FOUND',
        message: 'Horario no encontrado para este terapeuta.',
        details: [`therapistUserId=${therapistUserId}`, `scheduleId=${scheduleId}`],
      });
    }

    const before = schedule.toJSON();
    const payload = compactScheduleDto(dto) as Partial<UpdateScheduleDto>;
    const next: ScheduleRangeInput = {
      weekday: Number(payload.weekday ?? schedule.weekday),
      startTime: normalizeTime(String(payload.startTime ?? schedule.startTime)),
      endTime: normalizeTime(String(payload.endTime ?? schedule.endTime)),
      effectiveFrom: String(payload.effectiveFrom ?? schedule.effectiveFrom),
      effectiveTo:
        (payload as any).effectiveTo === null
          ? null
          : String(payload.effectiveTo ?? schedule.effectiveTo ?? ''),
      status: String(payload.status ?? schedule.status ?? 'ACTIVE'),
    };

    this.assertValidScheduleRange(next);
    await this.assertNoScheduleOverlap(therapistUserId, next, scheduleId);

    return this.scheduleModel.sequelize!.transaction(async (transaction) => {
      await schedule.update(
        {
          ...payload,
          weekday: next.weekday,
          startTime: next.startTime,
          endTime: next.endTime,
          effectiveFrom: next.effectiveFrom,
          effectiveTo: next.effectiveTo || null,
          version: Number(schedule.version ?? 1) + 1,
        } as any,
        { transaction },
      );
      await this.audit.log(
        {
          actorUserId,
          action: 'scheduling.update_schedule',
          entityType: 'TherapistSchedule',
          entityId: schedule.id,
          before,
          after: schedule.toJSON(),
        },
        { transaction },
      );
      return schedule;
    });
  }

  async deactivateScheduleForTherapist(
    therapistUserId: string,
    scheduleId: string,
    actorUserId = therapistUserId,
  ) {
    return this.updateScheduleForTherapist(
      therapistUserId,
      scheduleId,
      { status: 'INACTIVE' },
      actorUserId,
    );
  }

  async createBlockedTime(therapistUserId: string, dto: CreateBlockedTimeDto) {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt)
      throw new BadRequestException({
        code: 'BLOCK_INVALID_RANGE',
        message:
          'El bloqueo debe tener una fecha/hora inicial y final válida, y la final debe ser mayor.',
      });
    return this.blockedModel.sequelize!.transaction(async (transaction) => {
      const blocked = await this.blockedModel.create(
        {
          therapistUserId,
          startAt,
          endAt,
          reason: dto.reason,
          status: 'ACTIVE',
        } as any,
        { transaction },
      );
      await this.audit.log(
        {
          actorUserId: therapistUserId,
          action: 'scheduling.create_block',
          entityType: 'TherapistBlockedTime',
          entityId: blocked.id,
          after: blocked.toJSON(),
        },
        { transaction },
      );
      return blocked;
    });
  }

  private normalizeAvailabilityQuery(
    query: AvailabilityQueryDto | Record<string, unknown>,
  ): NormalizedAvailabilityQuery {
    const source = query as Record<string, unknown>;
    const therapistUserId = firstNonEmptyString(source, [
      'therapistUserId',
      'therapistId',
      'therapist_user_id',
      'idTerapeuta',
      'terapeutaId',
    ]);
    const productId = firstNonEmptyString(source, [
      'productId',
      'therapyProductId',
      'product_id',
      'serviceId',
      'servicioId',
    ]);
    const from = normalizeIsoDate(
      firstNonEmptyString(source, [
        'from',
        'startDate',
        'start',
        'dateFrom',
        'fechaDesde',
        'fecha',
      ]),
    );
    const to =
      normalizeIsoDate(
        firstNonEmptyString(source, ['to', 'endDate', 'end', 'dateTo', 'fechaHasta']),
      ) ?? from;
    const timezone = normalizeTimezone(
      firstNonEmptyString(source, ['timezone', 'timeZone', 'tz', 'zonaHoraria']),
    );

    const details: string[] = [];
    if (!therapistUserId) details.push('therapistUserId es requerido.');
    if (!productId) details.push('productId es requerido.');
    if (!from) details.push('from debe ser una fecha válida, por ejemplo 2026-07-10.');
    if (!to) details.push('to debe ser una fecha válida, por ejemplo 2026-07-10.');
    if (therapistUserId && !UUID_LIKE_PATTERN.test(therapistUserId)) {
      details.push('therapistUserId debe ser un UUID válido.');
    }
    if (productId && !UUID_LIKE_PATTERN.test(productId)) {
      details.push('productId debe ser un UUID válido.');
    }

    if (details.length) {
      throw new BadRequestException({
        code: 'AVAILABILITY_QUERY_INVALID',
        message:
          'No se pudo consultar disponibilidad porque faltan datos obligatorios o algún valor no es válido.',
        details,
      });
    }

    return {
      therapistUserId: therapistUserId!,
      productId: productId!,
      from: from!,
      to: to!,
      timezone,
    };
  }

  async getAvailability(rawQuery: AvailabilityQueryDto | Record<string, unknown>) {
    const query = this.normalizeAvailabilityQuery(rawQuery);
    const product = await this.productModel.findByPk(query.productId);
    if (!product)
      throw new NotFoundException({
        code: 'THERAPY_PRODUCT_NOT_FOUND',
        message: 'Producto no encontrado.',
        details: [`productId=${query.productId}`],
      });
    const from = DateTime.fromISO(query.from, { zone: query.timezone }).startOf('day');
    const to = DateTime.fromISO(query.to, { zone: query.timezone }).endOf('day');
    if (!from.isValid || !to.isValid || to < from)
      throw new BadRequestException({
        code: 'AVAILABILITY_INVALID_RANGE',
        message: 'Rango de fechas inválido.',
        details: [
          `from=${query.from}`,
          `to=${query.to}`,
          `timezone=${query.timezone}`,
          from.invalidExplanation ?? from.invalidReason ?? '',
          to.invalidExplanation ?? to.invalidReason ?? '',
        ].filter(Boolean),
      });
    if (to.diff(from, 'days').days > 31)
      throw new BadRequestException({
        code: 'AVAILABILITY_RANGE_TOO_LONG',
        message: 'El rango máximo es de 31 días.',
      });

    const schedules = await this.scheduleModel.findAll({
      where: { therapistUserId: query.therapistUserId, status: 'ACTIVE' },
    });

    if (!schedules.length) {
      return {
        therapistUserId: query.therapistUserId,
        productId: query.productId,
        slots: [],
        reason: 'THERAPIST_HAS_NO_ACTIVE_SCHEDULES',
        message: 'El terapeuta todavía no tiene horarios activos configurados.',
      };
    }

    const startUtc = from.toUTC().toJSDate();
    const endUtc = to.toUTC().toJSDate();
    const [appointments, blocks] = await Promise.all([
      this.appointmentModel.findAll({
        where: {
          therapistUserId: query.therapistUserId,
          status: ACTIVE_APPOINTMENT_STATUSES,
          scheduledStartAt: { [Op.lt]: endUtc },
          scheduledEndAt: { [Op.gt]: startUtc },
        } as any,
      }),
      this.blockedModel.findAll({
        where: {
          therapistUserId: query.therapistUserId,
          status: 'ACTIVE',
          startAt: { [Op.lt]: endUtc },
          endAt: { [Op.gt]: startUtc },
        } as any,
      }),
    ]);
    const unavailable: UnavailableInterval[] = [...appointments, ...blocks];

    // El cursor de slots avanza `duration` minutos por iteración: una duración
    // no positiva (dato corrupto en el catálogo) haría que el bucle no avance
    // nunca y colgaría el proceso atendiendo una petición pública.
    const rawDuration = Number(product.durationMinutes);
    const duration = Number.isFinite(rawDuration) && rawDuration > 0 ? Math.trunc(rawDuration) : 60;
    const slots: { startAt: string; endAt: string; timezone: string }[] = [];
    for (let day = from; day <= to; day = day.plus({ days: 1 })) {
      const jsWeekday = day.weekday % 7;
      const isoDate = day.toISODate()!;
      const daySchedules = schedules.filter(
        (schedule) =>
          schedule.weekday === jsWeekday &&
          isoDate >= schedule.effectiveFrom &&
          (!schedule.effectiveTo || isoDate <= schedule.effectiveTo),
      );
      for (const schedule of daySchedules) {
        let cursor = DateTime.fromISO(`${isoDate}T${normalizeTime(schedule.startTime)}`, {
          zone: schedule.timezone || query.timezone,
        });
        const scheduleEnd = DateTime.fromISO(`${isoDate}T${normalizeTime(schedule.endTime)}`, {
          zone: schedule.timezone || query.timezone,
        });
        while (cursor.plus({ minutes: duration }) <= scheduleEnd) {
          const slotStart = cursor.toUTC();
          const slotEnd = cursor.plus({ minutes: duration }).toUTC();
          if (!this.overlapsAny(slotStart.toJSDate(), slotEnd.toJSDate(), unavailable)) {
            slots.push({
              startAt: slotStart.toISO()!,
              endAt: slotEnd.toISO()!,
              timezone: query.timezone,
            });
          }
          cursor = cursor.plus({ minutes: duration });
        }
      }
    }
    return { therapistUserId: query.therapistUserId, productId: query.productId, slots };
  }

  /**
   * Comprueba si un hueco del terapeuta está libre.
   *
   * Cuando se llama con `transaction` primero se toma un advisory lock sobre el
   * terapeuta. `SELECT … FOR UPDATE` NO sirve aquí: bloquea las filas que
   * existen, y el caso a evitar es justo el contrario —dos transacciones
   * concurrentes que no encuentran nada, ambas concluyen "libre" y ambas
   * insertan—. El advisory lock serializa a los que reservan agenda del mismo
   * terapeuta y se libera solo al terminar la transacción.
   */
  async isSlotAvailable(
    therapistUserId: string,
    startAt: Date,
    endAt: Date,
    transaction?: Transaction,
  ): Promise<boolean> {
    if (transaction) {
      await this.acquireTherapistAgendaLock(therapistUserId, transaction);
    }

    const [appointment, block] = await Promise.all([
      this.appointmentModel.findOne({
        where: {
          therapistUserId,
          status: ACTIVE_APPOINTMENT_STATUSES,
          scheduledStartAt: { [Op.lt]: endAt },
          scheduledEndAt: { [Op.gt]: startAt },
        } as any,
        transaction,
      }),
      this.blockedModel.findOne({
        where: {
          therapistUserId,
          status: 'ACTIVE',
          startAt: { [Op.lt]: endAt },
          endAt: { [Op.gt]: startAt },
        },
        transaction,
      }),
    ]);
    return !appointment && !block;
  }

  /**
   * Serializa las escrituras sobre la agenda de un terapeuta dentro de la
   * transacción en curso. La clave es un entero de 64 bits derivado del UUID,
   * que es lo que acepta `pg_advisory_xact_lock`.
   */
  private async acquireTherapistAgendaLock(therapistUserId: string, transaction: Transaction) {
    const lockKey = agendaLockKey(therapistUserId);
    await this.appointmentModel.sequelize!.query(
      'SELECT pg_advisory_xact_lock(CAST(:lockKey AS bigint))',
      { replacements: { lockKey }, transaction },
    );
  }

  private overlapsAny(start: Date, end: Date, list: UnavailableInterval[]) {
    return list.some((item) => {
      const rawStart = item.startAt ?? item.scheduledStartAt!;
      const rawEnd = item.endAt ?? item.scheduledEndAt!;
      const itemStart = rawStart instanceof Date ? rawStart : new Date(rawStart);
      const itemEnd = rawEnd instanceof Date ? rawEnd : new Date(rawEnd);
      return itemStart < end && itemEnd > start;
    });
  }
}
