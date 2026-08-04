import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ContentAuthorDto,
  ContentCategoryDto,
  ContentPublicationDto,
  ContentTagDto,
} from './dto/content-response.dto';
import { ApiEnvelope } from '@/common/openapi/api-envelope.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { PaginationQueryDto } from '@/common/pagination/pagination.dto';
import { ContentAuthorsService } from './content-authors.service';
import { ContentPublicationsService } from './content-publications.service';
import { ContentTaxonomyService } from './content-taxonomy.service';
import { ContentSubscribersService } from './content-subscribers.service';
import { CreateContentAuthorDto, UpdateContentAuthorDto } from './dto/author.dto';
import { ContentPublicationQueryDto } from './dto/content-query.dto';
import {
  CreateContentPublicationDto,
  SchedulePublicationDto,
  UpdateContentPublicationDto,
} from './dto/publication.dto';
import {
  CreateContentCategoryDto,
  CreateContentTagDto,
  UpdateContentCategoryDto,
} from './dto/taxonomy.dto';
import { UpdateContentSubscriberDto, UpsertContentSubscriberDto } from './dto/subscriber.dto';

@ApiTags('Contenido')
@ApiBearerAuth()
@Controller('admin/content')
export class AdminContentController {
  constructor(
    private readonly authors: ContentAuthorsService,
    private readonly publications: ContentPublicationsService,
    private readonly taxonomy: ContentTaxonomyService,
    private readonly subscribers: ContentSubscribersService,
  ) {}

  @Get('publications')
  @ApiOperation({ summary: 'Listar publicaciones editoriales' })
  @Permissions('content:read')
  @ApiEnvelope(ContentPublicationDto, {
    paginated: true,
    description: 'Publicaciones editoriales en cualquier estado.',
  })
  listPublications(@Query() query: ContentPublicationQueryDto) {
    return this.publications.listAdmin(query);
  }

  @Post('publications')
  @ApiOperation({ summary: 'Crear una publicación editorial' })
  @Permissions('content:write')
  @ApiEnvelope(ContentPublicationDto, {
    status: 201,
    description: 'Publicacion creada en estado DRAFT.',
  })
  createPublication(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateContentPublicationDto,
  ) {
    return this.publications.create(user.sub, dto);
  }

  @Get('publications/:id')
  @ApiOperation({ summary: 'Consultar el detalle de una publicación' })
  @Permissions('content:read')
  @ApiEnvelope(ContentPublicationDto, { description: 'Detalle completo de la publicacion.' })
  getPublication(@Param('id') id: string) {
    return this.publications.getAdmin(id);
  }

  @Patch('publications/:id')
  @ApiOperation({ summary: 'Actualizar una publicación editorial' })
  @Permissions('content:write')
  @ApiEnvelope(ContentPublicationDto, { description: 'Publicacion actualizada.' })
  updatePublication(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateContentPublicationDto,
  ) {
    return this.publications.update(user.sub, id, dto);
  }

  @Post('publications/:id/publish')
  @ApiOperation({ summary: 'Publicar una publicación' })
  @Permissions('content:write')
  @ApiEnvelope(ContentPublicationDto, {
    status: 201,
    description:
      'Publicacion en estado PUBLISHED. Una transicion invalida devuelve error de dominio, no 500.',
  })
  publishPublication(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.publications.publish(user.sub, id);
  }

  @Post('publications/:id/schedule')
  @ApiOperation({ summary: 'Programar la publicación para una fecha futura' })
  @Permissions('content:write')
  @ApiEnvelope(ContentPublicationDto, {
    status: 201,
    description: 'Publicacion en estado SCHEDULED, con su fecha de publicacion futura.',
  })
  schedulePublication(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SchedulePublicationDto,
  ) {
    return this.publications.schedule(user.sub, id, dto);
  }

