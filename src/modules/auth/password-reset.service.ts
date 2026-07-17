import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { randomInt, timingSafeEqual } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { sha256 } from '@/common/utils/hash.util';
import { AuthPin, RefreshToken, User } from '@/database/models';
import { AuditService } from '../audit/audit.service';
import { MessagingService } from '../messaging/messaging.service';
import { ResetPasswordDto } from './dto/password-reset.dto';

function hashesMatch(leftHash: string, rightHash: string) {
  const leftBuffer = Buffer.from(leftHash, 'hex');
  const rightBuffer = Buffer.from(rightHash, 'hex');
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

@Injectable()
export class PasswordResetService {
  constructor(
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(AuthPin) private readonly authPinModel: typeof AuthPin,
    @InjectModel(RefreshToken) private readonly refreshTokenModel: typeof RefreshToken,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly messaging: MessagingService,
  ) {}

  async request(email: string) {
    const user = await this.userModel.findOne({ where: { email } });
    if (!user) return { success: true };

    const pin = String(randomInt(100_000, 1_000_000));
    const expiresAt = new Date(
      Date.now() +
        (this.config.get<number>('security.passwordResetExpiryMinutes') ?? 15) *
          60 *
          1_000,
    );

    await this.authPinModel.sequelize!.transaction(async (transaction) => {
      await this.authPinModel.update(
        { consumedAt: new Date() },
        {
          where: {
            email,
            purpose: 'PASSWORD_RESET',
            consumedAt: null,
          },
          transaction,
        },
      );
      await this.authPinModel.create(
        {
          email,
          pinHash: sha256(pin),
          purpose: 'PASSWORD_RESET',
          expiresAt,
          attempts: 0,
          metadata: {},
        } as never,
        { transaction },
      );
      await this.messaging.enqueue(
        {
          channel: 'EMAIL',
          recipient: email,
          templateCode: 'PASSWORD_RESET_PIN',
          payload: { pin },
        },
        { transaction },
      );
    });

    return { success: true };
  }

  async reset(dto: ResetPasswordDto) {
    const succeeded = await this.authPinModel.sequelize!.transaction(
      async (transaction) => {
        const pin = await this.authPinModel.findOne({
          where: {
            email: dto.email,
            purpose: 'PASSWORD_RESET',
            consumedAt: null,
            expiresAt: { [Op.gt]: new Date() },
          },
          order: [['createdAt', 'DESC']],
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!pin) return false;

        const maxAttempts =
          this.config.get<number>('security.passwordResetMaxAttempts') ?? 5;
        if (!hashesMatch(pin.pinHash, sha256(dto.pin))) {
          pin.attempts += 1;
          if (pin.attempts >= maxAttempts) pin.consumedAt = new Date();
          await pin.save({ transaction });
          return false;
        }

        const user = await this.userModel.findOne({
          where: { email: dto.email },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!user) {
          pin.consumedAt = new Date();
          await pin.save({ transaction });
          return false;
        }

        user.passwordHash = await bcrypt.hash(
          dto.newPassword,
          this.config.get<number>('security.bcryptRounds') ?? 12,
        );
        pin.consumedAt = new Date();
        await user.save({ transaction });
        await pin.save({ transaction });
        await this.refreshTokenModel.update(
          { revokedAt: new Date() },
          { where: { userId: user.id, revokedAt: null }, transaction },
        );
        await this.audit.log(
          {
            actorUserId: user.id,
            action: 'auth.password_reset',
            entityType: 'User',
            entityId: user.id,
          },
          { transaction },
        );
        return true;
      },
    );

    if (!succeeded) {
      throw new BadRequestException({
        code: 'AUTH_INVALID_PIN',
        message: 'PIN inválido o expirado.',
      });
    }
    return { success: true };
  }
}
