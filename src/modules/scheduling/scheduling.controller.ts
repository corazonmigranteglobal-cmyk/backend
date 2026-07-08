import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import {
  CreateBlockedTimeDto,
  CreateScheduleDto,
  UpdateScheduleDto,
} from './dto/scheduling.dto';
import { SchedulingService } from './scheduling.service';

@ApiTags('Scheduling')
@ApiBearerAuth()
@Controller('therapists/me')
@Roles('THERAPIST')
export class SchedulingController {
  constructor(private readonly service: SchedulingService) {}

  @Get('schedules')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listSchedulesForTherapist(user.sub);
  }

  @Post('schedules')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateScheduleDto) {
    return this.service.createSchedule(user.sub, dto, user.sub);
  }

  @Patch('schedules/:scheduleId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.service.updateScheduleForTherapist(user.sub, scheduleId, dto, user.sub);
  }

  @Delete('schedules/:scheduleId')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('scheduleId') scheduleId: string) {
    return this.service.deactivateScheduleForTherapist(user.sub, scheduleId, user.sub);
  }

  @Post('blocked-times')
  block(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBlockedTimeDto) {
    return this.service.createBlockedTime(user.sub, dto);
  }
}

@ApiTags('Admin scheduling')
@ApiBearerAuth()
@Controller('admin/therapists')
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminSchedulingController {
  constructor(private readonly service: SchedulingService) {}

  @Get(':therapistUserId/schedules')
  listTherapistSchedules(@Param('therapistUserId') therapistUserId: string) {
    return this.service.listSchedulesForTherapist(therapistUserId);
  }

  @Post(':therapistUserId/schedules')
  createTherapistSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('therapistUserId') therapistUserId: string,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.service.createSchedule(therapistUserId, dto, user.sub);
  }

  @Patch(':therapistUserId/schedules/:scheduleId')
  updateTherapistSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('therapistUserId') therapistUserId: string,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.service.updateScheduleForTherapist(therapistUserId, scheduleId, dto, user.sub);
  }

  @Delete(':therapistUserId/schedules/:scheduleId')
  removeTherapistSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('therapistUserId') therapistUserId: string,
    @Param('scheduleId') scheduleId: string,
  ) {
    return this.service.deactivateScheduleForTherapist(therapistUserId, scheduleId, user.sub);
  }
}

@ApiTags('Booking')
@Controller('booking')
@Public()
export class BookingController {
  constructor(private readonly service: SchedulingService) {}

  @Get('therapists')
  listPublicTherapists(@Query() query: Record<string, unknown>) {
    return this.service.listPublicTherapists(query);
  }

  @Get('availability')
  availability(@Req() request: { query?: Record<string, unknown> }) {
    // Usamos @Req() y no @Query() para evitar que el ValidationPipe global intente
    // validar query params públicos antes de que el servicio los normalice.
    // Si no hay horarios para esa fecha, el servicio debe devolver slots: [], no HTTP 400.
    return this.service.getAvailability(request.query ?? {});
  }
}