  @Post('publications/:id/archive')
  @ApiOperation({ summary: 'Archivar una publicación' })
  @Permissions('content:write')
  @ApiEnvelope(ContentPublicationDto, {
    status: 201,
    description: 'Publicacion archivada. Deja de aparecer en el sitio publico.',
  })
  archivePublication(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.publications.archive(user.sub, id);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Listar categorías de contenido' })
  @Permissions('content:read')
  @ApiEnvelope(ContentCategoryDto, { paginated: true, description: 'Categorias de contenido.' })
  listCategories() {
    return this.taxonomy.listCategories();
  }

  @Post('categories')
  @ApiOperation({ summary: 'Crear una categoría de contenido' })
  @Permissions('content:write')
  @ApiEnvelope(ContentCategoryDto, { status: 201, description: 'Categoria creada.' })
  createCategory(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateContentCategoryDto) {
    return this.taxonomy.createCategory(user.sub, dto);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Actualizar una categoría de contenido' })
  @Permissions('content:write')
  @ApiEnvelope(ContentCategoryDto, { description: 'Categoria actualizada.' })
  updateCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateContentCategoryDto,
  ) {
    return this.taxonomy.updateCategory(user.sub, id, dto);
  }

  @Get('tags')
  @ApiOperation({ summary: 'Listar etiquetas de contenido' })
  @Permissions('content:read')
  @ApiEnvelope(ContentTagDto, { paginated: true, description: 'Etiquetas de contenido.' })
  listTags() {
    return this.taxonomy.listTags();
  }

  @Post('tags')
  @ApiOperation({ summary: 'Crear una etiqueta de contenido' })
  @Permissions('content:write')
  @ApiEnvelope(ContentTagDto, { status: 201, description: 'Etiqueta creada.' })
  createTag(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateContentTagDto) {
    return this.taxonomy.createTag(user.sub, dto);
  }

  @Get('authors')
  @ApiOperation({ summary: 'Listar autores editoriales' })
  @Permissions('content:read')
  @ApiEnvelope(ContentAuthorDto, { paginated: true, description: 'Autores editoriales.' })
  listAuthors() {
    return this.authors.list();
  }

  @Post('authors')
  @ApiOperation({ summary: 'Registrar un autor editorial' })
  @Permissions('content:write')
  @ApiEnvelope(ContentAuthorDto, { status: 201, description: 'Autor registrado.' })
  createAuthor(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateContentAuthorDto) {
    return this.authors.create(user.sub, dto);
  }

  @Patch('authors/:id')
  @ApiOperation({ summary: 'Actualizar un autor editorial' })
  @Permissions('content:write')
  @ApiEnvelope(ContentAuthorDto, { description: 'Autor actualizado.' })
  updateAuthor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateContentAuthorDto,
  ) {
    return this.authors.update(user.sub, id, dto);
  }

  @Get('subscribers')
  @ApiOperation({ summary: 'Listar personas suscriptoras' })
  @Permissions('content:read')
  listSubscribers(@Query() query: PaginationQueryDto) {
    return this.subscribers.list(query);
  }

  @Post('subscribers')
  @ApiOperation({ summary: 'Registrar una persona suscriptora' })
  @Permissions('content:write')
  upsertSubscriber(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertContentSubscriberDto,
  ) {
    return this.subscribers.upsert(user.sub, dto);
  }

  @Patch('subscribers/:userId/subscription')
  @ApiOperation({ summary: 'Actualizar la suscripción premium de una cuenta' })
  @Permissions('content:write')
  updateSubscriberByUserId(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() dto: UpdateContentSubscriberDto,
  ) {
    return this.subscribers.updateByUserId(user.sub, userId, dto);
  }

  @Patch('subscribers/:id')
  @ApiOperation({ summary: 'Actualizar los datos de una persona suscriptora' })
  @Permissions('content:write')
  updateSubscriber(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateContentSubscriberDto,
  ) {
    return this.subscribers.update(user.sub, id, dto);
  }

  @Post('subscribers/:userId/approve')
  @ApiOperation({ summary: 'Aprobar una solicitud de suscripción premium' })
  @Permissions('content:write')
  approveSubscriberRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() dto: { premiumUntil?: string },
  ) {
    return this.subscribers.approveRequest(user.sub, userId, dto?.premiumUntil);
  }

  @Post('subscribers/:userId/reject')
  @ApiOperation({ summary: 'Rechazar una solicitud de suscripción premium' })
  @Permissions('content:write')
  rejectSubscriberRequest(@CurrentUser() user: AuthenticatedUser, @Param('userId') userId: string) {
    return this.subscribers.rejectRequest(user.sub, userId);
  }
}
