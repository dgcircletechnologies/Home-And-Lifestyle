import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../auth/access';
import { parse } from '../auth/contracts';
import { AdminOverviewService } from './admin-overview.service';
import { period } from './period';
const query = z.object({ preset: z.enum(['today', 'yesterday', 'last7', 'last30', 'thisMonth', 'lastMonth', 'custom']).default('last30'), start: z.string().optional(), end: z.string().optional() }).strict();
@Roles('ADMIN') @Controller('admin/dashboard/overview')
export class AdminOverviewController {
  constructor(private readonly overview: AdminOverviewService) {}
  @Get() get(@Query() raw: unknown) { return this.overview.get(period(parse(query, raw))); }
}
