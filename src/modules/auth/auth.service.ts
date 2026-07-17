import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import * as bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { sha256 } from '@/common/utils/hash.util';
import { PatientProfile, RefreshToken, TherapistProfile, User } from '@/database/models';
import { AuditService } from '../audit/audit.service';
import { MessagingService } from '../messaging/messaging.service';
import { RolesPermissionsService } from '../roles-permissions/roles-permissions.service';
import { AuthTokenService } from './auth-token.service';
import { LoginDto } from './dto/login.dto';
import { RegisterPatientDto } from './dto/register-patient.dto';
import { RegisterTherapistDto } from './dto/register-therapist.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(PatientProfile) private readonly patientProfileModel: typeof PatientProfile,
    @InjectModel(TherapistProfile)
    private readonly therapistProfileModel: typeof TherapistProfile,
    @InjectModel(RefreshToken) private readonly refreshTokenModel: typeof RefreshToken,
    private readonly rolesPermissions: RolesPermissionsService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly messaging: MessagingService,
    private readonly tokenService: AuthTokenService,
  ) {}

  async registerPatient(dto: RegisterPatientDto) {
    await this.assertEmailAvailable(dto.email);
    const passwordHash = await this.hashPassword(dto.password);
    const user = await this.userModel.sequelize!.transaction(async (transaction) => {
      const createdUser = await this.userModel.create(
        {
          email: dto.email,
          passwordHash,
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
        } as never,
        { transaction },
      );
      await this.patientProfileModel.create(
        {
          userId: createdUser.id,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          birthDate: dto.birthDate,
          country: dto.country,
          city: dto.city,
          occupation: dto.occupation,
        } as never,
        { transaction },
      );
      await this.rolesPermissions.assignRoleByCode(createdUser.id, 'PATIENT', transaction);
      await this.audit.log(
        {
          actorUserId: createdUser.id,
          action: 'auth.register_patient',
          entityType: 'User',
          entityId: createdUser.id,
          after: { email: createdUser.email },
        },
        { transaction },
      );
      await this.messaging.enqueue(
        {
          channel: 'EMAIL',
          recipient: createdUser.email,
          templateCode: 'WELCOME_PATIENT',
          payload: { email: createdUser.email },
        },
        { transaction },
      );
      return createdUser;
    });
    return this.publicUser(user);
  }

  async registerTherapist(dto: RegisterTherapistDto) {
    await this.assertEmailAvailable(dto.email);
    const passwordHash = await this.hashPassword(dto.password);
    const user = await this.userModel.sequelize!.transaction(async (transaction) => {
      const createdUser = await this.userModel.create(
        {
          email: dto.email,
          passwordHash,
          status: 'PENDING_APPROVAL',
          emailVerifiedAt: new Date(),
        } as never,
        { transaction },
      );
      await this.therapistProfileModel.create(
        {
          userId: createdUser.id,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          title: dto.title,
          mainSpecialty: dto.mainSpecialty,
          bio: dto.bio,
          personalPhrase: dto.personalPhrase,
          youtubeUrl: dto.youtubeUrl,
          licenseNumber: dto.licenseNumber,
          country: dto.country,
          city: dto.city,
          baseSessionPrice: dto.baseSessionPrice,
          approvalStatus: 'PENDING',
        } as never,
        { transaction },
      );
      await this.rolesPermissions.assignRoleByCode(createdUser.id, 'THERAPIST', transaction);
      await this.audit.log(
        {
          actorUserId: createdUser.id,
          action: 'auth.register_therapist',
          entityType: 'User',
          entityId: createdUser.id,
          after: { email: createdUser.email, status: createdUser.status },
        },
        { transaction },
      );
      return createdUser;
    });
    return this.publicUser(user);
  }

  async login(dto: LoginDto, metadata: { ipAddress?: string; userAgent?: string } = {}) {
    const user = await this.userModel.findOne({ where: { email: dto.email } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Credenciales inválidas.',
      });
    }
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException({
        code: 'AUTH_USER_DISABLED',
        message: 'Usuario no activo.',
      });
    }

    return this.userModel.sequelize!.transaction(async (transaction) => {
      user.lastLoginAt = new Date();
      await user.save({ transaction });
      return this.tokenService.issueTokenPair(user, metadata, transaction);
    });
  }

  async refresh(
    refreshToken: string,
    metadata: { ipAddress?: string; userAgent?: string } = {},
  ) {
    const tokenHash = sha256(refreshToken);
    return this.refreshTokenModel.sequelize!.transaction(async (transaction) => {
      const currentToken = await this.refreshTokenModel.findOne({
        where: { tokenHash, revokedAt: null, expiresAt: { [Op.gt]: new Date() } },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!currentToken) this.throwInvalidRefreshToken();

      const user = await this.userModel.findByPk(currentToken.userId, { transaction });
      if (!user || user.status !== 'ACTIVE') this.throwInvalidRefreshToken();

      const tokenPair = await this.tokenService.issueTokenPair(user, metadata, transaction);
      currentToken.revokedAt = new Date();
      currentToken.replacedByTokenId = tokenPair.refreshTokenId;
      await currentToken.save({ transaction });
      return tokenPair;
    });
  }

  async logout(refreshToken: string) {
    const tokenHash = sha256(refreshToken);
    await this.refreshTokenModel.update(
      { revokedAt: new Date() },
      { where: { tokenHash, revokedAt: null } },
    );
    return { success: true };
  }

  private hashPassword(password: string) {
    return bcrypt.hash(password, this.config.get<number>('security.bcryptRounds') ?? 12);
  }

  private async assertEmailAvailable(email: string) {
    if (await this.userModel.findOne({ where: { email } })) {
      throw new BadRequestException({
        code: 'AUTH_EMAIL_ALREADY_EXISTS',
        message: 'El email ya está registrado.',
      });
    }
  }

  private throwInvalidRefreshToken(): never {
    throw new UnauthorizedException({
      code: 'AUTH_INVALID_REFRESH_TOKEN',
      message: 'Refresh token inválido.',
    });
  }

  private publicUser(user: User) {
    return { id: user.id, email: user.email, status: user.status };
  }
}
