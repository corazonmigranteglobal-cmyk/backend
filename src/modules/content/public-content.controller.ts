import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@/common/decorators/public.decorator';
import { ContentPublicationsService } from './content-publications.service';
import { ContentTaxonomyService } from './content-taxonomy.service';
import { ContentSubscribersService } from './content-subscribers.service';
import { PublicContentQueryDto } from './dto/content-query.dto';
import { UpsertContentSubscriberDto } from './dto/subscriber.dto';

@ApiTags('Publicaciones p\u00fablicas')
@Public()
@Controller('publications')
export class PublicContentController {
  constructor(
    private readonly publications: ContentPublicationsService,
    private readonly taxonomy: ContentTaxonomyService,
    private readonly subscribers: ContentSubscribersService,
  ) {}

  @Get('news')
  listNews(@Query() query: PublicContentQueryDto) {
    return this.publications.listPublic(query, ['NEWS', 'REPORT', 'ANALYSIS', 'INTERVIEW']);
  }

  @Get('columns')
  listColumns(@Query() query: PublicContentQueryDto) {
    return this.publications.listPublic(query, ['COLUMN', 'OPINION']);
  }

  @Get('news/:slug')
  getNews(@Param('slug') slug: string) {
    return this.publications.getPublicBySlug(slug);
  }

  @Get('columns/:slug')
  getColumn(@Param('slug') slug: string) {
    return this.publications.getPublicBySlug(slug);
  }

  @Get('categories')
  listCategories() {
    return this.taxonomy.listCategories(true);
  }

  @Get('tags')
  listTags() {
    return this.taxonomy.listTags();
  }

  @Post('subscribers')
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  subscribe(@Body() dto: UpsertContentSubscriberDto) {
    return this.subscribers.upsert(undefined, { ...dto, source: dto.source ?? 'PUBLIC_FORM' });
  }
}

@ApiTags('Contenido p\u00fablico')
@Public()
@Controller('public/content')
export class PublicContentAliasController {
  constructor(
    private readonly publications: ContentPublicationsService,
    private readonly taxonomy: ContentTaxonomyService,
  ) {}

  @Get('posts')
  listPosts(@Query() query: PublicContentQueryDto) {
    return this.publications.listPublic(query);
  }

  @Get('categories')
  listContentCategories() {
    return this.taxonomy.listCategories(true);
  }

  @Get('types')
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
