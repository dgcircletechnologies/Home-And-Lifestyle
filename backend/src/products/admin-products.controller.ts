import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { Roles, type AuthRequest } from '../auth/access';
import { parse } from '../auth/contracts';
import { AdminProductsService } from './admin-products.service';
const id = z.string().uuid(); const text = z.string().trim().min(1).max(5000); const slug = z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/); const paise = z.number().int().min(0).max(1000000000);
const product = z.object({ name: z.string().trim().min(1).max(160), slug, description: text, story: z.string().trim().max(10000).nullable().optional(), materials: z.array(z.string().trim().min(1).max(100)).max(30).optional(), careInstructions: z.string().trim().max(5000).nullable().optional(), categoryIds: z.array(id).max(50).optional(), sku: z.string().trim().min(1).max(100).optional(), pricePaise: paise, stockQuantity: z.number().int().min(0).max(100000000).optional(), giftWrapEligible: z.boolean().optional() }).strict();
const update = product.pick({ name: true, slug: true, description: true, story: true, materials: true, careInstructions: true, categoryIds: true, giftWrapEligible: true }).extend({ isFeatured: z.boolean().optional() }).partial().strict();
const list = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20), search: z.string().trim().max(100).optional(), status: z.enum(['all', 'DRAFT', 'PUBLISHED', 'ARCHIVED']).default('all'), categoryId: id.optional(), stock: z.enum(['all', 'in', 'out']).default('all'), sort: z.enum(['name', 'createdAt', 'updatedAt']).default('name') }).strict();
const variant = z.object({ sku: z.string().trim().min(1).max(100).optional(), pricePaise: paise.optional(), compareAtPricePaise: paise.nullable().optional() }).strict(); const status = z.object({ status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']) }).strict(); const receipt = z.object({ operationId: z.string().uuid(), quantity: z.number().int().positive().max(100000000), note: z.string().trim().max(500).optional() }).strict(); const image = z.object({ altText: z.string().trim().max(250).optional(), position: z.number().int().min(0).max(1000).optional() }).strict();
const uploadLimit = Number(process.env.CATEGORY_IMAGE_MAX_BYTES ?? 5242880);
@Roles('ADMIN') @Controller('admin/products') export class AdminProductsController {
  constructor(private readonly products: AdminProductsService) {}
  @Get() list(@Query() query: unknown) { return this.products.list(parse(list, query)); }
  @Get('categories/options') options(@Query() query: unknown) { return this.products.categoryOptions(parse(z.object({ search: z.string().trim().max(100).optional() }).strict(), query).search); }
  @Get(':id') detail(@Param('id') value: string) { return this.products.detail(parse(id, value)); }
  @Post() create(@Body() body: unknown) { return this.products.create(parse(product, body)); }
  @Patch(':id') update(@Param('id') value: string, @Body() body: unknown) { return this.products.update(parse(id, value), parse(update, body)); }
  @Patch(':id/status') status(@Param('id') value: string, @Body() body: unknown) { return this.products.status(parse(id, value), parse(status, body).status); }
  @Delete(':id') archive(@Param('id') value: string) { return this.products.archive(parse(id, value)); }
  @Patch(':id/variants/:variantId') variant(@Param('id') productId: string, @Param('variantId') variantId: string, @Body() body: unknown) { return this.products.updateVariant(parse(id, productId), parse(id, variantId), parse(variant, body)); }
  @Post(':id/variants/:variantId/restocks') restock(@Param('id') productId: string, @Param('variantId') variantId: string, @Body() body: unknown, @Req() req: AuthRequest) { return this.products.restock(parse(id, productId), parse(id, variantId), req.user.id, parse(receipt, body)); }
  @Post(':id/images') @UseInterceptors(FileInterceptor('image', { limits: { files: 1, fileSize: uploadLimit } })) image(@Param('id') productId: string, @UploadedFile() file: Express.Multer.File, @Query() query: unknown) { return this.products.addImage(parse(id, productId), file, parse(z.object({ altText: z.string().trim().max(250).optional() }).strict(), query).altText); }
  @Patch(':id/images/:imageId') updateImage(@Param('id') productId: string, @Param('imageId') imageId: string, @Body() body: unknown) { return this.products.updateImage(parse(id, productId), parse(id, imageId), parse(image, body)); }
  @Patch(':id/images/:imageId/primary') primary(@Param('id') productId: string, @Param('imageId') imageId: string) { return this.products.makePrimary(parse(id, productId), parse(id, imageId)); }
  @Delete(':id/images/:imageId') removeImage(@Param('id') productId: string, @Param('imageId') imageId: string) { return this.products.removeImage(parse(id, productId), parse(id, imageId)); }
}
