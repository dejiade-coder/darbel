import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('live')
  live(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('ready')
  async ready(): Promise<{ status: string; db: string; timestamp: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'ok', timestamp: new Date().toISOString() };
    } catch {
      return { status: 'degraded', db: 'error', timestamp: new Date().toISOString() };
    }
  }
}
