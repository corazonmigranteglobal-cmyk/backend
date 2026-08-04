import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Transaction } from 'sequelize';
import { Permission, Role, RolePermission, UserRole } from '@/database/models';

@Injectable()
export class RolesPermissionsService {
  constructor(
    @InjectModel(Role) private readonly roleModel: typeof Role,
    @InjectModel(Permission) private readonly permissionModel: typeof Permission,
    @InjectModel(UserRole) private readonly userRoleModel: typeof UserRole,
    @InjectModel(RolePermission) private readonly rolePermissionModel: typeof RolePermission,
  ) {}

  async assignRoleByCode(userId: string, roleCode: string, transaction?: Transaction) {
    const role = await this.roleModel.findOne({ where: { code: roleCode }, transaction });
    if (!role)
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: `Rol ${roleCode} no existe.`,
      });
    await this.userRoleModel.findOrCreate({
      where: { userId, roleId: role.id },
      defaults: { userId, roleId: role.id } as any,
      transaction,
    });
  }

  async getUserRolesAndPermissions(userId: string) {
    const byUser = await this.getRolesAndPermissionsForUsers([userId]);
    return byUser.get(userId) ?? { roles: [], permissions: [] };
  }

  /**
   * Resuelve roles y permisos de varios usuarios con un número fijo de
   * consultas (4), independientemente de cuántos usuarios se pidan.
   *
   * Llamar a `getUserRolesAndPermissions` dentro de un bucle sobre un listado
   * paginado generaba 4 consultas por fila: 400 en una página de 100 usuarios.
   */
  async getRolesAndPermissionsForUsers(
    userIds: string[],
  ): Promise<Map<string, { roles: string[]; permissions: string[] }>> {
    const result = new Map<string, { roles: string[]; permissions: string[] }>();
    const uniqueUserIds = [...new Set(userIds)].filter(Boolean);
    if (!uniqueUserIds.length) return result;

    const userRoles = await this.userRoleModel.findAll({ where: { userId: uniqueUserIds } });
    const roleIds = [...new Set(userRoles.map((userRole) => userRole.roleId))];

    const [roles, rolePermissions] = await Promise.all([
      roleIds.length ? this.roleModel.findAll({ where: { id: roleIds } }) : [],
      roleIds.length ? this.rolePermissionModel.findAll({ where: { roleId: roleIds } }) : [],
    ]);

    const permissionIds = [...new Set(rolePermissions.map((link) => link.permissionId))];
    const permissions = permissionIds.length
      ? await this.permissionModel.findAll({ where: { id: permissionIds } })
      : [];

    const roleCodeById = new Map(roles.map((role) => [role.id, role.code]));
    const permissionCodeById = new Map(
      permissions.map((permission) => [permission.id, permission.code]),
    );
    const permissionCodesByRoleId = new Map<string, string[]>();
    for (const link of rolePermissions) {
      const code = permissionCodeById.get(link.permissionId);
      if (!code) continue;
      const bucket = permissionCodesByRoleId.get(link.roleId);
      if (bucket) bucket.push(code);
      else permissionCodesByRoleId.set(link.roleId, [code]);
    }

    for (const userId of uniqueUserIds) result.set(userId, { roles: [], permissions: [] });
    const permissionSetByUser = new Map<string, Set<string>>(
      uniqueUserIds.map((userId) => [userId, new Set<string>()]),
    );

    for (const userRole of userRoles) {
      const entry = result.get(userRole.userId);
      if (!entry) continue;
      const roleCode = roleCodeById.get(userRole.roleId);
      if (roleCode) entry.roles.push(roleCode);
      const permissionSet = permissionSetByUser.get(userRole.userId)!;
      for (const code of permissionCodesByRoleId.get(userRole.roleId) ?? []) {
        permissionSet.add(code);
      }
    }

    for (const [userId, permissionSet] of permissionSetByUser) {
      result.get(userId)!.permissions = [...permissionSet];
    }

    return result;
  }
}
