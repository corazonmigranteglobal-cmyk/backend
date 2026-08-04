import { ApiProperty } from '@nestjs/swagger';

/**
 * Formas de respuesta del módulo de autenticación.
 *
 * Se declaran para que el contrato publique el esquema real de `data` y no un
 * objeto abierto. Cada clase refleja lo que devuelve el servicio; si esa forma
 * cambia, hay que cambiarla aquí en el mismo commit.
 *
 * @see src/modules/auth/auth-token.service.ts — `issueTokenPair`
 * @see src/modules/auth/auth.service.ts — `publicUser`
 */
export class AuthenticatedUserDto {
  @ApiProperty({ format: 'uuid', example: '9a1c4e70-3b2f-4f6a-9a1e-2c8d5f0b7e13' })
  id!: string;

  @ApiProperty({ format: 'email', example: 'persona@example.com' })
  email!: string;

  @ApiProperty({
    type: [String],
    example: ['PATIENT'],
    description: 'Roles efectivos en el momento de emitir el token.',
  })
  roles!: string[];

  @ApiProperty({
    type: [String],
    example: ['appointments:read'],
    description:
      'Permisos efectivos, resueltos a partir de los roles. Son los que evalúa `PermissionsGuard`.',
  })
  permissions!: string[];

  @ApiProperty({
    example: 'ACTIVE',
    description:
      'Estado de la cuenta. Un terapeuta recién registrado está en `PENDING_APPROVAL` y no puede operar.',
  })
  status!: string;
}

export class TokenPairDto {
  @ApiProperty({
    description: 'Token de acceso JWT. Se envía en `Authorization: Bearer <token>`.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'Token de refresco, para obtener un par nuevo sin volver a pedir la contraseña.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'Identificador del token de refresco emitido. Sirve para revocarlo de forma selectiva.',
  })
  refreshTokenId!: string;

  @ApiProperty({
    example: 900,
    description: 'Vida útil del token de acceso, en segundos. Por defecto 15 minutos.',
  })
  expiresIn!: number;

  @ApiProperty({ type: AuthenticatedUserDto })
  user!: AuthenticatedUserDto;
}

/**
 * Respuesta del registro. **No emite tokens a propósito**: registrarse crea la
 * cuenta, iniciar sesión es un acto aparte.
 */
export class RegisteredUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'email', example: 'persona@example.com' })
  email!: string;

  @ApiProperty({
    example: 'ACTIVE',
    description:
      'Un paciente nace `ACTIVE`; un terapeuta nace `PENDING_APPROVAL` y no puede operar hasta que se le apruebe.',
  })
  status!: string;
}

/**
 * Confirmación genérica de una operación sin cuerpo propio.
 *
 * En el restablecimiento de contraseña, **se devuelve igual exista o no la
 * cuenta**: confirmar la existencia convertiría el endpoint en un verificador
 * de direcciones de correo.
 */
export class OperationSuccessDto {
  @ApiProperty({ example: true })
  success!: boolean;
}
