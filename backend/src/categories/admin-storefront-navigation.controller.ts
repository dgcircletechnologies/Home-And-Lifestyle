import { Body, Controller, Get, Patch, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../auth/access';
import { parse } from '../auth/contracts';
import { AdminCategoriesService } from './admin-categories.service';

const id = z.string().uuid();
const save = z.object({ categoryIds: z.array(id).max(100).refine(value => new Set(value).size === value.length, 'Remove duplicate categories.'), version: z.number().int().min(0) }).strict();
const legacy = z.object({ ids: save.shape.categoryIds, version: save.shape.version }).strict();
const options = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(20), search: z.string().trim().max(100).optional() }).strict();

// Register this literal controller before the generic /admin/categories/:id controller.
@Roles('ADMIN') @Controller('admin/categories/storefront-navigation')
export class AdminStorefrontNavigationController {
  constructor(private readonly categories: AdminCategoriesService) {}
  @Get() navigation() { return this.categories.navigation(); }
  @Get('options') available(@Query() query: unknown) { return this.categories.navigationOptions(parse(options, query)); }
  @Put() save(@Body() body: unknown) { const input = parse(save, body); return this.categories.saveNavigation(input.categoryIds, input.version); }
  @Patch() legacyReorder(@Body() body: unknown) { const input = parse(legacy, body); return this.categories.reorder(input.ids, input.version); }
}
