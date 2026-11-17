import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Public } from '../auth/access';
@Public() @Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}
  @Get('live') live() { return { status: 'ok' }; }
  @Get() health() { return this.ready(); }
  @Get('ready') async ready() {
    if (!await this.prisma.isReady()) throw new ServiceUnavailableException();
    return { status: 'ok', database: 'up' };
  }
}
