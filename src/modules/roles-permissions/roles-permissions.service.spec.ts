import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import { Permission, Role, RolePermission, UserRole } from '@/database/models';
import { RolesPermissionsService } from './roles-permissions.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeRole = (id: string, code: string) => ({
  id,
  code,
  toJSON: () => ({ id, code }),
});

const makePermission = (id: string, code: string) => ({ id, code });

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('RolesPermissionsService', () => {
  let service: RolesPermissionsService;

  const roleModel = { findOne: jest.fn(), findAll: jest.fn() };
  const permissionModel = { findAll: jest.fn() };
  const userRoleModel = { findAll: jest.fn(), findOrCreate: jest.fn() };
  const rolePermissionModel = { findAll: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        RolesPermissionsService,
        { provide: getModelToken(Role), useValue: roleModel },
        { provide: getModelToken(Permission), useValue: permissionModel },
        { provide: getModelToken(UserRole), useValue: userRoleModel },
        { provide: getModelToken(RolePermission), useValue: rolePermissionModel },
      ],
    }).compile();

    service = module.get(RolesPermissionsService);
  });

  // -------------------------------------------------------------------------
  // assignRoleByCode()
  // -------------------------------------------------------------------------

  describe('assignRoleByCode()', () => {
    it('throws NotFoundException when role code does not exist', async () => {
      roleModel.findOne.mockResolvedValue(null);

      await expect(service.assignRoleByCode('user-1', 'GHOST')).rejects.toThrow(NotFoundException);
    });

    it('creates the user-role association when role exists', async () => {
      const role = makeRole('role-1', 'PATIENT');
      roleModel.findOne.mockResolvedValue(role);
      userRoleModel.findOrCreate.mockResolvedValue([{}, true]);

      await service.assignRoleByCode('user-1', 'PATIENT');

      expect(userRoleModel.findOrCreate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1', roleId: 'role-1' } }),
      );
    });

    it('does not duplicate when association already exists (findOrCreate returns existing)', async () => {
      const role = makeRole('role-1', 'PATIENT');
      roleModel.findOne.mockResolvedValue(role);
      // second return: created=false
      userRoleModel.findOrCreate.mockResolvedValue([{}, false]);

      await expect(service.assignRoleByCode('user-1', 'PATIENT')).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // getUserRolesAndPermissions()
  // -------------------------------------------------------------------------

  describe('getUserRolesAndPermissions()', () => {
    it('returns empty roles and permissions when user has no roles', async () => {
      userRoleModel.findAll.mockResolvedValue([]);
      roleModel.findAll.mockResolvedValue([]);
      rolePermissionModel.findAll.mockResolvedValue([]);

      const result = await service.getUserRolesAndPermissions('user-1');

      expect(result.roles).toEqual([]);
      expect(result.permissions).toEqual([]);
    });

    it('returns role codes for assigned roles', async () => {
      userRoleModel.findAll.mockResolvedValue([{ userId: 'user-1', roleId: 'role-1' }]);
      roleModel.findAll.mockResolvedValue([makeRole('role-1', 'THERAPIST')]);
      rolePermissionModel.findAll.mockResolvedValue([]);

      const result = await service.getUserRolesAndPermissions('user-1');

      expect(result.roles).toEqual(['THERAPIST']);
      expect(result.permissions).toEqual([]);
    });

    it('returns permission codes for all roles combined', async () => {
      userRoleModel.findAll.mockResolvedValue([
        { userId: 'user-1', roleId: 'role-1' },
        { userId: 'user-1', roleId: 'role-2' },
      ]);
      roleModel.findAll.mockResolvedValue([
        makeRole('role-1', 'PATIENT'),
        makeRole('role-2', 'ADMIN'),
      ]);
      rolePermissionModel.findAll.mockResolvedValue([
        { roleId: 'role-1', permissionId: 'perm-1' },
        { roleId: 'role-2', permissionId: 'perm-2' },
      ]);
      permissionModel.findAll.mockResolvedValue([
        makePermission('perm-1', 'appointments:read'),
        makePermission('perm-2', 'users:read'),
      ]);

      const result = await service.getUserRolesAndPermissions('user-1');

      expect(result.roles).toEqual(expect.arrayContaining(['PATIENT', 'ADMIN']));
      expect(result.permissions).toEqual(
        expect.arrayContaining(['appointments:read', 'users:read']),
      );
    });

    it('deduplicates permission IDs when multiple roles share the same permission', async () => {
      userRoleModel.findAll.mockResolvedValue([
        { userId: 'user-1', roleId: 'role-1' },
        { userId: 'user-1', roleId: 'role-2' },
      ]);
      roleModel.findAll.mockResolvedValue([
        makeRole('role-1', 'PATIENT'),
        makeRole('role-2', 'ADMIN'),
      ]);
      // Both roles share perm-1
      rolePermissionModel.findAll.mockResolvedValue([
        { roleId: 'role-1', permissionId: 'perm-1' },
        { roleId: 'role-2', permissionId: 'perm-1' },
      ]);
      permissionModel.findAll.mockResolvedValue([makePermission('perm-1', 'appointments:read')]);

      const result = await service.getUserRolesAndPermissions('user-1');

      // permissionModel should be queried with deduplicated IDs
      expect(permissionModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ['perm-1'] } }),
      );
      expect(result.permissions).toEqual(['appointments:read']);
    });
  });
});
