import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { z } from 'zod';
import { Public, Roles, type AuthRequest } from '../auth/access';
import { parse } from '../auth/contracts';
import { StorefrontReviewsService } from './storefront-reviews.service';

const slug = z.string().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const query = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1) }).strict();
const submission = z.object({ rating: z.number().int().min(1).max(5), title: z.string().trim().min(1).max(160).optional(), body: z.string().trim().min(10).max(3000) }).strict();

@Public() @Controller('storefront/products/:slug/reviews')
export class PublicReviewsController {
  constructor(private readonly reviews: StorefrontReviewsService) {}
  @Get() list(@Param('slug') value: string, @Query() raw: unknown) { return this.reviews.list(parse(slug, value), parse(query, raw).page); }
}

@Roles('CUSTOMER') @Controller('customer/products/:slug/reviews')
export class CustomerReviewsController {
  constructor(private readonly reviews: StorefrontReviewsService) {}
  @Post() create(@Param('slug') value: string, @Body() raw: unknown, @Req() req: AuthRequest) { return this.reviews.create(parse(slug, value), req.user.id, parse(submission, raw)); }
}
