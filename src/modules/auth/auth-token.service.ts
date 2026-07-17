import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/sequelize';
import { randomUUID } from 'node:crypto';
import { Transaction } from 'sequelize';
import { randomOpaqueToken, sha256 } from '@/common/utils/hash.util';
import { RefreshToken, User } from '@/database/models';
import { RolesPermissionsService } from '../roles-permissions/roles-permissions.service';

function durationToSeconds(value: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(value);
  if (!match) return 900;

  const amount = Number(match[1]);
  const multiplier = {
    ms: 0.001,
    s: 1,
    m: 60,
    h: 3_600,
    d: 86_400,
  }[match[2]];
  return Math.max(1, Math.floor(amount * multiplier));
}

@Injectable()
export class AuthTokenService {
  constructor(
    @InjectModel(RefreshToken) private readonly refreshTokenModel: typeof RefreshToken,
    private readonly rolesPermissions: RolesPermissionsService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async issueTokenPair(
    user: User,
    metadata: { ipAddress?: string; userAgent?: string },
    transaction?: Transaction,
  ) {
    const { roles, permissions } = await this.rolesPermissions.getUserRolesAndPermissions(
      user.id,
    );
    const accessExpiresIn = this.config.get<string>('jwt.accessExpiresIn') ?? '15m';
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        roles,
        permissions,
        status: user.status,
        tokenType: 'access',
      },
      {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: accessExpiresIn as never,
        issuer: this.config.get<string>('jwt.issuer'),
        audience: this.config.get<string>('jwt.audience'),
        jwtid: randomUUID(),
      },
    );
    const refreshToken = randomOpaqueToken();
    const refreshTokenRecord = await this.refreshTokenModel.create(
      {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(
          Date.now() +
            (this.config.get<number>('jwt.refreshExpiresDays') ?? 30) *
              24 *
              60 *
              60 *
              1_000,
        ),
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
      } as never,
      { transaction },
    );

    return {
      accessToken,
      refreshToken,
      refreshTokenId: refreshTokenRecord.id,
      expiresIn: durationToSeconds(accessExpiresIn),
      user: {
        id: user.id,
        email: user.email,
        roles,
        permissions,
        status: user.status,
      },
    };
  }
}
