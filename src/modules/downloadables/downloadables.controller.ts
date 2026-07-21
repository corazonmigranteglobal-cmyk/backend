import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '@/common/decorators/roles.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { PaginationQueryDto } from '@/common/pagination/pagination.dto';
import { DownloadablesService } from './downloadables.service';
import { CreateDownloadableDto, HotmartConfigDto, UpdateDownloadableDto } from './dto/downloadable.dto';

// ── Administración ────────────────────────────────────────────────
@ApiTags('Downloadables (admin)')
@ApiBearerAuth()
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/downloadables')
export class AdminDownloadablesController {
  constructor(private readonly service: DownloadablesService) {}

  @Post()
  @ApiOperation({ summary: '[Admin] Crear descargable (borrador)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDownloadableDto) {
    return this.service.create(dto, user.sub);
  }

  @Get()
  @ApiOperation({ summary: '[Admin] Listar descargables' })
  list(@Query() query: PaginationQueryDto) {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 20);
    return this.service.adminList(page, pageSize, query.search);
  }

  @Get('metrics')
  @ApiOperation({ summary: '[Admin] Métricas de descargables' })
  metrics() {
    return this.service.metrics();
  }

  @Get(':id')
  @ApiOperation({ summary: '[Admin] Detalle de descargable' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getByIdOrFail(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '[Admin] Actualizar descargable' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDownloadableDto,
  ) {
    return this.service.update(id, dto, user.sub);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: '[Admin] Publicar (nueva versión inmutable)' })
  publish(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.publish(id, user.sub);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: '[Admin] Archivar' })
  archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.archive(id);
  }

  @Put(':id/hotmart')
  @ApiOperation({ summary: '[Admin] Configurar integración Hotmart' })
  setHotmart(@Param('id', ParseUUIDPipe) id: string, @Body() dto: HotmartConfigDto) {
    return this.service.setHotmart(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '[Admin] Eliminar (soft delete)' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.remove(id);
    return { ok: true };
  }
}

// ── Usuario final ─────────────────────────────────────────────────
@ApiTags('Downloadables')
@Controller('downloadables')
export class DownloadablesController {
  constructor(private readonly service: DownloadablesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Listar descargables publicados' })
  list(@Query() query: PaginationQueryDto) {
    return this.service.publicList(Number(query.page ?? 1), Number(query.pageSize ?? 20));
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Detalle público de un descargable (sin URL privada)' })
  async detail(@Param('slug') slug: string) {
    const resource = await this.service.getBySlugOrFail(slug);
    return this.service.toPublicCard(resource);
  }

  @Get(':id/access')
  @ApiOperation({ summary: 'Estado de acceso del usuario a un recurso' })
  async access(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    const resource = await this.service.getByIdOrFail(id);
    return this.service.evaluateAccess(resource, user);
  }

  @Post(':id/download')
  @ApiOperation({ summary: 'Descargar un recurso (autoriza en backend)' })
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const resource = await this.service.getByIdOrFail(id);
    return this.service.resolveDownload(resource, user, { ip, userAgent });
  }

  @Get('me/history')
  @ApiOperation({ summary: 'Historial de descargas del usuario' })
  history(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.service.downloadHistory(user.sub, Number(query.page ?? 1), Number(query.pageSize ?? 20));
  }
}
