import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { Roles, type AuthRequest } from '../auth/access';
import { parse } from '../auth/contracts';
import { CustomerOrdersService } from './customer-orders.service';

const id = z.string().uuid();
const gift = z.object({ giftWrapSelected: z.boolean(), giftMessage: z.string().trim().max(250).nullable().default(null) }).strict();
const checkout = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('CART'), shippingAddressId: id, billingAddressId: id, couponCode: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/).optional(), giftOptions: z.array(gift.extend({ variantId: id })).max(100).optional() }).strict(),
  z.object({ mode: z.literal('DIRECT'), shippingAddressId: id, billingAddressId: id, variantId: id, quantity: z.number().int().min(1).max(1000000), giftWrapSelected: z.boolean().optional(), giftMessage: z.string().trim().max(250).nullable().optional() }).strict(),
]);

@Roles('CUSTOMER') @Controller('orders')
export class CustomerOrdersController {
  constructor(private readonly orders: CustomerOrdersService) {}
  @Post('checkout') checkout(@Req() req: AuthRequest, @Body() body: unknown) { return this.orders.checkout(req.user.id, parse(checkout, body)); }
  @Get() list(@Req() req: AuthRequest) { return this.orders.list(req.user.id); }
  @Get(':id') detail(@Req() req: AuthRequest, @Param('id') orderId: string) { return this.orders.detail(req.user.id, parse(id, orderId)); }
  @Post(':id/retry-payment') retry(@Req() req: AuthRequest, @Param('id') orderId: string) { return this.orders.retry(req.user.id, parse(id, orderId)); }
}
