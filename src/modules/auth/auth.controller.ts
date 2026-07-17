import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  MethodNotAllowedException,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@/common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RequestPasswordResetDto, ResetPasswordDto } from './dto/password-reset.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterPatientDto } from './dto/register-patient.dto';
import { RegisterTherapistDto } from './dto/register-therapist.dto';
import { PasswordResetService } from './password-reset.service';

@ApiTags('Auth')
@Controller('auth')
@Public()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @Post('register/patient')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  registerPatient(@Body() dto: RegisterPatientDto) {
    return this.authService.registerPatient(dto);
  }

  @Post('register/therapist')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  registerTherapist(@Body() dto: RegisterTherapistDto) {
    return this.authService.registerTherapist(dto);
  }

  @Get('login')
  loginMustBePosted() {
    throw new MethodNotAllowedException({
      code: 'AUTH_LOGIN_REQUIRES_POST',
      message: 'El inicio de sesión debe enviarse mediante POST.',
    });
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(
    @Body() dto: LoginDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.login(dto, { ipAddress, userAgent });
  }

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  refresh(
    @Body() dto: RefreshTokenDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.refresh(dto.refreshToken, { ipAddress, userAgent });
  }

  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Post('password-reset/request')
  @Throttle({ default: { limit: 3, ttl: 900_000 } })
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.passwordResetService.request(dto.email);
  }

  @Post('password-reset/confirm')
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.passwordResetService.reset(dto);
  }
}
