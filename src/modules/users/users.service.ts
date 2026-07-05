import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { AdminProfile, PatientProfile, Role, TherapistProfile, User } from '@/database/models';
import {
  PaginationQueryDto,
  buildPagination,
  buildSafeOrder,
  getEffectiveRoleFilter,
  getEffectiveSearch,
  getEffectiveStatusFilter,
  toLimitOffset,
} from '@/common/pagination/pagination.dto';
import { RolesPermissionsService } from '../roles-permissions/roles-permissions.service';
import { AuditService } from '../audit/audit.service';
import { UpdatePatientProfileDto, UpdateTherapistProfileDto } from './dto/update-profile.dto';

const IGNORED_FILTER_VALUES = new Set(['ALL', 'TODOS', 'TODAS', '*']);

const STATUS_ALIASES: Record<string, string> = {
  ACTIVE: 'ACTIVE',
  ACTIVO: 'ACTIVE',
  ACTIVA: 'ACTIVE',
  ENABLED: 'ACTIVE',
  HABILITADO: 'ACTIVE',
  HABILITADA: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  INACTIVO: 'INACTIVE',
  INACTIVA: 'INACTIVE',
  DISABLED: 'INACTIVE',
  DESHABILITADO: 'INACTIVE',
  DESHABILITADA: 'INACTIVE',
  BLOCKED: 'BLOCKED',
  BLOQUEADO: 'BLOCKED',
  BLOQUEADA: 'BLOCKED',
  LOCKED: 'BLOCKED',
  PENDING: 'PENDING',
  PENDIENTE: 'PENDING',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  PENDIENTE_APROBACION: 'PENDING_APPROVAL',
  PENDIENTE_DE_APROBACION: 'PENDING_APPROVAL',
};

const ROLE_ALIASES: Record<string, string> = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  SUPERADMIN: 'SUPER_ADMIN',
  ADMINISTRADOR_TOTAL: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  ADMINISTRADOR: 'ADMIN',
  ACCOUNTANT: 'ACCOUNTANT',
  CONTADOR: 'ACCOUNTANT',
  CONTADORA: 'ACCOUNTANT',
  THERAPIST: 'THERAPIST',
  TERAPEUTA: 'THERAPIST',
  PSICOLOGO: 'THERAPIST',
  PSICOLOGA: 'THERAPIST',
  PATIENT: 'PATIENT',
  PACIENTE: 'PATIENT',
};

const ROLE_LABELS_ES: Record<string, string> = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  ACCOUNTANT: 'CONTADOR',
  THERAPIST: 'TERAPEUTA',
  PATIENT: 'PACIENTE',
};

