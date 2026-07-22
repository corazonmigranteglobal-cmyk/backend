import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Sse,
  MessageEvent,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Observable, map } from 'rxjs';
import { Roles } from '@/common/decorators/roles.decorator';
import { PaginationQueryDto } from '@/common/pagination/pagination.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Server-Sent Events stream for real-time admin notifications.
   * Client connects once and receives a push for every new event.
   */
  @Sse('stream')
  @ApiOperation({ summary: '[Admin] Stream SSE de notificaciones en tiempo real' })
  stream(): Observable<MessageEvent> {
    return this.notificationsService.stream$.pipe(
      map((event) => ({
        data: JSON.stringify(event),
        type: event.type,
        id: event.id,
      })),
    );
  }

  @Get()
  @ApiOperation({ summary: '[Admin] Listar notificaciones con paginación' })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Lista paginada de notificaciones.' })
  list(@Query() query: PaginationQueryDto, @Query('unreadOnly') unreadOnly?: string) {
    return this.notificationsService.list({
      ...query,
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: '[Admin] Cantidad de notificaciones no leídas' })
  @ApiResponse({ status: 200, description: 'Conteo de no leídas.' })
  unreadCount() {
    return this.notificationsService.unreadCount().then((count) => ({ unreadCount: count }));
  }

  @Patch(':id/read')
  @ApiOperation({ summary: '[Admin] Marcar notificación como leída' })
  @ApiResponse({ status: 200, description: 'Marcada como leída.' })
  markRead(@Param('id', ParseUUIDPipe) id: string) {
    return this.notificationsService.markRead(id).then(() => ({ ok: true }));
  }

  @Patch('read-all')
  @ApiOperation({ summary: '[Admin] Marcar todas las notificaciones como leídas' })
  @ApiResponse({ status: 200, description: 'Todas marcadas como leídas.' })
  markAllRead() {
    return this.notificationsService.markAllRead().then(() => ({ ok: true }));
  }
}
