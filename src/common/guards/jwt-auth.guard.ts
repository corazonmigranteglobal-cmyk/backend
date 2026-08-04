import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedUser } from '../types/authenticated-user';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthenticatedUser;
    }>();
    const authorization = request.headers.authorization;

    // Rutas públicas: la autenticación es opcional, pero si el cliente envía un
    // Bearer válido se resuelve igualmente. Sin esto, endpoints como
    // GET /files/:id/download o /publications/:id/downloadables nunca ven al
    // usuario y niegan el acceso a su propio dueño / a un suscriptor premium.
    if (isPublic) {
      const user = this.resolveUser(authorization);
      if (user) request.user = user;
      return true;
    }

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'AUTH_MISSING_TOKEN',
        message: 'Token requerido.',
      });
    }

    const user = this.resolveUser(authorization);
    if (!user) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_TOKEN',
        message: 'Token inválido o expirado.',
      });
    }

    request.user = user;
    return true;
  }

  /** Verifica el Bearer y devuelve el usuario, o `undefined` si no es utilizable. */
  private resolveUser(authorization?: string): AuthenticatedUser | undefined {
    if (!authorization?.startsWith('Bearer ')) return undefined;

    try {
      const payload = this.jwtService.verify<Record<string, unknown>>(
        authorization.slice('Bearer '.length),
        {
          secret: this.config.get<string>('jwt.accessSecret'),
          issuer: this.config.get<string>('jwt.issuer'),
          audience: this.config.get<string>('jwt.audience'),
        },
      );
      if (
        payload.tokenType !== 'access' ||
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string' ||
        payload.status !== 'ACTIVE'
      ) {
        return undefined;
      }

      return {
        sub: payload.sub,
        email: payload.email,
        roles: readStringArray(payload.roles),
        permissions: readStringArray(payload.permissions),
        status: payload.status,
      };
    } catch {
      return undefined;
    }
  }
}
