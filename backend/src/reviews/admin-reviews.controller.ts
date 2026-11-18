import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { z } from 'zod';
import { Roles, type AuthRequest } from '../auth/access';
import { parse } from '../auth/contracts';
import { AdminReviewsService } from './admin-reviews.service';

const id = z.string().uuid();
const list = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20), search: z.string().trim().max(100).optional(), status: z.enum(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'SPAM', 'TRASH']).default('ALL'), productId: id.optional(), rating: z.coerce.number().int().min(1).max(5).optional(), replied: z.enum(['all', 'yes', 'no']).default('all'), sort: z.enum(['newest', 'oldest']).default('newest') }).strict();
const decision = z.object({ action: z.enum(['approve', 'unpublish', 'reject', 'spam', 'trash', 'restore']), expectedVersion: z.number().int().min(0), reason: z.string().trim().max(500).optional() }).strict();
const reply = z.object({ body: z.string().trim().min(1).max(3000), expectedVersion: z.number().int().min(0) }).strict();
const version = z.object({ expectedVersion: z.number().int().min(0) }).strict();

@Roles('ADMIN') @Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviews: AdminReviewsService) {}
  @Get() list(@Query() query: unknown) { return this.reviews.list(parse(list, query)); }
  @Get(':id') detail(@Param('id') value: string) { return this.reviews.detail(parse(id, value)); }
  @Patch(':id/status') status(@Param('id') value: string, @Body() body: unknown, @Req() req: AuthRequest) { return this.reviews.moderate(parse(id, value), req.user.id, parse(decision, body)); }
  @Post(':id/reply') reply(@Param('id') value: string, @Body() body: unknown, @Req() req: AuthRequest) { return this.reviews.reply(parse(id, value), req.user.id, parse(reply, body)); }
  @Delete(':id/reply') removeReply(@Param('id') value: string, @Body() body: unknown, @Req() req: AuthRequest) { return this.reviews.removeReply(parse(id, value), req.user.id, parse(version, body)); }
}
