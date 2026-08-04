import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { AdminProfile, FileAsset, PatientProfile, TherapistProfile, User } from '@/database/models';
import {
  PaginationQueryDto,
  buildPagination,
  getEffectiveSearch,
  getEffectiveStatusFilter,
  buildSafeOrder,
  toLimitOffset,
} from '@/common/pagination/pagination.dto';
import { containsPattern } from '@/common/utils/like.util';
import { RolesPermissionsService } from '../roles-permissions/roles-permissions.service';
import { AuditService } from '../audit/audit.service';
import { UpdatePatientProfileDto, UpdateTherapistProfileDto } from './dto/update-profile.dto';

const USER_STATUSES = ['ACTIVE', 'INACTIVE', 'BLOCKED', 'PENDING'];
const USER_STATUS_ALIASES: Record<string, string> = {
  ACTIVE: 'ACTIVE',
  ACTIVO: 'ACTIVE',
  ACTIVA: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  INACTIVO: 'INACTIVE',
  INACTIVA: 'INACTIVE',
  BLOCKED: 'BLOCKED',
  BLOQUEADO: 'BLOCKED',
  BLOQUEADA: 'BLOCKED',
  PENDING: 'PENDING',
  PENDIENTE: 'PENDING',
};

function normalizeStatusFilter(value?: string) {
  if (!value) return undefined;
  const token = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (!token || ['ALL', 'TODOS', 'TODAS', '*'].includes(token)) return undefined;
  return USER_STATUS_ALIASES[token] ?? token;
}

