import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  list(@Query() query: PaginationQueryDto) {
    return this.auditService.list(query);
  }
}
