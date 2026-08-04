import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { AdvertisingPlacementsService } from './advertising-placements.service';
import { AdvertisingPublicService } from './advertising-public.service';
import { PublicAdSlotsQueryDto } from './dto/advertising-query.dto';

@ApiTags('Publicidad')
@Public()
@Controller('advertising')
export class PublicAdvertisingController {
  constructor(
    private readonly publicAds: AdvertisingPublicService,
    private readonly placements: AdvertisingPlacementsService,
  ) {}

  @Get('slots')
  @ApiOperation({ summary: 'Resolver los anuncios que corresponden a cada emplazamiento' })
  getSlots(@Query() query: PublicAdSlotsQueryDto) {
    return this.publicAds.getSlots(query);
  }

  @Get('placements')
  @ApiOperation({ summary: 'Listar los emplazamientos publicitarios públicos' })
  listPlacements() {
    return this.placements.list(true);
  }
}

@ApiTags('Publicidad')
@Public()
@Controller('public/advertising')
export class PublicAdvertisingAliasController {
  constructor(private readonly publicAds: AdvertisingPublicService) {}

  @Get()
  @ApiOperation({ summary: 'Resolver anuncios por emplazamiento (alias de compatibilidad)' })
  getPublicAdvertising(@Query() query: PublicAdSlotsQueryDto) {
    return this.publicAds.getSlots(query);
  }
}
