import { Controller, Get } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, Permissions } from './permissions.decorator';
import { IS_PUBLIC_KEY, Public } from './public.decorator';
import { ROLES_KEY, Roles } from './roles.decorator';

/**
 * Los guards globales (`JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`) leen
 * exactamente estas claves de metadatos. Si un decorador cambiara de clave, la
 * autorización dejaría de aplicarse en silencio: de ahí estas pruebas.
 */
@Controller('demo')
class DemoController {
  @Get('publico')
  @Public()
  publico() {
    return null;
  }

  @Get('admin')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @Permissions('messaging:write')
  admin() {
    return null;
  }

  @Get('sin-metadatos')
  simple() {
    return null;
  }
}

describe('decoradores de autorización', () => {
  const reflector = new Reflector();
  const controller = new DemoController();

  it('@Public marca el handler como accesible sin autenticación', () => {
    expect(reflector.get(IS_PUBLIC_KEY, controller.publico)).toBe(true);
  });

  it('@Roles registra la lista de roles permitidos', () => {
    expect(reflector.get(ROLES_KEY, controller.admin)).toEqual(['ADMIN', 'SUPER_ADMIN']);
  });

  it('@Permissions registra la lista de permisos exigidos', () => {
    expect(reflector.get(PERMISSIONS_KEY, controller.admin)).toEqual(['messaging:write']);
  });

  it('un handler sin decoradores no expone metadatos', () => {
    expect(reflector.get(IS_PUBLIC_KEY, controller.simple)).toBeUndefined();
    expect(reflector.get(ROLES_KEY, controller.simple)).toBeUndefined();
    expect(reflector.get(PERMISSIONS_KEY, controller.simple)).toBeUndefined();
  });

  it('@Roles y @Permissions admiten listas vacías sin romperse', () => {
    class Vacio {
      @Roles()
      @Permissions()
      handler() {
        return null;
      }
    }

    const vacio = new Vacio();
    expect(reflector.get(ROLES_KEY, vacio.handler)).toEqual([]);
    expect(reflector.get(PERMISSIONS_KEY, vacio.handler)).toEqual([]);
  });
});
