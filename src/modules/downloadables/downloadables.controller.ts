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
import { Throttle } from '@nestjs/throttler';
import { Roles } from '@/common/decorators/roles.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { PaginationQueryDto } from '@/common/pagination/pagination.dto';
import { DownloadablesService } from './downloadables.service';
import {
  AttachPublicationDto,
  CreateDownloadableDto,
  CreateVersionDto,
  GrantEntitlementDto,
  HotmartConfigDto,
  HotmartNotificationDto,
  ReviewCommentDto,
  UpdateDownloadableDto,
} from './dto/downloadable.dto';

// Administracion
@ApiTags('Descargables')
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
    return this.service.adminList(
      Number(query.page ?? 1),
      Number(query.pageSize ?? 20),
      query.search,
    );
  }

  @Get('metrics')
  @ApiOperation({ summary: '[Admin] Metricas de descargables' })
  metrics() {
    return this.service.metrics();
  }

  @Get(':id')
  @ApiOperation({ summary: '[Admin] Detalle' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getByIdOrFail(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '[Admin] Actualizar (solo borrador)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDownloadableDto,
  ) {
    return this.service.update(id, dto, user.sub);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: '[Admin] Archivar' })
  archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.archive(id);
  }

  @Put(':id/hotmart')
  @ApiOperation({ summary: '[Admin] Configurar integracion Hotmart' })
  setHotmart(@Param('id', ParseUUIDPipe) id: string, @Body() dto: HotmartConfigDto) {
    return this.service.setHotmart(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '[Admin] Eliminar (soft delete)' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.remove(id);
    return { ok: true };
  }

  @Get(':id/versions')
  @ApiOperation({ summary: '[Admin] Listar versiones' })
  versions(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listVersions(id);
  }

  @Post(':id/versions')
  @ApiOperation({ summary: '[Admin] Crear nueva version editable' })
  createVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVersionDto,
  ) {
    return this.service.createVersion(id, dto.changeReason, user.sub);
  }

  @Post(':id/versions/:versionId/submit-review')
  @ApiOperation({ summary: '[Admin] Enviar version a revision' })
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return this.service.submitReview(id, versionId, user.sub);
  }

  @Post(':id/versions/:versionId/approve')
  @ApiOperation({ summary: '[Admin] Aprobar version' })
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return this.service.approveVersion(id, versionId, user.sub);
  }

  @Post(':id/versions/:versionId/reject')
  @ApiOperation({ summary: '[Admin] Rechazar version' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: ReviewCommentDto,
  ) {
    return this.service.rejectVersion(id, versionId, dto.comment, user.sub);
  }

  @Post(':id/versions/:versionId/request-changes')
  @ApiOperation({ summary: '[Admin] Solicitar cambios' })
  requestChanges(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: ReviewCommentDto,
  ) {
    return this.service.requestChanges(id, versionId, dto.comment, user.sub);
  }

  @Post(':id/versions/:versionId/publish')
  @ApiOperation({ summary: '[Admin] Publicar version (inmutable)' })
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return this.service.publishVersion(id, versionId, user.sub);
  }

  @Post(':id/versions/:versionId/restore')
  @ApiOperation({ summary: '[Admin] Restaurar version (crea nueva)' })
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return this.service.restoreVersion(id, versionId, user.sub);
  }

  @Post(':id/entitlements')
  @ApiOperation({ summary: '[Admin] Conceder acceso a un usuario' })
  grant(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GrantEntitlementDto,
  ) {
    return this.service.grantEntitlement({
      resourceId: id,
      userId: dto.userId,
      subjectEmail: dto.subjectEmail,
      source: 'ADMIN_GRANT',
      grantedBy: user.sub,
    });
  }

  @Delete(':id/entitlements/:userId')
  @ApiOperation({ summary: '[Admin] Revocar acceso' })
  revoke(@Param('id', ParseUUIDPipe) id: string, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.service.revokeEntitlement(id, userId);
  }
}

// Publicaciones
@ApiTags('Descargables')
@Controller()
export class PublicationDownloadablesController {
  constructor(private readonly service: DownloadablesService) {}

  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @Post('admin/publications/:publicationId/downloadables')
  @ApiOperation({ summary: '[Admin] Adjuntar descargable a publicacion' })
  attach(
    @CurrentUser() user: AuthenticatedUser,
    @Param('publicationId', ParseUUIDPipe) publicationId: string,
    @Body() dto: AttachPublicationDto,
  ) {
    return this.service.attachToPublication(publicationId, dto.resourceId, {
      label: dto.label,
      isPrimary: dto.isPrimary,
      sortOrder: dto.sortOrder,
      actorId: user.sub,
    });
  }

  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @Delete('admin/publications/:publicationId/downloadables/:resourceId')
  @ApiOperation({ summary: '[Admin] Quitar descargable de publicacion' })
  detach(
    @Param('publicationId', ParseUUIDPipe) publicationId: string,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
  ) {
    return this.service.detachFromPublication(publicationId, resourceId);
  }

  @Public()
  @Get('publications/:publicationId/downloadables')
  @ApiOperation({ summary: 'Descargables de una publicacion (con estado de acceso)' })
  listForPublication(
    @Param('publicationId', ParseUUIDPipe) publicationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.listForPublication(publicationId, user);
  }
}

// Usuario final
@ApiTags('Descargables')
@Controller('downloadables')
export class DownloadablesController {
  constructor(private readonly service: DownloadablesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Listar descargables publicados' })
  list(@Query() query: PaginationQueryDto) {
    return this.service.publicList(Number(query.page ?? 1), Number(query.pageSize ?? 20));
  }

  @Get('me/library')
  @ApiOperation({ summary: 'Mi contenido premium (con estado de acceso)' })
  myLibrary(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.service.myLibrary(user, Number(query.page ?? 1), Number(query.pageSize ?? 24));
  }

  @Get('me/history')
  @ApiOperation({ summary: 'Historial de descargas del usuario' })
  history(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.service.downloadHistory(
      user.sub,
      Number(query.page ?? 1),
      Number(query.pageSize ?? 20),
    );
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Detalle publico (sin URL privada)' })
  async detail(@Param('slug') slug: string) {
    const resource = await this.service.getPublicBySlugOrFail(slug);
    return this.service.toPublicCard(resource);
  }

  @Get(':id/access')
  @ApiOperation({ summary: 'Estado de acceso del usuario a un recurso' })
  async access(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    const resource = await this.service.getByIdOrFail(id);
    return this.service.evaluateAccess(resource, user);
  }

  @Post(':id/download')
  @ApiOperation({ summary: 'Descargar (autoriza en backend)' })
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const resource = await this.service.getByIdOrFail(id);
    return this.service.resolveDownload(resource, user, { ip, userAgent });
  }
}

// Webhook Hotmart
@ApiTags('Descargables')
@Controller('webhooks/hotmart')
export class DownloadablesWebhookController {
  constructor(private readonly service: DownloadablesService) {}

  @Public()
  @Post()
  // Endpoint anónimo que concede acceso pagado: se acota para que la firma no
  // pueda sondearse a volumen desde una sola IP.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Webhook de confirmacion de compra Hotmart (idempotente)' })
  handle(@Body() dto: HotmartNotificationDto, @Headers('x-hotmart-hottok') hottok: string) {
    return this.service.processHotmartNotification({
      eventId: dto.eventId,
      productId: dto.productId,
      buyerEmail: dto.buyerEmail,
      buyerUserId: dto.buyerUserId,
      status: dto.status,
      externalReference: dto.externalReference,
      rawSignature: hottok,
    });
  }
}
