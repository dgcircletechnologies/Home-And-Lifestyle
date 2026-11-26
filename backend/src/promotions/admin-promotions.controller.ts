import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../auth/access';
import { parse } from '../auth/contracts';
import { AdminPromotionsService } from './admin-promotions.service';
const id = z.string().uuid();
const common = z.object({ name: z.string().trim().min(1).max(160), kind: z.enum(['FIXED', 'PERCENTAGE']), amountPaise: z.number().int().positive().max(100000000).nullable().optional(), percentBasisPoints: z.number().int().min(1).max(10000).nullable().optional(), startsAt: z.iso.datetime({ offset: true }).nullable().optional(), endsAt: z.iso.datetime({ offset: true }).nullable().optional() }).strict();
const automatic = common.extend({ type: z.literal('AUTOMATIC'), productId: id.nullable().optional(), categoryId: id.nullable().optional(), shareWithVerifiedCustomers: z.boolean().optional(), lifecycle: z.enum(['DRAFT', 'PUBLISHED', 'PAUSED', 'ENDED']).optional() }).strict();
const coupon = common.omit({ endsAt: true }).extend({ type: z.literal('COUPON'), code: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/), scope: z.enum(['CART', 'SELECTED']), productIds: z.array(id).max(100).optional(), categoryIds: z.array(id).max(100).optional(), collectionIds: z.array(id).max(100).optional(), minimumCartPaise: z.number().int().min(0).max(100000000).nullable().optional(), usageLimit: z.number().int().positive().nullable().optional(), perCustomerLimit: z.number().int().positive().nullable().optional(), allowStacking: z.boolean(), expiresAt: z.iso.datetime({ offset: true }).nullable().optional(), lifecycle: z.enum(['DRAFT', 'PUBLISHED', 'PAUSED', 'ENDED']).optional() }).strict();
const offer = z.discriminatedUnion('type', [automatic, coupon]);
const query = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20), search: z.string().trim().max(100).optional(), type: z.enum(['AUTOMATIC', 'COUPON']).optional(), status: z.enum(['DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'ENDED', 'EXPIRED', 'USAGE_LIMIT_REACHED']).optional() }).strict();
const quote = z.object({ items: z.array(z.object({ productId: id, variantId: id, quantity: z.number().int().min(1).max(100) }).strict()).min(1).max(50), code: z.string().trim().max(40).optional(), customerId: id.optional(), at: z.iso.datetime({ offset: true }).optional(), offer: offer.optional() }).strict();
@Roles('ADMIN') @Controller('admin/promotions')
export class AdminPromotionsController {
  constructor(private readonly service: AdminPromotionsService) {}
  @Get() list(@Query() value: unknown) { return this.service.list(parse(query, value)); }
  @Get('verified-customers-count') verifiedCustomersCount() { return this.service.verifiedCustomersCount(); }
  @Get('options') options(@Query() value: unknown) { return this.service.options(parse(z.object({ type: z.enum(['product', 'category', 'collection']), search: z.string().trim().max(100).optional(), page: z.coerce.number().int().min(1).default(1) }).strict(), value)); }
  @Post('quote') quote(@Body() value: unknown) { return this.service.quote(parse(quote, value)); }
  @Post(':id/share') share(@Param('id') value: string) { return this.service.share(parse(id, value)); }
  @Get(':type/:id') detail(@Param('type') type: string, @Param('id') value: string) { return this.service.detail(parse(z.enum(['automatic', 'coupon']), type), parse(id, value)); }
  @Post() create(@Body() value: unknown) { return this.service.create(parse(offer, value)); }
  @Patch(':type/:id') update(@Param('type') type: string, @Param('id') value: string, @Body() body: unknown) { return this.service.update(parse(z.enum(['automatic', 'coupon']), type), parse(id, value), parse(z.union([automatic.partial(), coupon.partial()]), body)); }
  @Patch(':type/:id/lifecycle') lifecycle(@Param('type') type: string, @Param('id') value: string, @Body() body: unknown) { return this.service.lifecycle(parse(z.enum(['automatic', 'coupon']), type), parse(id, value), parse(z.object({ action: z.enum(['publish', 'pause', 'resume', 'end']) }).strict(), body).action); }
}
