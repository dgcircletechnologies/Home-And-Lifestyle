import { Controller, Get, Module, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller('health')
class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async health() {
    if (!await this.prisma.isReady()) {
      throw new ServiceUnavailableException({ status: 'unavailable', database: 'down' });
    }
    return { status: 'ok', database: 'up' };
  }
}

@Module({ controllers: [HealthController], providers: [PrismaService], exports: [PrismaService] })
export class AppModule {}
