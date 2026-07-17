import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthenticatedUser;
    }>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'AUTH_MISSING_TOKEN',
        message: 'Token requerido.',
      });
    }

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
        throw new Error('Invalid access-token claims.');
      }

      request.user = {
        sub: payload.sub,
        email: payload.email,
        roles: readStringArray(payload.roles),
        permissions: readStringArray(payload.permissions),
        status: payload.status,
      };
      return true;
    } catch {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_TOKEN',
        message: 'Token inválido o expirado.',
      });
    }
  }
}
