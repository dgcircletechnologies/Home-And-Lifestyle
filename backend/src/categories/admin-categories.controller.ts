import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { Roles } from '../auth/access';
import { parse } from '../auth/contracts';
import { AdminCategoriesService } from './admin-categories.service';

const id = z.string().uuid();
const slug = z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens only.');
const category = z.object({ name: z.string().trim().min(1).max(120), slug, description: z.string().trim().max(5000).nullable().optional(), parentId: id.nullable().optional() }).strict();
const list = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20), search: z.string().trim().max(100).optional(), status: z.enum(['all', 'ACTIVE', 'INACTIVE']).default('all'), sort: z.enum(['name', 'createdAt', 'updatedAt']).default('name') }).strict();
const status = z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) }).strict();
const parents = z.object({ excludeId: id.optional() }).strict();
const uploadLimit = (() => { const value = Number(process.env.CATEGORY_IMAGE_MAX_BYTES ?? 5 * 1024 * 1024); return Number.isInteger(value) && value >= 1024 && value <= 20 * 1024 * 1024 ? value : 5 * 1024 * 1024; })();

@Roles('ADMIN') @Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly categories: AdminCategoriesService) {}
  @Get() list(@Query() query: unknown) { return this.categories.list(parse(list, query)); }
  @Get('parents') parents(@Query() query: unknown) { return this.categories.parents(parse(parents, query).excludeId); }
  @Get(':id') detail(@Param('id') value: string) { return this.categories.detail(parse(id, value)); }
  @Post() create(@Body() body: unknown) { return this.categories.create(parse(category, body)); }
  @Patch(':id') update(@Param('id') value: string, @Body() body: unknown) { return this.categories.update(parse(id, value), parse(category.partial().strict(), body)); }
  @Patch(':id/status') status(@Param('id') value: string, @Body() body: unknown) { return this.categories.status(parse(id, value), parse(status, body).status); }
  @Delete(':id') remove(@Param('id') value: string) { return this.categories.remove(parse(id, value)); }
  @Post(':id/image') @UseInterceptors(FileInterceptor('image', { limits: { files: 1, fileSize: uploadLimit } }))
  replaceImage(@Param('id') value: string, @UploadedFile() file: Express.Multer.File) { return this.categories.replaceImage(parse(id, value), file); }
  @Delete(':id/image') removeImage(@Param('id') value: string) { return this.categories.removeImage(parse(id, value)); }
}
