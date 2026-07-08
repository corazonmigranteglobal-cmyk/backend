import { Body, Controller, Get, Headers, Ip, MethodNotAllowedException, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
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

  @Post('register/patient')
  registerPatient(@Body() dto: RegisterPatientDto) {
    return this.authService.registerPatient(dto);
  }

  @Post('register/therapist')
  registerTherapist(@Body() dto: RegisterTherapistDto) {
    return this.authService.registerTherapist(dto);
  }

  @Get('login')
  loginMustBePosted() {
    throw new MethodNotAllowedException({
      code: 'AUTH_LOGIN_REQUIRES_POST',
      message: 'El inicio de sesión debe enviarse con POST /api/v1/auth/login desde el formulario, no con GET.',
    });
  }

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

  @Post('password-reset/request')
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('password-reset/confirm')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
