import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly service: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness / readiness check con estado real de dependencias' })
  check() {
    return this.service.check();
  }

  @Get('version')
  @ApiOperation({ summary: 'Version del servidor actualmente desplegado' })
  version() {
    return this.service.version();
  }
}
