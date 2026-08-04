import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OutboxMessageDto } from '@/common/openapi/catalog-response.dto';
import { ApiEnvelope } from '@/common/openapi/api-envelope.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { PaginationQueryDto } from '@/common/pagination/pagination.dto';
import { MessagingService } from './messaging.service';
import { SendTestEmailDto } from './dto/test-email.dto';

@ApiTags('Mensajería')
@ApiBearerAuth()
@Controller(['admin/messaging', 'admin/mensajeria'])
@Roles('ADMIN', 'SUPER_ADMIN')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('outbox')
  @ApiOperation({ summary: 'Listar los mensajes pendientes y procesados del outbox' })
  @Permissions('messaging:read')
  @ApiEnvelope(OutboxMessageDto, {
    paginated: true,
    description: 'Mensajes del outbox con su estado, intentos y ultimo error.',
  })
  list(@Query() query: PaginationQueryDto) {
    return this.messagingService.list(query);
  }

  @Post('outbox/process')
  @ApiOperation({ summary: 'Forzar el procesamiento del lote pendiente del outbox' })
  @Permissions('messaging:write')
  @ApiEnvelope(
    {
      type: 'object',
      properties: { processed: { type: 'integer', example: 12 } },
      required: ['processed'],
    },
    { status: 201, description: 'Numero de mensajes procesados en este lote.' },
  )
  process() {
    return this.messagingService.processPending();
  }

  @Post('outbox/:id/process')
  @ApiOperation({ summary: 'Forzar el reenvío de un mensaje concreto' })
  @Permissions('messaging:write')
  @ApiEnvelope(OutboxMessageDto, {
    status: 201,
    description: 'Mensaje tras el intento de reenvio, con su estado actualizado.',
  })
  processOne(@Param('id') id: string) {
    return this.messagingService.processOne(id);
  }

  @Post('test-email')
  @ApiOperation({ summary: 'Encolar un correo de prueba para validar el proveedor' })
  @Permissions('messaging:write')
  @ApiEnvelope(OutboxMessageDto, {
    status: 201,
    description: 'Mensaje de prueba encolado. Se envia cuando el worker tome el siguiente lote.',
  })
  enqueueTestEmail(@Body() dto: SendTestEmailDto) {
    return this.messagingService.enqueueTestEmail(dto);
  }
}
