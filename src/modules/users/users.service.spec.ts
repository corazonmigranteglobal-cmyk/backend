import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import { AdminProfile, FileAsset, PatientProfile, TherapistProfile, User } from '@/database/models';
import { AuditService } from '../audit/audit.service';
import { RolesPermissionsService } from '../roles-permissions/roles-permissions.service';
import { UsersService } from './users.service';

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-1',
  email: 'test@example.com',
  status: 'ACTIVE',
  createdAt: new Date(),
  patientProfile: null,
  therapistProfile: null,
  adminProfile: null,
  toJSON: function () {
    return { ...this };
  },
  update: jest.fn().mockResolvedValue(undefined),
  sequelize: {
    transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb({})),
  },
  ...overrides,
});

const makeProfile = (overrides: Record<string, unknown> = {}) => ({
  userId: 'user-1',
  toJSON: function () {
    return { ...this };
  },
  update: jest.fn().mockResolvedValue(undefined),
  sequelize: {
    transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb({})),
  },
  ...overrides,
});

describe('UsersService', () => {
  let service: UsersService;

  const userModel = {
    findByPk: jest.fn(),
    findAndCountAll: jest.fn(),
    sequelize: {
      transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb({})),
    },
  };
  const patientProfileModel = {
    findByPk: jest.fn(),
    sequelize: {
      transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb({})),
    },
  };
  const therapistProfileModel = {
    findByPk: jest.fn(),
    sequelize: {
      transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb({})),
    },
  };
  const adminProfileModel = { findByPk: jest.fn() };
  const fileModel = { findByPk: jest.fn() };
  const rolesPermissions = {
    getUserRolesAndPermissions: jest
      .fn()
      .mockResolvedValue({ roles: ['PATIENT'], permissions: [] }),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User), useValue: userModel },
        { provide: getModelToken(PatientProfile), useValue: patientProfileModel },
        { provide: getModelToken(TherapistProfile), useValue: therapistProfileModel },
        { provide: getModelToken(AdminProfile), useValue: adminProfileModel },
        { provide: getModelToken(FileAsset), useValue: fileModel },
        { provide: RolesPermissionsService, useValue: rolesPermissions },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  describe('me()', () => {
    it('returns user profile with roles when user exists', async () => {
      const user = makeUser();
      userModel.findByPk.mockResolvedValue(user);
      rolesPermissions.getUserRolesAndPermissions.mockResolvedValue({
        roles: ['PATIENT'],
        permissions: ['appointments:read'],
      });
      const result = await service.me('user-1');
      expect(result.id).toBe('user-1');
      expect(result.email).toBe('test@example.com');
      expect(result.roles).toEqual(['PATIENT']);
      expect(result.permissions).toEqual(['appointments:read']);
    });

    it('throws NotFoundException when user not found', async () => {
      userModel.findByPk.mockResolvedValue(null);
      await expect(service.me('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUserStatus()', () => {
    it('throws BadRequestException for invalid status', async () => {
      await expect(service.updateUserStatus('user-1', 'BOGUS', 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when user not found', async () => {
      userModel.findByPk.mockResolvedValue(null);
      await expect(service.updateUserStatus('missing', 'ACTIVE', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects Spanish aliases (only exact enum values accepted)', async () => {
      await expect(service.updateUserStatus('user-1', 'INACTIVO', 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('updates status and logs audit', async () => {
      const user = makeUser();
      userModel.findByPk.mockResolvedValue(user);
      userModel.sequelize.transaction.mockImplementation((cb: (t: unknown) => Promise<unknown>) =>
        cb({}),
      );
      const result = await service.updateUserStatus('user-1', 'BLOCKED', 'admin-1');
      expect(user.update).toHaveBeenCalledWith({ status: 'BLOCKED' }, expect.anything());
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'users.admin_update_status' }),
        expect.anything(),
      );
      expect(result).toMatchObject({ id: 'user-1' });
    });
  });

  describe('updatePatientProfile()', () => {
    it('throws NotFoundException when patient profile not found', async () => {
      patientProfileModel.findByPk.mockResolvedValue(null);
      await expect(
        service.updatePatientProfile('user-1', { firstName: 'Ana' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates profile and logs audit', async () => {
      const profile = makeProfile();
      patientProfileModel.findByPk.mockResolvedValue(profile);
      patientProfileModel.sequelize.transaction.mockImplementation(
        (cb: (t: unknown) => Promise<unknown>) => cb({}),
      );
      await service.updatePatientProfile('user-1', { firstName: 'Ana' } as any, 'user-1');
      expect(profile.update).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Ana' }),
        expect.anything(),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'users.update_patient_profile' }),
        expect.anything(),
      );
    });

    it('strips empty/null fields from DTO before update', async () => {
      const profile = makeProfile();
      patientProfileModel.findByPk.mockResolvedValue(profile);
      patientProfileModel.sequelize.transaction.mockImplementation(
        (cb: (t: unknown) => Promise<unknown>) => cb({}),
      );
      await service.updatePatientProfile(
        'user-1',
        { firstName: 'Ana', lastName: '', occupation: null } as any,
        'user-1',
      );
      const updateArg = (profile.update as jest.Mock).mock.calls[0][0];
      expect(updateArg).toHaveProperty('firstName', 'Ana');
      expect(updateArg).not.toHaveProperty('lastName');
      expect(updateArg).not.toHaveProperty('occupation');
    });
  });

  describe('updateUserAvatar()', () => {
    it('throws NotFoundException when file not found', async () => {
      fileModel.findByPk.mockResolvedValue(null);
      await expect(service.updateUserAvatar('user-1', 'file-1', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when file module is not USER_PROFILE', async () => {
      fileModel.findByPk.mockResolvedValue({ module: 'BLOG', entityId: 'user-1' });
      await expect(service.updateUserAvatar('user-1', 'file-1', 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when no profile found for user', async () => {
      fileModel.findByPk.mockResolvedValue({ module: 'USER_PROFILE', entityId: 'user-1' });
      therapistProfileModel.findByPk.mockResolvedValue(null);
      patientProfileModel.findByPk.mockResolvedValue(null);
      await expect(service.updateUserAvatar('user-1', 'file-1', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
