import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@/common/decorators/public.decorator';
import { ContentPublicationsService } from './content-publications.service';
import { ContentTaxonomyService } from './content-taxonomy.service';
import { ContentSubscribersService } from './content-subscribers.service';
import { PublicContentQueryDto } from './dto/content-query.dto';
import { UpsertContentSubscriberDto } from './dto/subscriber.dto';

@ApiTags('Contenido')
@Public()
@Controller('publications')
export class PublicContentController {
  constructor(
    private readonly publications: ContentPublicationsService,
    private readonly taxonomy: ContentTaxonomyService,
    private readonly subscribers: ContentSubscribersService,
  ) {}

  @Get('news')
  @ApiOperation({ summary: 'Listar noticias publicadas' })
  listNews(@Query() query: PublicContentQueryDto) {
    return this.publications.listPublic(query, ['NEWS', 'REPORT', 'ANALYSIS', 'INTERVIEW']);
  }

  @Get('columns')
  @ApiOperation({ summary: 'Listar columnas de opinión publicadas' })
  listColumns(@Query() query: PublicContentQueryDto) {
    return this.publications.listPublic(query, ['COLUMN', 'OPINION']);
  }

  @Get('news/:slug')
  @ApiOperation({ summary: 'Leer una noticia publicada por su slug' })
  getNews(@Param('slug') slug: string) {
    return this.publications.getPublicBySlug(slug);
  }

  @Get('columns/:slug')
  @ApiOperation({ summary: 'Leer una columna publicada por su slug' })
  getColumn(@Param('slug') slug: string) {
    return this.publications.getPublicBySlug(slug);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Listar las categorías con contenido publicado' })
  listCategories() {
    return this.taxonomy.listCategories(true);
  }

  @Get('tags')
  @ApiOperation({ summary: 'Listar las etiquetas con contenido publicado' })
  listTags() {
    return this.taxonomy.listTags();
  }

  @Post('subscribers')
  @ApiOperation({ summary: 'Suscribirse al boletín editorial' })
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  subscribe(@Body() dto: UpsertContentSubscriberDto) {
    return this.subscribers.upsert(undefined, { ...dto, source: dto.source ?? 'PUBLIC_FORM' });
  }
}

@ApiTags('Contenido')
@Public()
@Controller('public/content')
export class PublicContentAliasController {
  constructor(
    private readonly publications: ContentPublicationsService,
    private readonly taxonomy: ContentTaxonomyService,
  ) {}

  @Get('posts')
  @ApiOperation({ summary: 'Listar publicaciones (alias de compatibilidad del frontend)' })
  listPosts(@Query() query: PublicContentQueryDto) {
    return this.publications.listPublic(query);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Listar categorías (alias de compatibilidad del frontend)' })
  listContentCategories() {
    return this.taxonomy.listCategories(true);
  }

  @Get('types')
  @ApiOperation({ summary: 'Listar los tipos de publicación disponibles' })
  listContentTypes() {
    return {
      items: [
        { value: 'NEWS', label: 'Novedades' },
        { value: 'COLUMN', label: 'Columnas' },
        { value: 'OPINION', label: 'Opini\u00f3n' },
        { value: 'INTERVIEW', label: 'Entrevistas' },
        { value: 'REPORT', label: 'Reportes' },
        { value: 'ANALYSIS', label: 'An\u00e1lisis' },
      ],
    };
  }
}
