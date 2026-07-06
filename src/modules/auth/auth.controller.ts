import { Body, Controller, Headers, Ip, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@/common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterPatientDto } from './dto/register-patient.dto';
import { RegisterTherapistDto } from './dto/register-therapist.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestPasswordResetDto, ResetPasswordDto } from './dto/password-reset.dto';

@ApiTags('Auth')
@Controller('auth')
@Public()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register/patient')
  registerPatient(@Body() dto: RegisterPatientDto) {
    return this.authService.registerPatient(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register/therapist')
  registerTherapist(@Body() dto: RegisterTherapistDto) {
    return this.authService.registerTherapist(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto, @Ip() ipAddress: string, @Headers('user-agent') userAgent?: string) {
    return this.authService.login(dto, { ipAddress, userAgent });
  }

  @Post('refresh')
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

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password-reset/request')
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password-reset/confirm')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
