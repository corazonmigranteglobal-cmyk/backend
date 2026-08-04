import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UiEventDto } from '@/common/openapi/catalog-response.dto';
import { ApiEnvelope } from '@/common/openapi/api-envelope.decorator';
import { Throttle } from '@nestjs/throttler';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { PaginationQueryDto } from '@/common/pagination/pagination.dto';
import { AnalyticsService } from './analytics.service';
import { CreateUiEventDto } from './dto/ui-event.dto';
@ApiTags('Analítica')
@Controller('analytics')
@Public()
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}
  @Post('ui-events')
  @ApiOperation({ summary: 'Registrar un evento de interfaz del sitio público' })
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiEnvelope(UiEventDto, {
    status: 201,
    description:
      'Evento registrado. El endpoint es publico y esta limitado a 60 peticiones por minuto.',
  })
  track(@Body() dto: CreateUiEventDto) {
    return this.service.trackUiEvent(dto);
  }
}
@ApiTags('Analítica')
@ApiBearerAuth()
@Controller('admin/analytics')
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminAnalyticsController {
  constructor(private readonly service: AnalyticsService) {}
  @ApiOperation({ summary: 'Consultar los eventos de interfaz registrados' })
  @Get('ui-events')
  @Permissions('analytics:read')
  @ApiEnvelope(UiEventDto, {
    paginated: true,
    description: 'Eventos de interfaz registrados. No identifican a personas.',
  })
  list(@Query() q: PaginationQueryDto) {
    return this.service.listEvents(q);
  }
}
