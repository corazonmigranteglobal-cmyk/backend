import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
@ApiTags('Compatibilidad legacy')
@Controller('legacy')
@Public()
export class LegacyCompatibilityController {
  @Get('status')
  @ApiOperation({ summary: 'Comprobar la disponibilidad del backend desde clientes antiguos' })
  status() {
    return {
      enabled: true,
      message:
        'Módulo temporal: usar /api/v1 nuevos. Las rutas legacy deben mapearse una por una antes de retirarse.',
      deprecatedHeaders: ['Deprecation', 'Sunset'],
    };
  }
}
