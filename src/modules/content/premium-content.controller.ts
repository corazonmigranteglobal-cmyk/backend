import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { ContentPublicationsService } from './content-publications.service';
import { ContentSubscribersService } from './content-subscribers.service';

@ApiTags('Contenido')
@ApiBearerAuth()
@Controller()
export class PremiumContentController {
  constructor(
    private readonly publications: ContentPublicationsService,
    private readonly subscribers: ContentSubscribersService,
  ) {}

  @Get('me/news-subscription')
  @ApiOperation({ summary: 'Consultar el estado de mi suscripción premium' })
  @Roles('PATIENT')
  getMySubscription(@CurrentUser() user: AuthenticatedUser) {
    return this.subscribers.getMine(user.sub);
  }

  @Get('me/news-subscription/payment-config')
  @ApiOperation({ summary: 'Obtener las instrucciones de pago de la suscripción premium' })
  @Roles('PATIENT')
  getPaymentConfig() {
    return {
      enabled: false,
      message:
        'La activación premium se gestiona desde administración hasta integrar pasarela de pago.',
    };
  }

  @Post('me/news-subscription/request')
  @ApiOperation({ summary: 'Solicitar el alta de la suscripción premium' })
  @Roles('PATIENT')
  requestSubscription(@CurrentUser() user: AuthenticatedUser) {
    return this.subscribers.requestMine(user.sub);
  }

  @Get('premium/publications/news/:slug')
  @ApiOperation({ summary: 'Leer una noticia premium por su slug' })
  @Roles('PATIENT')
  async getPremiumNews(@CurrentUser() user: AuthenticatedUser, @Param('slug') slug: string) {
    await this.subscribers.assertPremiumAccess(user.sub);
    return this.publications.getPremiumBySlug(slug, ['NEWS', 'REPORT', 'ANALYSIS', 'INTERVIEW']);
  }

  @Get('premium/publications/columns/:slug')
  @ApiOperation({ summary: 'Leer una columna premium por su slug' })
  @Roles('PATIENT')
  async getPremiumColumn(@CurrentUser() user: AuthenticatedUser, @Param('slug') slug: string) {
    await this.subscribers.assertPremiumAccess(user.sub);
    return this.publications.getPremiumBySlug(slug, ['COLUMN', 'OPINION']);
  }
}
