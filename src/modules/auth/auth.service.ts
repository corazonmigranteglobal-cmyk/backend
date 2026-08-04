import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { Span } from '@opentelemetry/api';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { Op, Transaction } from 'sequelize';
import { sha256 } from '@/common/utils/hash.util';
import { PatientProfile, RefreshToken, TherapistProfile, User } from '@/database/models';
import { APP_ATTR } from '@/observability/telemetry.constants';
import { TracingService } from '@/observability/tracing.service';
import { AuditService } from '../audit/audit.service';
import { MessagingService } from '../messaging/messaging.service';
import { RolesPermissionsService } from '../roles-permissions/roles-permissions.service';
import { AuthTokenService } from './auth-token.service';
import { LoginDto } from './dto/login.dto';
import { RegisterPatientDto } from './dto/register-patient.dto';
import { RegisterTherapistDto } from './dto/register-therapist.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private decoyPasswordHash?: Promise<string>;

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
    private readonly tracing: TracingService,
  ) {}

  async registerPatient(dto: RegisterPatientDto) {
    return this.tracing.runInSpan(
      'auth.register-patient',
      {
        [APP_ATTR.module]: 'auth',
        [APP_ATTR.operation]: 'register',
        [APP_ATTR.entityType]: 'patient',
      },
      (span) =>
        this.createPatientAccount(dto).then((user) => {
          span.setAttribute(APP_ATTR.entityId, user.id);
          return user;
        }),
    );
  }

  private async createPatientAccount(dto: RegisterPatientDto) {
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
    return this.tracing.runInSpan(
      'auth.register-therapist',
      {
        [APP_ATTR.module]: 'auth',
        [APP_ATTR.operation]: 'register',
        [APP_ATTR.entityType]: 'therapist',
      },
      (span) =>
        this.createTherapistAccount(dto).then((user) => {
          span.setAttribute(APP_ATTR.entityId, user.id);
          return user;
        }),
    );
  }

  private async createTherapistAccount(dto: RegisterTherapistDto) {
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

  /**
   * `auth.login` no registra el email ni la contraseña: sólo el resultado y, en
   * caso de éxito, el identificador interno del usuario.
   */
  async login(dto: LoginDto, metadata: { ipAddress?: string; userAgent?: string } = {}) {
    return this.tracing.runInSpan(
      'auth.login',
      { [APP_ATTR.module]: 'auth', [APP_ATTR.operation]: 'login' },
      (span) => this.performLogin(dto, metadata, span),
    );
  }

  private async performLogin(
    dto: LoginDto,
    metadata: { ipAddress?: string; userAgent?: string },
    span: Span,
  ) {
    const user = await this.userModel.findOne({ where: { email: dto.email } });
    // Se compara siempre contra un hash —el real o uno señuelo— para que el
    // tiempo de respuesta no revele si el email existe en la plataforma.
    const passwordMatches = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? (await this.getDecoyPasswordHash()),
    );
    if (!user || !passwordMatches) {
      span.setAttribute(APP_ATTR.result, 'invalid-credentials');
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Credenciales inválidas.',
      });
    }
    if (user.status !== 'ACTIVE') {
      span.setAttribute(APP_ATTR.result, 'user-disabled');
      throw new ForbiddenException({
        code: 'AUTH_USER_DISABLED',
        message: 'Usuario no activo.',
      });
    }

    span.setAttributes({
      [APP_ATTR.result]: 'granted',
      [APP_ATTR.entityType]: 'user',
      [APP_ATTR.entityId]: user.id,
    });

    return this.userModel.sequelize!.transaction(async (transaction) => {
      user.lastLoginAt = new Date();
      await user.save({ transaction });
      return this.tokenService.issueTokenPair(user, metadata, transaction);
    });
  }

  async refresh(refreshToken: string, metadata: { ipAddress?: string; userAgent?: string } = {}) {
    return this.tracing.runInSpan(
      'auth.refresh',
      { [APP_ATTR.module]: 'auth', [APP_ATTR.operation]: 'refresh' },
      () => this.rotateRefreshToken(refreshToken, metadata),
    );
  }

  private async rotateRefreshToken(
    refreshToken: string,
    metadata: { ipAddress?: string; userAgent?: string },
  ) {
    const tokenHash = sha256(refreshToken);
    return this.refreshTokenModel.sequelize!.transaction(async (transaction) => {
      const currentToken = await this.refreshTokenModel.findOne({
        where: { tokenHash, revokedAt: null, expiresAt: { [Op.gt]: new Date() } },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!currentToken) {
        await this.handlePossibleTokenReuse(tokenHash, transaction);
        this.throwInvalidRefreshToken();
      }

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
    return this.tracing.runInSpan(
      'auth.logout',
      { [APP_ATTR.module]: 'auth', [APP_ATTR.operation]: 'logout' },
      async () => {
        const tokenHash = sha256(refreshToken);
        await this.refreshTokenModel.update(
          { revokedAt: new Date() },
          { where: { tokenHash, revokedAt: null } },
        );
        return { success: true };
      },
    );
  }

  private hashPassword(password: string) {
    return bcrypt.hash(password, this.config.get<number>('security.bcryptRounds') ?? 12);
  }

  /**
   * Hash señuelo con el mismo coste que los reales, calculado una sola vez por
   * proceso. Se usa cuando el email no existe para que `bcrypt.compare` consuma
   * el mismo tiempo que un intento contra una cuenta real.
   */
  private getDecoyPasswordHash(): Promise<string> {
    this.decoyPasswordHash ??= bcrypt.hash(
      randomBytes(32).toString('hex'),
      this.config.get<number>('security.bcryptRounds') ?? 12,
    );
    return this.decoyPasswordHash;
  }

  private async assertEmailAvailable(email: string) {
    if (await this.userModel.findOne({ where: { email } })) {
      throw new BadRequestException({
        code: 'AUTH_EMAIL_ALREADY_EXISTS',
        message: 'El email ya está registrado.',
      });
    }
  }

  /**
   * Detección de reutilización de refresh tokens.
   *
   * Si el token presentado existe pero ya fue rotado o revocado, o bien el
   * cliente va con una copia obsoleta o bien alguien robó la sesión. Como no se
   * puede distinguir, se revoca la familia completa del usuario: el atacante
   * pierde el acceso y el titular sólo tiene que volver a iniciar sesión.
   */
  private async handlePossibleTokenReuse(tokenHash: string, transaction: Transaction) {
    const reusedToken = await this.refreshTokenModel.findOne({
      where: { tokenHash },
      transaction,
    });
    if (!reusedToken) return;

    const [revokedCount] = await this.refreshTokenModel.update(
      { revokedAt: new Date() },
      { where: { userId: reusedToken.userId, revokedAt: null }, transaction },
    );
    this.logger.warn(
      `Refresh token reutilizado para el usuario ${reusedToken.userId}: se revocaron ${revokedCount} sesiones activas.`,
    );
    await this.audit.log(
      {
        actorUserId: reusedToken.userId,
        action: 'auth.refresh_token_reuse_detected',
        entityType: 'RefreshToken',
        entityId: reusedToken.id,
        after: { revokedSessions: revokedCount },
      },
      { transaction },
    );
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
