import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { ContentPublicationsService } from './content-publications.service';
import { ContentSubscribersService } from './content-subscribers.service';

@ApiTags('Contenido premium')
@ApiBearerAuth()
@Controller()
export class PremiumContentController {
  constructor(
    private readonly publications: ContentPublicationsService,
    private readonly subscribers: ContentSubscribersService,
  ) {}

  @Get('me/news-subscription')
  @Roles('PATIENT')
  getMySubscription(@CurrentUser() user: AuthenticatedUser) {
    return this.subscribers.getMine(user.sub);
  }

  @Get('me/news-subscription/payment-config')
  @Roles('PATIENT')
  getPaymentConfig() {
    return {
      enabled: false,
      message: 'La activación premium se gestiona desde administración hasta integrar pasarela de pago.',
    };
  }

  @Post('me/news-subscription/request')
  @Roles('PATIENT')
  requestSubscription(@CurrentUser() user: AuthenticatedUser) {
    return this.subscribers.requestMine(user.sub);
  }


  @Get('premium/publications/news/:slug')
  @Roles('PATIENT')
  async getPremiumNews(@CurrentUser() user: AuthenticatedUser, @Param('slug') slug: string) {
    await this.subscribers.assertPremiumAccess(user.sub);
    return this.publications.getPremiumBySlug(slug, ['NEWS', 'REPORT', 'ANALYSIS', 'INTERVIEW']);
  }

  @Get('premium/publications/columns/:slug')
  @Roles('PATIENT')
  async getPremiumColumn(@CurrentUser() user: AuthenticatedUser, @Param('slug') slug: string) {
    await this.subscribers.assertPremiumAccess(user.sub);
    return this.publications.getPremiumBySlug(slug, ['COLUMN', 'OPINION']);
  }
}