function compactDto<T extends Record<string, unknown>>(dto: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(dto)
      .filter(([, value]) => {
        if (value === undefined || value === null) return false;
        if (typeof value === 'string' && value.trim() === '') return false;
        return true;
      })
      .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]),
  ) as Partial<T>;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(PatientProfile) private readonly patientProfileModel: typeof PatientProfile,
    @InjectModel(TherapistProfile) private readonly therapistProfileModel: typeof TherapistProfile,
    @InjectModel(AdminProfile) private readonly adminProfileModel: typeof AdminProfile,
    @InjectModel(FileAsset) private readonly fileModel: typeof FileAsset,
    private readonly rolesPermissions: RolesPermissionsService,
    private readonly audit: AuditService,
  ) {}

  private buildAvatarUrl(avatarFileId?: string | null) {
    if (!avatarFileId) return undefined;
    const baseUrl = (
      process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`
    ).replace(/\/+$/, '');
    const apiPrefix = (process.env.API_PREFIX ?? 'api/v1').replace(/^\/+|\/+$/g, '');
    return `${baseUrl}/${apiPrefix}/files/${avatarFileId}/download`;
  }

  private serializeProfileWithAvatar(profile: any) {
    if (!profile) return profile;
    const plain =
      typeof profile.toJSON === 'function'
        ? profile.toJSON()
        : { ...(profile as Record<string, unknown>) };
    const avatarFileId = String(plain.avatarFileId ?? plain.avatar_file_id ?? '');
    return {
      ...plain,
      avatarUrl: this.buildAvatarUrl(avatarFileId),
    };
  }

  async me(userId: string) {
    const user = await this.userModel.findByPk(userId, {
      include: [PatientProfile, TherapistProfile, AdminProfile],
    });
    if (!user)
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Usuario no encontrado.' });
    const auth = await this.rolesPermissions.getUserRolesAndPermissions(user.id);
    return {
      id: user.id,
      email: user.email,
      status: user.status,
      ...auth,
      patientProfile: this.serializeProfileWithAvatar(user.patientProfile),
      therapistProfile: this.serializeProfileWithAvatar(user.therapistProfile),
      adminProfile: user.adminProfile,
    };
  }

  async updatePatientProfile(userId: string, dto: UpdatePatientProfileDto, actorUserId = userId) {
    const profile = await this.patientProfileModel.findByPk(userId);
    if (!profile)
      throw new NotFoundException({
        code: 'PATIENT_PROFILE_NOT_FOUND',
        message: 'Perfil paciente no encontrado.',
      });
    const payload = compactDto(dto as any);
    const before = profile.toJSON();
    return this.patientProfileModel.sequelize!.transaction(async (transaction) => {
      await profile.update(payload as any, { transaction });
      await this.audit.log(
        {
          actorUserId,
          action: 'users.update_patient_profile',
          entityType: 'PatientProfile',
          entityId: userId,
          before,
          after: payload as any,
        },
        { transaction },
      );
      return profile;
    });
  }

  async updateTherapistProfile(
    userId: string,
    dto: UpdateTherapistProfileDto,
    actorUserId = userId,
  ) {
    const profile = await this.therapistProfileModel.findByPk(userId);
    if (!profile)
      throw new NotFoundException({
        code: 'THERAPIST_PROFILE_NOT_FOUND',
        message: 'Perfil terapeuta no encontrado.',
        details: [`userId=${userId}`],
      });
    const payload = compactDto(dto as any);
    const before = profile.toJSON();
    return this.therapistProfileModel.sequelize!.transaction(async (transaction) => {
      await profile.update(payload as any, { transaction });
      await this.audit.log(
        {
          actorUserId,
          action:
            actorUserId === userId
              ? 'users.update_therapist_profile'
              : 'users.admin_update_therapist_profile',
          entityType: 'TherapistProfile',
          entityId: userId,
          before,
          after: payload as any,
        },
        { transaction },
      );
      return profile;
    });
  }

  async updateUserAvatar(userId: string, avatarFileId: string, actorUserId: string) {
    const file = await this.fileModel.findByPk(avatarFileId);
    if (!file) {
      throw new NotFoundException({
        code: 'FILE_NOT_FOUND',
        message: 'Archivo de foto no encontrado.',
        details: [`avatarFileId=${avatarFileId}`],
      });
    }

    const module = String((file as any).module ?? '').toUpperCase();
    const entityId = String((file as any).entityId ?? '');
    if (module !== 'USER_PROFILE' || (entityId && entityId !== userId)) {
      throw new BadRequestException({
        code: 'USER_AVATAR_FILE_INVALID',
        message: 'El archivo no corresponde a una foto de perfil de este usuario.',
        details: [`module=${module}`, `entityId=${entityId}`, `userId=${userId}`],
      });
    }

    const [therapistProfile, patientProfile] = await Promise.all([
      this.therapistProfileModel.findByPk(userId),
      this.patientProfileModel.findByPk(userId),
    ]);

    const profile = therapistProfile ?? patientProfile;
    if (!profile) {
      throw new NotFoundException({
        code: 'USER_PROFILE_NOT_FOUND',
        message: 'No se encontró un perfil paciente o terapeuta para vincular la foto.',
        details: [`userId=${userId}`],
      });
    }

    const before = profile.toJSON();
    return profile.sequelize!.transaction(async (transaction) => {
      await (profile as any).update({ avatarFileId } as any, { transaction });
      await this.audit.log(
        {
          actorUserId,
          action: 'users.admin_update_avatar',
          entityType: therapistProfile ? 'TherapistProfile' : 'PatientProfile',
          entityId: userId,
          before,
          after: { avatarFileId },
        },
        { transaction },
      );
      return { userId, avatarFileId, avatarUrl: this.buildAvatarUrl(avatarFileId) };
    });
  }

  async updateUserStatus(userId: string, status: string, actorUserId: string) {
    const normalizedStatus = String(status ?? '')
      .trim()
      .toUpperCase();
    if (!USER_STATUSES.includes(normalizedStatus)) {
      throw new BadRequestException({
        code: 'USER_STATUS_INVALID',
        message: 'Estado de usuario inválido.',
        details: [`status=${status}`, `allowed=${USER_STATUSES.join(',')}`],
      });
    }
    const user = await this.userModel.findByPk(userId);
    if (!user)
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Usuario no encontrado.',
        details: [`userId=${userId}`],
      });
    const before = user.toJSON();
    return this.userModel.sequelize!.transaction(async (transaction) => {
      await user.update({ status: normalizedStatus } as any, { transaction });
      await this.audit.log(
        {
          actorUserId,
          action: 'users.admin_update_status',
          entityType: 'User',
          entityId: user.id,
          before,
          after: { status: normalizedStatus },
        },
        { transaction },
      );
      return { id: user.id, email: user.email, status: user.status };
    });
  }

  async listPatients(query: PaginationQueryDto) {
    const search = getEffectiveSearch(query);
    const status = normalizeStatusFilter(getEffectiveStatusFilter(query));
    const where = {
      ...(status ? { status } : {}),
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
      include: [{ model: PatientProfile, required: true }],
      distinct: true,
      ...toLimitOffset(query),
      order: buildSafeOrder(
        query,
        {
          id: 'id',
          email: 'email',
          status: 'status',
          createdAt: 'createdAt',
          created_at: 'createdAt',
          updatedAt: 'updatedAt',
          updated_at: 'updatedAt',
        },
        'createdAt',
      ),
    });

    const items = rows.map((u) => ({
      id: u.id,
      email: u.email,
      status: u.status,
      role: 'PACIENTE',
      roles: ['PACIENTE'],
      createdAt: u.createdAt,
      patientProfile: this.serializeProfileWithAvatar(u.patientProfile),
    }));

    return { items, pagination: buildPagination(query, count) };
  }

  async list(query: PaginationQueryDto) {
    const search = getEffectiveSearch(query);
    const status = normalizeStatusFilter(getEffectiveStatusFilter(query));
    const where = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            [Op.or]: [
              { email: { [Op.iLike]: containsPattern(search) } },
              { '$patientProfile.firstName$': { [Op.iLike]: containsPattern(search) } },
              { '$patientProfile.lastName$': { [Op.iLike]: containsPattern(search) } },
              { '$therapistProfile.firstName$': { [Op.iLike]: containsPattern(search) } },
              { '$therapistProfile.lastName$': { [Op.iLike]: containsPattern(search) } },
            ],
          }
        : {}),
    } as any;
    const { rows, count } = await this.userModel.findAndCountAll({
      where,
      include: [PatientProfile, TherapistProfile, AdminProfile],
      distinct: true,
      ...toLimitOffset(query),
      order: buildSafeOrder(
        query,
        {
          id: 'id',
          email: 'email',
          status: 'status',
          createdAt: 'createdAt',
          created_at: 'createdAt',
          updatedAt: 'updatedAt',
          updated_at: 'updatedAt',
        },
        'createdAt',
      ),
    });

    // Una sola resolución en lote para toda la página: pedir roles y permisos
    // usuario por usuario disparaba 4 consultas por fila.
    const authByUserId = await this.rolesPermissions.getRolesAndPermissionsForUsers(
      rows.map((u) => u.id),
    );

    const items = rows.map((u) => {
      const auth = authByUserId.get(u.id) ?? { roles: [], permissions: [] };
      return {
        id: u.id,
        email: u.email,
        status: u.status,
        role: auth.roles[0] ?? 'NO_EXPUESTO',
        roles: auth.roles,
        permissions: auth.permissions,
        createdAt: u.createdAt,
        patientProfile: this.serializeProfileWithAvatar(u.patientProfile),
        therapistProfile: this.serializeProfileWithAvatar(u.therapistProfile),
        adminProfile: u.adminProfile,
      };
    });

    return { items, pagination: buildPagination(query, count) };
  }
}
