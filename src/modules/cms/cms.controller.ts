import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CmsElementDto, CmsPageDto } from '@/common/openapi/domain-response.dto';
import { ApiEnvelope } from '@/common/openapi/api-envelope.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { CmsService } from './cms.service';
import {
  AttachPublicationToPageDto,
  CreateElementDto,
  CreatePageDto,
  UpdatePageDto,
} from './dto/cms.dto';

@ApiTags('CMS')
@Controller('public/pages')
@Public()
export class CmsController {
  constructor(private readonly service: CmsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar las páginas publicadas del sitio' })
  @ApiEnvelope(CmsPageDto, {
    paginated: true,
    description: 'Paginas publicadas del sitio. El listado publico solo devuelve las publicadas.',
  })
  listPublic() {
    return this.service.listPages('PUBLISHED');
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Obtener una página publicada por su slug' })
  @ApiEnvelope(CmsPageDto, { description: 'Pagina publicada, con sus elementos ordenados.' })
  get(@Param('slug') slug: string) {
    return this.service.getPublicPage(slug);
  }
}

@ApiTags('CMS')
@ApiBearerAuth()
@Controller('admin/cms/pages')
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminCmsController {
  constructor(private readonly service: CmsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas las páginas del CMS' })
  @ApiEnvelope(CmsPageDto, {
    paginated: true,
    description: 'Todas las paginas del CMS, en cualquier estado.',
  })
  list(@Query('status') status?: string) {
    return this.service.listPages(status);
  }

  @Get(':pageId')
  @ApiOperation({ summary: 'Consultar una página del CMS con sus elementos' })
  @ApiEnvelope(CmsPageDto, { description: 'Pagina con sus elementos.' })
  get(@Param('pageId') pageId: string) {
    return this.service.getAdminPage(pageId);
  }

  @Patch(':pageId')
  @ApiOperation({ summary: 'Actualizar una página del CMS' })
  @ApiEnvelope(CmsPageDto, { description: 'Pagina actualizada.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pageId') pageId: string,
    @Body() dto: UpdatePageDto,
  ) {
    return this.service.updatePage(user.sub, pageId, dto);
  }

  @Delete(':pageId')
  @ApiOperation({ summary: 'Eliminar una página del CMS' })
  @ApiEnvelope(
    {
      type: 'object',
      properties: { success: { type: 'boolean', example: true } },
      required: ['success'],
    },
    { description: 'Pagina eliminada.' },
  )
  remove(@CurrentUser() user: AuthenticatedUser, @Param('pageId') pageId: string) {
    return this.service.deletePage(user.sub, pageId);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una página del CMS' })
  @ApiEnvelope(CmsPageDto, { status: 201, description: 'Pagina creada.' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePageDto) {
    return this.service.createPage(user.sub, dto);
  }
  @Post(':pageId/elements')
  @ApiOperation({ summary: 'Añadir un elemento a una página del CMS' })
  @ApiEnvelope(CmsElementDto, { status: 201, description: 'Elemento anadido a la pagina.' })
  addElement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pageId') pageId: string,
    @Body() dto: CreateElementDto,
  ) {
    return this.service.addElement(user.sub, pageId, dto);
  }
}

@ApiTags('CMS')
@ApiBearerAuth()
@Controller('admin/public-pages')
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminPublicPagesController {
  constructor(private readonly service: CmsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar las páginas públicas administrables' })
  @ApiEnvelope(CmsPageDto, { paginated: true, description: 'Paginas publicas administrables.' })
  list(@Query('status') status?: string) {
    return this.service.listPages(status);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una página pública' })
  @ApiEnvelope(CmsPageDto, { status: 201, description: 'Pagina publica creada.' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePageDto) {
    return this.service.createPage(user.sub, dto);
  }

  @Get(':pageId')
  @ApiOperation({ summary: 'Consultar una página pública y sus entradas' })
  @ApiEnvelope(CmsPageDto, { description: 'Pagina publica con sus entradas.' })
  get(@Param('pageId') pageId: string) {
    return this.service.getAdminPage(pageId);
  }

  @Patch(':pageId')
  @ApiOperation({ summary: 'Actualizar una página pública' })
  @ApiEnvelope(CmsPageDto, { description: 'Pagina publica actualizada.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pageId') pageId: string,
    @Body() dto: UpdatePageDto,
  ) {
    return this.service.updatePage(user.sub, pageId, dto);
  }

  @Delete(':pageId')
  @ApiOperation({ summary: 'Eliminar una página pública' })
  @ApiEnvelope(
    {
      type: 'object',
      properties: { success: { type: 'boolean', example: true } },
      required: ['success'],
    },
    { description: 'Pagina publica eliminada.' },
  )
  remove(@CurrentUser() user: AuthenticatedUser, @Param('pageId') pageId: string) {
    return this.service.deletePage(user.sub, pageId);
  }

  @Post(':pageId/posts')
  @ApiOperation({ summary: 'Añadir una entrada a una página pública' })
  attachPublication(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pageId') pageId: string,
    @Body() dto: AttachPublicationToPageDto,
  ) {
    return this.service.attachPublication(user.sub, pageId, dto.publicationId);
  }

  @Delete(':pageId/posts/:postId')
  @ApiOperation({ summary: 'Eliminar una entrada de una página pública' })
  detachPublication(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pageId') pageId: string,
    @Param('postId') postId: string,
  ) {
    return this.service.detachPublication(user.sub, pageId, postId);
  }
}
