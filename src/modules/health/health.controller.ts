import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiEnvelope } from '@/common/openapi/api-envelope.decorator';
import { HealthStatusDto, VersionDto } from './dto/health-response.dto';
import { Public } from '@/common/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('Salud')
@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly service: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness / readiness check con estado real de dependencias' })
  @ApiEnvelope(HealthStatusDto, {
    description:
      'Estado del proceso y de sus dependencias. Devuelve 200 tambien cuando el estado es `degraded`: el servicio sigue atendiendo.',
  })
  check() {
    return this.service.check();
  }

  @Get('version')
  @ApiOperation({ summary: 'Version del servidor actualmente desplegado' })
  @ApiEnvelope(VersionDto, {
    description: 'Version, commit y fecha de construccion del despliegue en curso.',
  })
  version() {
    return this.service.version();
  }
}
