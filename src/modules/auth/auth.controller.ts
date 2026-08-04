import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  MethodNotAllowedException,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiEnvelope } from '@/common/openapi/api-envelope.decorator';
import { OperationSuccessDto, RegisteredUserDto, TokenPairDto } from './dto/auth-response.dto';
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
  @ApiOperation({ summary: 'Registrar un nuevo paciente' })
  @ApiResponse({
    status: 201,
    description: 'Paciente registrado. Devuelve id, email y status; no emite tokens.',
  })
  @ApiResponse({ status: 400, description: 'El email ya está registrado.' })
  @ApiEnvelope(RegisteredUserDto, {
    status: 201,
    description: 'Paciente registrado en estado ACTIVE. No se emiten tokens.',
  })
  registerPatient(@Body() dto: RegisterPatientDto) {
    return this.authService.registerPatient(dto);
  }

  @Post('register/therapist')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Registrar un nuevo terapeuta (requiere aprobación admin)' })
  @ApiResponse({
    status: 201,
    description:
      'Terapeuta registrado en estado PENDING_APPROVAL. No emite tokens hasta la aprobación.',
  })
  @ApiResponse({ status: 400, description: 'El email ya está registrado.' })
  @ApiEnvelope(RegisteredUserDto, {
    status: 201,
    description:
      'Terapeuta registrado en estado PENDING_APPROVAL. No puede operar hasta que se le apruebe.',
  })
  registerTherapist(@Body() dto: RegisterTherapistDto) {
    return this.authService.registerTherapist(dto);
  }

  @Get('login')
  @ApiOperation({ summary: 'Indicador: login requiere POST' })
  @ApiResponse({ status: 405, description: 'Método no permitido — usar POST /auth/login.' })
  loginMustBePosted() {
    throw new MethodNotAllowedException({
      code: 'AUTH_LOGIN_REQUIRES_POST',
      message: 'El inicio de sesión debe enviarse mediante POST.',
    });
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Iniciar sesión con email y contraseña' })
  @ApiResponse({ status: 201, description: 'Devuelve accessToken y refreshToken.' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas.' })
  @ApiEnvelope(TokenPairDto, {
    status: 201,
    description: 'Par de tokens y la identidad efectiva, con sus roles y permisos ya resueltos.',
  })
  login(@Body() dto: LoginDto, @Ip() ipAddress: string, @Headers('user-agent') userAgent?: string) {
    return this.authService.login(dto, { ipAddress, userAgent });
  }

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Renovar access token usando un refresh token válido' })
  @ApiResponse({
    status: 201,
    description: 'Devuelve nuevos accessToken y refreshToken (rotación).',
  })
  @ApiResponse({
    status: 401,
    description:
      'Refresh token inválido o expirado. Si el token ya había sido rotado se revocan todas las sesiones del usuario.',
  })
  @ApiEnvelope(TokenPairDto, {
    status: 201,
    description: 'Par de tokens nuevo. El token de refresco anterior queda invalidado.',
  })
  refresh(
    @Body() dto: RefreshTokenDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.refresh(dto.refreshToken, { ipAddress, userAgent });
  }

  @Post('logout')
  @ApiOperation({ summary: 'Cerrar sesión e invalidar el refresh token' })
  @ApiResponse({ status: 201, description: 'Sesión cerrada correctamente.' })
  @ApiEnvelope(OperationSuccessDto, {
    status: 201,
    description: 'Sesion cerrada: el token de refresco queda revocado.',
  })
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Post('password-reset/request')
  @Throttle({ default: { limit: 3, ttl: 900_000 } })
  @ApiOperation({ summary: 'Solicitar enlace de restablecimiento de contraseña por email' })
  @ApiResponse({
    status: 201,
    description: 'Email enviado si la dirección existe (respuesta genérica).',
  })
  @ApiEnvelope(OperationSuccessDto, {
    status: 201,
    description:
      'Respuesta identica exista o no la cuenta, para no revelar que direcciones estan registradas.',
  })
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.passwordResetService.request(dto.email);
  }

  @Post('password-reset/confirm')
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @ApiOperation({
    summary: 'Confirmar restablecimiento de contraseña con token recibido por email',
  })
  @ApiResponse({ status: 201, description: 'Contraseña actualizada.' })
  @ApiResponse({ status: 400, description: 'Token inválido o expirado.' })
  @ApiEnvelope(OperationSuccessDto, {
    status: 201,
    description: 'Contrasena actualizada. Las sesiones anteriores quedan revocadas.',
  })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.passwordResetService.reset(dto);
  }
}
