import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  TherapistBlockedTimeDto,
  TherapistScheduleDto,
} from '@/common/openapi/catalog-response.dto';
import { ApiEnvelope } from '@/common/openapi/api-envelope.decorator';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { CreateBlockedTimeDto, CreateScheduleDto, UpdateScheduleDto } from './dto/scheduling.dto';
import { SchedulingService } from './scheduling.service';

@ApiTags('Agenda')
@ApiBearerAuth()
@Controller('therapists/me')
@Roles('THERAPIST')
export class SchedulingController {
  constructor(private readonly service: SchedulingService) {}

  @Get('schedules')
  @ApiOperation({ summary: 'Listar horarios del terapeuta autenticado' })
  @ApiResponse({ status: 200, description: 'Lista de bloques horarios.' })
  @ApiEnvelope(TherapistScheduleDto, {
    isArray: true,
    description: 'Horarios recurrentes de la terapeuta autenticada.',
  })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listSchedulesForTherapist(user.sub);
  }

  @Post('schedules')
  @ApiOperation({ summary: 'Crear bloque horario para el terapeuta autenticado' })
  @ApiResponse({ status: 201, description: 'Bloque horario creado.' })
  @ApiEnvelope(TherapistScheduleDto, { status: 201, description: 'Horario recurrente creado.' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateScheduleDto) {
    return this.service.createSchedule(user.sub, dto, user.sub);
  }

  @Patch('schedules/:scheduleId')
  @ApiOperation({ summary: 'Actualizar bloque horario propio' })
  @ApiResponse({ status: 200, description: 'Bloque actualizado.' })
  @ApiEnvelope(TherapistScheduleDto, {
    description:
      'Horario actualizado. Se crea una version nueva en vez de sobrescribir la anterior.',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.service.updateScheduleForTherapist(user.sub, scheduleId, dto, user.sub);
  }

  @Delete('schedules/:scheduleId')
  @ApiOperation({ summary: 'Desactivar bloque horario propio' })
  @ApiResponse({ status: 200, description: 'Bloque desactivado.' })
  @ApiEnvelope(
    {
      type: 'object',
      properties: { success: { type: 'boolean', example: true } },
      required: ['success'],
    },
    { description: 'Horario retirado.' },
  )
  remove(@CurrentUser() user: AuthenticatedUser, @Param('scheduleId') scheduleId: string) {
    return this.service.deactivateScheduleForTherapist(user.sub, scheduleId, user.sub);
  }

  @Post('blocked-times')
  @ApiOperation({ summary: 'Bloquear un rango de tiempo en la agenda propia' })
  @ApiResponse({ status: 201, description: 'Tiempo bloqueado.' })
  @ApiEnvelope(TherapistBlockedTimeDto, {
    status: 201,
    description: 'Bloqueo creado. Resta del horario recurrente al calcular huecos.',
  })
  block(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBlockedTimeDto) {
    return this.service.createBlockedTime(user.sub, dto);
  }
}

@ApiTags('Agenda')
@ApiBearerAuth()
@Controller('admin/therapists')
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminSchedulingController {
  constructor(private readonly service: SchedulingService) {}

  @Get(':therapistUserId/schedules')
  @ApiOperation({ summary: '[Admin] Listar horarios de un terapeuta' })
  @ApiResponse({ status: 200, description: 'Lista de bloques horarios.' })
  @ApiEnvelope(TherapistScheduleDto, {
    isArray: true,
    description: 'Horarios recurrentes de la terapeuta indicada.',
  })
  listTherapistSchedules(@Param('therapistUserId') therapistUserId: string) {
    return this.service.listSchedulesForTherapist(therapistUserId);
  }

  @Post(':therapistUserId/schedules')
  @ApiOperation({ summary: '[Admin] Crear bloque horario para un terapeuta' })
  @ApiResponse({ status: 201, description: 'Bloque creado.' })
  @ApiEnvelope(TherapistScheduleDto, {
    status: 201,
    description: 'Horario creado para la terapeuta indicada.',
  })
  createTherapistSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('therapistUserId') therapistUserId: string,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.service.createSchedule(therapistUserId, dto, user.sub);
  }

  @Patch(':therapistUserId/schedules/:scheduleId')
  @ApiOperation({ summary: '[Admin] Actualizar bloque horario de un terapeuta' })
  @ApiResponse({ status: 200, description: 'Bloque actualizado.' })
  @ApiEnvelope(TherapistScheduleDto, { description: 'Horario actualizado.' })
  updateTherapistSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('therapistUserId') therapistUserId: string,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.service.updateScheduleForTherapist(therapistUserId, scheduleId, dto, user.sub);
  }

  @Delete(':therapistUserId/schedules/:scheduleId')
  @ApiOperation({ summary: '[Admin] Desactivar bloque horario de un terapeuta' })
  @ApiResponse({ status: 200, description: 'Bloque desactivado.' })
  @ApiEnvelope(
    {
      type: 'object',
      properties: { success: { type: 'boolean', example: true } },
      required: ['success'],
    },
    { description: 'Horario retirado.' },
  )
  removeTherapistSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('therapistUserId') therapistUserId: string,
    @Param('scheduleId') scheduleId: string,
  ) {
    return this.service.deactivateScheduleForTherapist(therapistUserId, scheduleId, user.sub);
  }
}

@ApiTags('Agenda')
@Controller('booking')
@Public()
export class BookingController {
  constructor(private readonly service: SchedulingService) {}

  @Get('therapists')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Listar terapeutas disponibles (endpoint público)',
    description:
      'Directorio anónimo y paginado. No expone el email ni datos de contacto del terapeuta. Acepta page/pageSize (máx. 100), search y productId.',
  })
  @ApiResponse({ status: 200, description: 'Lista paginada de terapeutas.' })
  listPublicTherapists(@Query() query: Record<string, unknown>) {
    return this.service.listPublicTherapists(query);
  }

  @Get('availability')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Consultar disponibilidad horaria de un terapeuta (endpoint público)' })
  @ApiResponse({ status: 200, description: 'Slots disponibles para el rango de fechas.' })
  availability(@Req() request: { query?: Record<string, unknown> }) {
    return this.service.getAvailability(request.query ?? {});
  }
}
