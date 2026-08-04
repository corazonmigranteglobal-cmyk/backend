import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { HomepageQueryDto, UpdateHomepageLayoutDto } from './dto/homepage.dto';
import { HomepageService } from './homepage.service';

@ApiTags('Portada')
@Public()
@Controller('homepage')
export class PublicHomepageController {
  constructor(private readonly homepage: HomepageService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener la composición de la portada pública' })
  getHomepage(@Query() query: HomepageQueryDto) {
    return this.homepage.getHomepage(query);
  }
}

@ApiTags('Portada')
@ApiBearerAuth()
@Controller('admin/homepage')
export class AdminHomepageController {
  constructor(private readonly homepage: HomepageService) {}

  @Get('preview')
  @ApiOperation({ summary: 'Previsualizar la portada con los cambios sin publicar' })
  @Permissions('homepage:read')
  getPreview(@CurrentUser() user: AuthenticatedUser, @Query() query: HomepageQueryDto) {
    return this.homepage.getAdminPreview(query, user);
  }

  @Patch('layout')
  @ApiOperation({ summary: 'Actualizar la composición de la portada' })
  @Permissions('homepage:write')
  updateLayout(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateHomepageLayoutDto) {
    return this.homepage.updateLayout(user.sub, dto);
  }
}
