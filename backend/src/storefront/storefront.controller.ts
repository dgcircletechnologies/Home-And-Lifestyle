import { Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { Public } from '../auth/access';
import { parse } from '../auth/contracts';
import { StorefrontService } from './storefront.service';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120);
const query = z.object({ category: slug.optional(), collection: slug.optional(), search: z.string().trim().min(1).max(80).optional(), giftable: z.literal('true').optional(), page: z.coerce.number().int().min(1).max(100).default(1) }).strict();
const pin = z.string().regex(/^[1-9][0-9]{5}$/);
@Public() @Controller('storefront')
export class StorefrontController {
  constructor(private readonly storefront: StorefrontService) {}
  @Get('home') home() { return this.storefront.home(); }
  @Get('navigation') navigation() { return this.storefront.menu(); }
  @Get('products') products(@Query() raw: unknown) { return this.storefront.products(parse(query, raw)); }
  @Get('products/:slug') product(@Param('slug') value: string) { return this.storefront.product(parse(slug, value)); }
  @Get('categories/:slug') category(@Param('slug') value: string) { return this.storefront.category(parse(slug, value)); }
  @Get('collections/:slug') collection(@Param('slug') value: string) { return this.storefront.collection(parse(slug, value)); }
  @Get('serviceability/:pin') serviceability(@Param('pin') value: string) { return this.storefront.serviceability(parse(pin, value)); }
}
