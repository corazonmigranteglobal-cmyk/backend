import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiEnvelope } from '@/common/openapi/api-envelope.decorator';
import { TherapyApproachDto, TherapyProductDto } from './dto/therapy-response.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { PaginationQueryDto } from '@/common/pagination/pagination.dto';
import { TherapyCatalogService } from './therapy-catalog.service';
import {
  CreateApproachDto,
  CreateProductDto,
  UpdateApproachDto,
  UpdateProductDto,
} from './dto/therapy.dto';

@ApiTags('Catálogo terapéutico')
@Controller('therapy')
@Public()
export class TherapyCatalogController {
  constructor(private readonly service: TherapyCatalogService) {}
  @ApiOperation({ summary: 'Listar los enfoques terapéuticos publicados' })
  @Get('approaches')
  @ApiEnvelope(TherapyApproachDto, {
    paginated: true,
    description: 'Enfoques terapeuticos publicados. El catalogo publico solo devuelve los ACTIVE.',
  })
  listApproaches(@Query() query: PaginationQueryDto) {
    return this.service.listPublicApproaches(query);
  }
  @ApiOperation({ summary: 'Listar los productos terapéuticos publicados' })
  @Get('products')
  @ApiEnvelope(TherapyProductDto, {
    paginated: true,
    description: 'Productos terapeuticos publicados. El catalogo publico solo devuelve los ACTIVE.',
  })
  listProducts(@Query() query: PaginationQueryDto) {
    return this.service.listProducts(query, true);
  }
}

@ApiTags('Catálogo terapéutico')
@ApiBearerAuth()
@Controller('admin/therapy')
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminTherapyCatalogController {
  constructor(private readonly service: TherapyCatalogService) {}
  @ApiOperation({ summary: 'Listar todos los enfoques terapéuticos' })
  @Get('approaches')
  @Permissions('therapy:read')
  @ApiEnvelope(TherapyApproachDto, {
    paginated: true,
    description: 'Todos los enfoques, en cualquier estado.',
  })
  listApproaches(@Query() query: PaginationQueryDto) {
    return this.service.listApproaches(query);
  }
  @ApiOperation({ summary: 'Crear un enfoque terapéutico' })
  @Post('approaches')
  @Permissions('therapy:write')
  @ApiEnvelope(TherapyApproachDto, { status: 201, description: 'Enfoque creado.' })
  createApproach(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateApproachDto) {
    return this.service.createApproach(user.sub, dto);
  }
  @ApiOperation({ summary: 'Actualizar un enfoque terapéutico' })
  @Patch('approaches/:id')
  @Permissions('therapy:write')
  @ApiEnvelope(TherapyApproachDto, { description: 'Enfoque actualizado.' })
  updateApproach(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateApproachDto,
  ) {
    return this.service.updateApproach(user.sub, id, dto);
  }
  @ApiOperation({ summary: 'Listar todos los productos terapéuticos' })
  @Get('products')
  @Permissions('therapy:read')
  @ApiEnvelope(TherapyProductDto, {
    paginated: true,
    description: 'Todos los productos, en cualquier estado.',
  })
  listProducts(@Query() query: PaginationQueryDto) {
    return this.service.listProducts(query);
  }
  @ApiOperation({ summary: 'Crear un producto terapéutico' })
  @Post('products')
  @Permissions('therapy:write')
  @ApiEnvelope(TherapyProductDto, { status: 201, description: 'Producto creado.' })
  createProduct(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProductDto) {
    return this.service.createProduct(user.sub, dto);
  }
  @ApiOperation({ summary: 'Actualizar un producto terapéutico' })
  @Patch('products/:id')
  @Permissions('therapy:write')
  @ApiEnvelope(TherapyProductDto, { description: 'Producto actualizado.' })
  updateProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.service.updateProduct(user.sub, id, dto);
  }
  @ApiOperation({ summary: 'Eliminar un producto terapéutico' })
  @Delete('products/:id')
  @Permissions('therapy:write')
  @ApiEnvelope(
    {
      type: 'object',
      properties: { success: { type: 'boolean', example: true } },
      required: ['success'],
    },
    { description: 'Producto eliminado. El borrado es logico: la fila conserva deletedAt.' },
  )
  deleteProduct(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.deleteProduct(user.sub, id);
  }
}
