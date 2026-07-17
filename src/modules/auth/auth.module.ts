import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuthPin, PatientProfile, RefreshToken, TherapistProfile, User } from '@/database/models';
import { AuditModule } from '../audit/audit.module';
import { MessagingModule } from '../messaging/messaging.module';
import { RolesPermissionsModule } from '../roles-permissions/roles-permissions.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthTokenService } from './auth-token.service';
import { PasswordResetService } from './password-reset.service';

@Module({
  imports: [
    JwtModule.register({}),
    SequelizeModule.forFeature([
      User,
      PatientProfile,
      TherapistProfile,
      RefreshToken,
      AuthPin,
    ]),
    RolesPermissionsModule,
    AuditModule,
    MessagingModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthTokenService, PasswordResetService],
  exports: [AuthService],
})
export class AuthModule {}
