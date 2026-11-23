import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { z } from 'zod';
import { Public, Roles, type AuthRequest } from '../auth/access';
import { parse } from '../auth/contracts';
import { CartService } from './cart.service';

const id = z.string().uuid();
const item = z.object({ variantId: id, quantity: z.number().int().min(1).max(1000000) }).strict();
const couponCode = z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/).optional();
const summaryQuery = z.object({ couponCode }).strict();
const preview = z.object({ items: z.array(item).max(100), couponCode }).strict();

@Public() @Controller('cart/preview')
export class CartPreviewController {
  constructor(private readonly cart: CartService) {}
  @Post() calculate(@Body() body: unknown) { const input = parse(preview, body); return this.cart.preview(input.items, input.couponCode); }
}

@Roles('CUSTOMER') @Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}
  @Get() get(@Req() req: AuthRequest, @Query() query: unknown) { return this.cart.get(req.user.id, parse(summaryQuery, query).couponCode); }
  @Post('items') add(@Req() req: AuthRequest, @Body() body: unknown) { return this.cart.add(req.user.id, parse(item, body)); }
  @Patch('items/:itemId') update(@Req() req: AuthRequest, @Param('itemId') itemId: string, @Body() body: unknown) { return this.cart.update(req.user.id, parse(id, itemId), parse(item.pick({ quantity: true }), body).quantity); }
  @Delete('items/:itemId') remove(@Req() req: AuthRequest, @Param('itemId') itemId: string) { return this.cart.remove(req.user.id, parse(id, itemId)); }
  @Post('merge') merge(@Req() req: AuthRequest, @Body() body: unknown) { return this.cart.merge(req.user.id, parse(z.object({ items: z.array(item).max(100) }).strict(), body).items); }
}
