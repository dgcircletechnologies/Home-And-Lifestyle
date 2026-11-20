import { Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { Public } from '../auth/access';
import { parse } from '../auth/contracts';
import { StorefrontService } from './storefront.service';
import { ShopService } from './shop.service';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120);
const query = z.object({ category: slug.optional(), collection: slug.optional(), search: z.string().trim().min(1).max(80).optional(), giftable: z.literal('true').optional(), page: z.coerce.number().int().min(1).max(100).default(1) }).strict();
const shopQuery = z.object({ category: z.string().max(500).optional(), material: z.string().max(500).optional(), colour: z.string().max(500).optional(), room: z.string().max(500).optional(), style: z.string().max(500).optional(), size: z.string().max(500).optional(), finish: z.string().max(500).optional(), tag: z.string().max(500).optional(), collection: z.string().max(500).optional(), search: z.string().trim().min(1).max(80).optional(), giftable: z.literal('true').optional(), stock: z.literal('true').optional(), sale: z.literal('true').optional(), min: z.coerce.number().finite().min(0).max(10000000).optional(), max: z.coerce.number().finite().min(0).max(10000000).optional(), sort: z.enum(['newest','price-asc','price-desc','name-asc','name-desc']).default('newest'), page: z.coerce.number().int().min(1).max(100000).default(1), pageSize: z.coerce.number().int().min(1).max(48).default(20) }).strict().refine(value => value.min === undefined || value.max === undefined || value.min <= value.max, 'Minimum price must not exceed maximum price.');
const pin = z.string().regex(/^[1-9][0-9]{5}$/);
@Public() @Controller('storefront')
export class StorefrontController {
  constructor(private readonly storefront: StorefrontService, private readonly shopService: ShopService) {}
  @Get('shop') shop(@Query() raw: unknown) { return this.shopService.list({ ...parse(shopQuery, raw), pageSize: 20 }); }
  @Get('offers') offers() { return this.storefront.offers(); }
  @Get('home') home() { return this.storefront.home(); }
  @Get('navigation') navigation() { return this.storefront.menu(); }
  @Get('products') products(@Query() raw: unknown) { return this.storefront.products(parse(query, raw)); }
  @Get('products/:slug') product(@Param('slug') value: string) { return this.storefront.product(parse(slug, value)); }
  @Get('categories/:slug') category(@Param('slug') value: string) { return this.storefront.category(parse(slug, value)); }
  @Get('collections/:slug') collection(@Param('slug') value: string) { return this.storefront.collection(parse(slug, value)); }
  @Get('serviceability/:pin') serviceability(@Param('pin') value: string) { return this.storefront.serviceability(parse(pin, value)); }
}
