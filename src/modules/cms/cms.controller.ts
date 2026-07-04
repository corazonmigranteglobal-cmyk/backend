import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { CmsService } from './cms.service';
import { CreateElementDto, CreatePageDto } from './dto/cms.dto';

@ApiTags('Public CMS')
@Controller('public/pages')
@Public()
export class CmsController {
  constructor(private readonly service: CmsService) {}

  @Get('by-id/:id')
  getById(@Param('id') id: string) {
    return this.service.getPublicPageById(id);
  }

  @Get(':slug/elements/:code')
  getElementByCode(@Param('slug') slug: string, @Param('code') code: string) {
    return this.service.getPublicElementByCode(slug, code);
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.service.getPublicPage(slug);
  }
}

@ApiTags('Public CMS')
@Controller('public/page-elements')
@Public()
export class PublicCmsElementsController {
  constructor(private readonly service: CmsService) {}

  @Get(':id')
  getElementById(@Param('id') id: string) {
    return this.service.getPublicElementById(id);
  }
}

@ApiTags('Public CMS')
@Controller('public-views')
@Public()
export class PublicViewsController {
  constructor(private readonly service: CmsService) {}

  @Get(':id/elements/:code')
  getElementByPageIdAndCode(@Param('id') id: string, @Param('code') code: string) {
    return this.service.getPublicElementByPageIdAndCode(id, code);
  }

  @Get(':id')
  getPageById(@Param('id') id: string) {
    return this.service.getPublicPageById(id);
  }
}

@ApiTags('Admin CMS')
@ApiBearerAuth()
@Controller('admin/cms/pages')
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminCmsController {
  constructor(private readonly service: CmsService) {}

  @Post()
  @Permissions('cms:write')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePageDto) {
    return this.service.createPage(user.sub, dto);
  }

  @Post(':pageId/elements')
  @Permissions('cms:write')
  addElement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pageId') pageId: string,
    @Body() dto: CreateElementDto,
  ) {
    return this.service.addElement(user.sub, pageId, dto);
  }
}