function normalizeToken(value?: string) {
  if (!value) return undefined;
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

function normalizeFilter(value?: string, aliases?: Record<string, string>) {
  const token = normalizeToken(value);
  if (!token || IGNORED_FILTER_VALUES.has(token)) return undefined;
  return aliases?.[token] ?? token;
}

function displayNameFromProfiles(user: User) {
  const profile = user.patientProfile ?? user.therapistProfile ?? user.adminProfile;
  const firstName = String((profile as any)?.firstName ?? '').trim();
  const lastName = String((profile as any)?.lastName ?? '').trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  return fullName || user.email;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(PatientProfile) private readonly patientProfileModel: typeof PatientProfile,
    @InjectModel(TherapistProfile) private readonly therapistProfileModel: typeof TherapistProfile,
    @InjectModel(AdminProfile) private readonly adminProfileModel: typeof AdminProfile,
    private readonly rolesPermissions: RolesPermissionsService,
    private readonly audit: AuditService,
  ) {}

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
      patientProfile: user.patientProfile,
      therapistProfile: user.therapistProfile,
      adminProfile: user.adminProfile,
    };
  }

  async updatePatientProfile(userId: string, dto: UpdatePatientProfileDto) {
    const profile = await this.patientProfileModel.findByPk(userId);
    if (!profile)
      throw new NotFoundException({
        code: 'PATIENT_PROFILE_NOT_FOUND',
        message: 'Perfil paciente no encontrado.',
      });
    const before = profile.toJSON();
    return this.patientProfileModel.sequelize!.transaction(async (transaction) => {
      await profile.update(dto as any, { transaction });
      await this.audit.log(
        {
          actorUserId: userId,
          action: 'users.update_patient_profile',
          entityType: 'PatientProfile',
          entityId: userId,
          before,
          after: dto as any,
        },
        { transaction },
      );
      return profile;
    });
  }

  async updateTherapistProfile(userId: string, dto: UpdateTherapistProfileDto) {
    const profile = await this.therapistProfileModel.findByPk(userId);
    if (!profile)
      throw new NotFoundException({
        code: 'THERAPIST_PROFILE_NOT_FOUND',
        message: 'Perfil terapeuta no encontrado.',
      });
    const before = profile.toJSON();
    return this.therapistProfileModel.sequelize!.transaction(async (transaction) => {
      await profile.update(dto as any, { transaction });
      await this.audit.log(
        {
          actorUserId: userId,
          action: 'users.update_therapist_profile',
          entityType: 'TherapistProfile',
          entityId: userId,
          before,
          after: dto as any,
        },
        { transaction },
      );
      return profile;
    });
  }

  async list(query: PaginationQueryDto) {
    const where: any = {};
    const search = getEffectiveSearch(query);
    const normalizedStatus = normalizeFilter(getEffectiveStatusFilter(query), STATUS_ALIASES);
    const normalizedRole = normalizeFilter(getEffectiveRoleFilter(query), ROLE_ALIASES);

    if (normalizedStatus) {
      where.status = normalizedStatus;
    }

    if (search) {
      const term = `%${search}%`;
      where[Op.or] = [
        { email: { [Op.iLike]: term } },
        { '$roles.code$': { [Op.iLike]: term } },
        { '$roles.name$': { [Op.iLike]: term } },
        { '$patientProfile.firstName$': { [Op.iLike]: term } },
        { '$patientProfile.lastName$': { [Op.iLike]: term } },
        { '$therapistProfile.firstName$': { [Op.iLike]: term } },
        { '$therapistProfile.lastName$': { [Op.iLike]: term } },
        { '$therapistProfile.title$': { [Op.iLike]: term } },
        { '$therapistProfile.mainSpecialty$': { [Op.iLike]: term } },
        { '$adminProfile.firstName$': { [Op.iLike]: term } },
        { '$adminProfile.lastName$': { [Op.iLike]: term } },
      ];
    }

    const include: any[] = [
      {
        model: Role,
        attributes: ['id', 'code', 'name'],
        through: { attributes: [] },
        required: Boolean(normalizedRole),
        ...(normalizedRole ? { where: { code: normalizedRole } } : {}),
      },
      { model: PatientProfile, required: false },
      { model: TherapistProfile, required: false },
      { model: AdminProfile, required: false },
    ];

    const { rows, count } = await this.userModel.findAndCountAll({
      where,
      include,
      distinct: true,
      subQuery: false,
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
          lastLoginAt: 'lastLoginAt',
          last_login_at: 'lastLoginAt',
          emailVerifiedAt: 'emailVerifiedAt',
          email_verified_at: 'emailVerifiedAt',
        },
        'createdAt',
      ),
    });

    return {
      items: rows.map((u) => {
        const roleCodes = (u.roles ?? []).map((role) => role.code).filter(Boolean);
        const primaryRole = roleCodes[0] ?? null;
        return {
          id: u.id,
          email: u.email,
          name: displayNameFromProfiles(u),
          fullName: displayNameFromProfiles(u),
          status: u.status,
          role: primaryRole,
          rol: primaryRole ? ROLE_LABELS_ES[primaryRole] ?? primaryRole : null,
          roles: roleCodes,
          rolesDisplay: roleCodes.map((role) => ROLE_LABELS_ES[role] ?? role),
          patientProfile: u.patientProfile,
          therapistProfile: u.therapistProfile,
          adminProfile: u.adminProfile,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
        };
      }),
      pagination: buildPagination(query, count),
    };
  }
}
