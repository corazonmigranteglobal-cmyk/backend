import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditLogDto } from '@/common/openapi/catalog-response.dto';
import { ApiEnvelope } from '@/common/openapi/api-envelope.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { PaginationQueryDto } from '@/common/pagination/pagination.dto';
import { AuditService } from './audit.service';

@ApiTags('Auditoría')
@ApiBearerAuth()
@Controller('admin/audit')
@Roles('ADMIN', 'SUPER_ADMIN')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @ApiOperation({ summary: 'Consultar el registro de auditoría' })
  @Permissions('audit:read')
  @ApiEnvelope(AuditLogDto, {
    paginated: true,
    description:
      'Entradas del registro de auditoria, de la mas reciente a la mas antigua. Los estados before/after llegan redactados.',
  })
  list(@Query() query: PaginationQueryDto) {
    return this.auditService.list(query);
  }
}
