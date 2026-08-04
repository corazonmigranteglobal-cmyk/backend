import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AccountDto,
  AccountGroupDto,
  AccountingTransactionDto,
  CostCenterDto,
} from '@/common/openapi/domain-response.dto';
import { ApiEnvelope } from '@/common/openapi/api-envelope.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { PaginationQueryDto } from '@/common/pagination/pagination.dto';
import { AccountingService } from './accounting.service';
import {
  CreateAccountDto,
  CreateAccountGroupDto,
  CreateCostCenterDto,
  CreateSaleFromAppointmentDto,
  CreateTransactionDto,
} from './dto/accounting.dto';
@ApiTags('Contabilidad')
@ApiBearerAuth()
@Controller('admin/accounting')
@Roles('ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN')
export class AccountingController {
  constructor(private readonly service: AccountingService) {}
  @ApiOperation({ summary: 'Listar grupos de cuentas contables' })
  @Get('account-groups')
  @Permissions('accounting:read')
  @ApiEnvelope(AccountGroupDto, { paginated: true, description: 'Grupos del plan de cuentas.' })
  listGroups(@Query() q: PaginationQueryDto) {
    return this.service.listGroups(q);
  }
  @ApiOperation({ summary: 'Crear un grupo de cuentas contables' })
  @Post('account-groups')
  @Permissions('accounting:write')
  @ApiEnvelope(AccountGroupDto, { status: 201, description: 'Grupo creado.' })
  createGroup(@CurrentUser() u: AuthenticatedUser, @Body() dto: CreateAccountGroupDto) {
    return this.service.createGroup(u.sub, dto);
  }
  @ApiOperation({ summary: 'Listar cuentas del plan contable' })
  @Get('accounts')
  @Permissions('accounting:read')
  @ApiEnvelope(AccountDto, { paginated: true, description: 'Cuentas del plan contable.' })
  listAccounts(@Query() q: PaginationQueryDto) {
    return this.service.listAccounts(q);
  }
  @ApiOperation({ summary: 'Crear una cuenta en el plan contable' })
  @Post('accounts')
  @Permissions('accounting:write')
  @ApiEnvelope(AccountDto, { status: 201, description: 'Cuenta creada.' })
  createAccount(@CurrentUser() u: AuthenticatedUser, @Body() dto: CreateAccountDto) {
    return this.service.createAccount(u.sub, dto);
  }
  @ApiOperation({ summary: 'Listar centros de coste' })
  @Get('cost-centers')
  @Permissions('accounting:read')
  @ApiEnvelope(CostCenterDto, { paginated: true, description: 'Centros de coste.' })
  listCostCenters(@Query() q: PaginationQueryDto) {
    return this.service.listCostCenters(q);
  }
  @ApiOperation({ summary: 'Crear un centro de coste' })
  @Post('cost-centers')
  @Permissions('accounting:write')
  @ApiEnvelope(CostCenterDto, { status: 201, description: 'Centro de coste creado.' })
  createCostCenter(@CurrentUser() u: AuthenticatedUser, @Body() dto: CreateCostCenterDto) {
    return this.service.createCostCenter(u.sub, dto);
  }
  @ApiOperation({ summary: 'Listar transacciones contables' })
  @Get('transactions')
  @Permissions('accounting:read')
  @ApiEnvelope(AccountingTransactionDto, {
    paginated: true,
    description: 'Transacciones contables.',
  })
  listTransactions(@Query() q: PaginationQueryDto) {
    return this.service.listTransactions(q);
  }
  @ApiOperation({ summary: 'Registrar una transacción contable con sus asientos' })
  @Post('transactions')
  @Permissions('accounting:write')
  @ApiEnvelope(AccountingTransactionDto, {
    status: 201,
    description:
      'Transaccion registrada con sus asientos. Una transaccion descuadrada no se persiste.',
  })
  createTransaction(@CurrentUser() u: AuthenticatedUser, @Body() dto: CreateTransactionDto) {
    return this.service.createTransaction(u.sub, dto);
  }
  @Post('transactions/from-appointment/:appointmentId')
  @ApiOperation({ summary: 'Generar el asiento contable de una cita atendida' })
  @Permissions('accounting:write')
  @ApiEnvelope(AccountingTransactionDto, {
    status: 201,
    description:
      'Asiento generado desde la cita atendida. Facturar una cita no prestada seria un error contable, por eso la operacion es explicita y posterior.',
  })
  createSaleFromAppointment(
    @CurrentUser() u: AuthenticatedUser,
    @Param('appointmentId') appointmentId: string,
    @Body() dto: CreateSaleFromAppointmentDto,
  ) {
    return this.service.createSaleFromAppointment(u.sub, appointmentId, dto);
  }
}
