import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { readEnvironment } from './environment';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ adapter: new PrismaPg({
      connectionString: readEnvironment().databaseUrl,
      connectionTimeoutMillis: 1500,
      query_timeout: 1500,
      statement_timeout: 1500,
      max: 5,
    }) });
  }

  async onModuleInit() {
    try { await this.$connect(); }
    catch { new Logger('Database').warn('Database unavailable; readiness will remain unhealthy until it recovers.'); }
  }

  async isReady(): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.$queryRaw`SELECT 1 FROM "Session" LEFT JOIN "RefreshCredential" ON FALSE LEFT JOIN "EmailVerification" ON FALSE LIMIT 1`.then(() => true),
        new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), 2500); }),
      ]);
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  async onModuleDestroy() { await this.$disconnect(); }
}
