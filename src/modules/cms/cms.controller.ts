import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { CmsService } from './cms.service';
import { AttachPublicationToPageDto, CreateElementDto, CreatePageDto, UpdatePageDto } from './dto/cms.dto';

@ApiTags('Public CMS')
@Controller('public/pages')
@Public()
export class CmsController {
  constructor(private readonly service: CmsService) {}

  @Get()
  listPublic() {
    return this.service.listPages('PUBLISHED');
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.service.getPublicPage(slug);
  }
}

@ApiTags('Admin CMS')
@ApiBearerAuth()
@Controller('admin/cms/pages')
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminCmsController {
  constructor(private readonly service: CmsService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.service.listPages(status);
  }

  @Get(':pageId')
  get(@Param('pageId') pageId: string) {
    return this.service.getAdminPage(pageId);
  }

  @Patch(':pageId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pageId') pageId: string,
    @Body() dto: UpdatePageDto,
  ) {
    return this.service.updatePage(user.sub, pageId, dto);
  }

  @Delete(':pageId')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('pageId') pageId: string) {
    return this.service.deletePage(user.sub, pageId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePageDto,
  ) {
    return this.service.createPage(user.sub, dto);
  }
  @Post(':pageId/elements')
  addElement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pageId') pageId: string,
    @Body() dto: CreateElementDto,
  ) {
    return this.service.addElement(user.sub, pageId, dto);
  }
}


@ApiTags('Páginas públicas admin')
@ApiBearerAuth()
@Controller('admin/public-pages')
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminPublicPagesController {
  constructor(private readonly service: CmsService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.service.listPages(status);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePageDto) {
    return this.service.createPage(user.sub, dto);
  }

  @Get(':pageId')
  get(@Param('pageId') pageId: string) {
    return this.service.getAdminPage(pageId);
  }

  @Patch(':pageId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pageId') pageId: string,
    @Body() dto: UpdatePageDto,
  ) {
    return this.service.updatePage(user.sub, pageId, dto);
  }

  @Delete(':pageId')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('pageId') pageId: string) {
    return this.service.deletePage(user.sub, pageId);
  }

  @Post(':pageId/posts')
  attachPublication(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pageId') pageId: string,
    @Body() dto: AttachPublicationToPageDto,
  ) {
    return this.service.attachPublication(user.sub, pageId, dto.publicationId);
  }

  @Delete(':pageId/posts/:postId')
  detachPublication(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pageId') pageId: string,
    @Param('postId') postId: string,
  ) {
    return this.service.detachPublication(user.sub, pageId, postId);
  }
}
