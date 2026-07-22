import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

jest.mock('bcryptjs');

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

const makeService = () => {
  const userModel = {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    sequelize: {
      transaction: jest.fn((cb: (tx: unknown) => unknown) => cb('tx')),
    },
  };
  const patientProfileModel = { create: jest.fn() };
  const therapistProfileModel = { create: jest.fn() };
  const refreshTokenModel = {
    findOne: jest.fn(),
    update: jest.fn(),
    sequelize: {
      transaction: jest.fn((cb: (tx: unknown) => unknown) => cb('tx')),
    },
  };
  const rolesPermissions = { assignRoleByCode: jest.fn() };
  const config = { get: jest.fn().mockReturnValue(1) }; // bcryptRounds=1 for speed in tests
  const audit = { log: jest.fn() };
  const messaging = { enqueue: jest.fn() };
  const tokenService = {
    issueTokenPair: jest.fn().mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      refreshTokenId: 'rt-id',
    }),
  };

  const service = new AuthService(
    userModel as any,
    patientProfileModel as any,
    therapistProfileModel as any,
    refreshTokenModel as any,
    rolesPermissions as any,
    config as any,
    audit as any,
    messaging as any,
    tokenService as any,
  );

  return {
    service,
    userModel,
    patientProfileModel,
    therapistProfileModel,
    refreshTokenModel,
    rolesPermissions,
    audit,
    messaging,
    tokenService,
  };
};

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedBcrypt.hash = jest.fn().mockResolvedValue('hashed-password') as any;
    mockedBcrypt.compare = jest.fn() as any;
  });

  // ─── registerPatient ───────────────────────────────────────────────────────

  describe('registerPatient', () => {
    it('creates user, patient profile, assigns role and enqueues welcome email', async () => {
      const { service, userModel, patientProfileModel, rolesPermissions, audit, messaging } =
        makeService();

      userModel.findOne.mockResolvedValue(null); // email available
      const createdUser = {
        id: 'user-1',
        email: 'patient@example.com',
        status: 'ACTIVE',
        save: jest.fn(),
      };
      userModel.create.mockResolvedValue(createdUser);
      patientProfileModel.create.mockResolvedValue({});

      const result = await service.registerPatient({
        email: 'patient@example.com',
        password: 'password123',
        firstName: 'Ana',
        lastName: 'García',
      } as any);

      expect(userModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'patient@example.com' }),
        { transaction: 'tx' },
      );
      expect(patientProfileModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Ana', lastName: 'García' }),
        { transaction: 'tx' },
      );
      expect(rolesPermissions.assignRoleByCode).toHaveBeenCalledWith('user-1', 'PATIENT', 'tx');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.register_patient' }),
        { transaction: 'tx' },
      );
      expect(messaging.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ templateCode: 'WELCOME_PATIENT' }),
        { transaction: 'tx' },
      );
      expect(result).toEqual({ id: 'user-1', email: 'patient@example.com', status: 'ACTIVE' });
    });

    it('throws AUTH_EMAIL_ALREADY_EXISTS when email is taken', async () => {
      const { service, userModel } = makeService();
      userModel.findOne.mockResolvedValue({ id: 'existing-user' });

      await expect(
        service.registerPatient({
          email: 'taken@example.com',
          password: 'pw',
          firstName: 'X',
          lastName: 'Y',
        } as any),
      ).rejects.toMatchObject({ response: { code: 'AUTH_EMAIL_ALREADY_EXISTS' } });
    });
  });

  // ─── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns token pair for valid credentials and ACTIVE user', async () => {
      const { service, userModel, tokenService } = makeService();

      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        passwordHash: 'hashed',
        status: 'ACTIVE',
        lastLoginAt: null,
        save: jest.fn(),
      };
      userModel.findOne.mockResolvedValue(mockUser);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({ email: 'user@example.com', password: 'correct' });

      expect(mockUser.save).toHaveBeenCalledWith({ transaction: 'tx' });
      expect(tokenService.issueTokenPair).toHaveBeenCalledWith(mockUser, {}, 'tx');
      expect(result).toEqual(
        expect.objectContaining({ accessToken: 'access-token', refreshToken: 'refresh-token' }),
      );
    });

    it('throws AUTH_INVALID_CREDENTIALS when password does not match', async () => {
      const { service, userModel } = makeService();
      userModel.findOne.mockResolvedValue({ passwordHash: 'wrong' });
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'user@example.com', password: 'bad' }),
      ).rejects.toMatchObject({ response: { code: 'AUTH_INVALID_CREDENTIALS' } });
    });

    it('throws AUTH_INVALID_CREDENTIALS when user does not exist', async () => {
      const { service, userModel } = makeService();
      userModel.findOne.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'pw' }),
      ).rejects.toMatchObject({ response: { code: 'AUTH_INVALID_CREDENTIALS' } });
    });

    it('throws AUTH_USER_DISABLED when user status is not ACTIVE', async () => {
      const { service, userModel } = makeService();
      userModel.findOne.mockResolvedValue({ passwordHash: 'hashed', status: 'BLOCKED' });
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.login({ email: 'blocked@example.com', password: 'pw' }),
      ).rejects.toMatchObject({ response: { code: 'AUTH_USER_DISABLED' } });
    });
  });

  // ─── logout ────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('revokes the refresh token and returns success: true', async () => {
      const { service, refreshTokenModel } = makeService();
      refreshTokenModel.update.mockResolvedValue([1]);

      const result = await service.logout('raw-refresh-token');

      expect(refreshTokenModel.update).toHaveBeenCalledWith(
        { revokedAt: expect.any(Date) },
        expect.objectContaining({ where: expect.objectContaining({ revokedAt: null }) }),
      );
      expect(result).toEqual({ success: true });
    });
  });
});
