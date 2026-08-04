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
  // getRolesAndPermissionsForUsers()
  // -------------------------------------------------------------------------

  describe('getRolesAndPermissionsForUsers()', () => {
    it('resolves several users with a fixed number of queries', async () => {
      userRoleModel.findAll.mockResolvedValue([
        { userId: 'u1', roleId: 'r-admin' },
        { userId: 'u2', roleId: 'r-patient' },
        { userId: 'u3', roleId: 'r-admin' },
        { userId: 'u3', roleId: 'r-patient' },
      ]);
      roleModel.findAll.mockResolvedValue([
        makeRole('r-admin', 'ADMIN'),
        makeRole('r-patient', 'PATIENT'),
      ]);
      rolePermissionModel.findAll.mockResolvedValue([
        { roleId: 'r-admin', permissionId: 'p-read' },
        { roleId: 'r-admin', permissionId: 'p-write' },
        { roleId: 'r-patient', permissionId: 'p-read' },
      ]);
      permissionModel.findAll.mockResolvedValue([
        makePermission('p-read', 'users:read'),
        makePermission('p-write', 'users:write'),
      ]);

      const result = await service.getRolesAndPermissionsForUsers(['u1', 'u2', 'u3']);

      expect(result.get('u1')).toEqual({
        roles: ['ADMIN'],
        permissions: ['users:read', 'users:write'],
      });
      expect(result.get('u2')).toEqual({ roles: ['PATIENT'], permissions: ['users:read'] });
      expect(result.get('u3')?.roles.sort()).toEqual(['ADMIN', 'PATIENT']);
      // Permisos deduplicados aunque dos roles compartan el mismo permiso.
      expect(result.get('u3')?.permissions.sort()).toEqual(['users:read', 'users:write']);

      // El coste no depende del número de usuarios: una consulta por tabla.
      expect(userRoleModel.findAll).toHaveBeenCalledTimes(1);
      expect(roleModel.findAll).toHaveBeenCalledTimes(1);
      expect(rolePermissionModel.findAll).toHaveBeenCalledTimes(1);
      expect(permissionModel.findAll).toHaveBeenCalledTimes(1);
    });

    it('returns empty entries for users without roles and skips queries when given no ids', async () => {
      userRoleModel.findAll.mockResolvedValue([]);
      roleModel.findAll.mockResolvedValue([]);
      rolePermissionModel.findAll.mockResolvedValue([]);

      await expect(service.getRolesAndPermissionsForUsers([])).resolves.toEqual(new Map());
      expect(userRoleModel.findAll).not.toHaveBeenCalled();

      const result = await service.getRolesAndPermissionsForUsers(['ghost']);
      expect(result.get('ghost')).toEqual({ roles: [], permissions: [] });
    });
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
