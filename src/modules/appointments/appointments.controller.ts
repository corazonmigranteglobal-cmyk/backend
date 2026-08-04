import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { PaginationQueryDto } from '@/common/pagination/pagination.dto';
import { AppointmentsService } from './appointments.service';
import {
  CreateAppointmentDto,
  CreateAppointmentForPatientDto,
  UpdateAppointmentAdminDto,
  UpdateAppointmentPaymentDto,
  UpdateAppointmentStatusDto,
} from './dto/appointment.dto';

@ApiTags('Citas')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Post()
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Crear cita (paciente autenticado)' })
  @ApiResponse({ status: 201, description: 'Cita creada.' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAppointmentDto) {
    return this.service.create(user, dto);
  }

  @Post('admin')
  @Roles('ADMIN', 'SUPER_ADMIN', 'THERAPIST')
  @Permissions('appointments:write')
  @ApiOperation({ summary: '[Admin/Terapeuta] Crear cita para un paciente' })
  @ApiResponse({ status: 201, description: 'Cita creada.' })
  createForPatient(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAppointmentForPatientDto,
  ) {
    return this.service.create(user, dto);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Listar citas del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Lista paginada de citas propias.' })
  listMine(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.service.listMine(user, query);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Actualizar estado de una cita' })
  @ApiResponse({ status: 200, description: 'Estado actualizado.' })
  @ApiResponse({ status: 403, description: 'Sin permiso para cambiar este estado.' })
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentStatusDto,
  ) {
    return this.service.updateStatus(user, id, dto);
  }

  @Get('/admin/list')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @Permissions('appointments:read')
  @ApiOperation({ summary: '[Admin] Listar todas las citas con paginación' })
  @ApiResponse({ status: 200, description: 'Lista paginada de citas.' })
  adminList(@Query() query: PaginationQueryDto) {
    return this.service.adminList(query);
  }

  @Patch('/admin/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @Permissions('appointments:write')
  @ApiOperation({ summary: '[Admin] Actualizar datos de una cita' })
  @ApiResponse({ status: 200, description: 'Cita actualizada.' })
  adminUpdate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentAdminDto,
  ) {
    return this.service.adminUpdate(user, id, dto);
  }

  @Patch('/admin/:id/payment')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @Permissions('appointments:write')
  @ApiOperation({ summary: '[Admin] Registrar o actualizar pago de una cita' })
  @ApiResponse({ status: 200, description: 'Pago registrado.' })
  updatePayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentPaymentDto,
  ) {
    return this.service.updatePayment(user, id, dto);
  }
}
