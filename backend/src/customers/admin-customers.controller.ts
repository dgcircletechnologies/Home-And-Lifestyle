import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../auth/access';
import { parse } from '../auth/contracts';
import { z } from 'zod';
import { AdminCustomersService } from './admin-customers.service';

const id = z.string().uuid();
const text = z.string().trim().min(1).max(120);
const list = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20), search: z.string().trim().max(100).optional(), state: z.enum(['all', 'active', 'blocked', 'unverified', 'deleted']).default('all'), sort: z.enum(['createdAt', 'name']).default('createdAt') }).strict();
const update = z.object({ name: text.optional(), phone: z.string().trim().min(3).max(30).nullable().optional() }).strict();
const status = z.object({ disabled: z.boolean() }).strict();
const address = z.object({ recipient: text, phone: z.string().trim().min(3).max(30), line1: text, line2: z.string().trim().max(120).optional(), city: text, state: text, pinCode: z.string().trim().min(3).max(20), countryCode: z.string().trim().length(2).optional() }).strict();
@Roles('ADMIN') @Controller('admin/customers')
export class AdminCustomersController {
  constructor(private readonly customers: AdminCustomersService) {}
  @Get() list(@Query() query: unknown) { return this.customers.list(parse(list, query)); }
  @Get(':id') detail(@Param('id') value: string) { return this.customers.detail(parse(id, value)); }
  @Patch(':id') update(@Param('id') value: string, @Body() body: unknown) { return this.customers.update(parse(id, value), parse(update, body)); }
  @Patch(':id/status') status(@Param('id') value: string, @Body() body: unknown) { return this.customers.status(parse(id, value), parse(status, body).disabled); }
  @Delete(':id') remove(@Param('id') value: string) { return this.customers.remove(parse(id, value)); }
  @Patch(':id/restore') restore(@Param('id') value: string) { return this.customers.restore(parse(id, value)); }
  @Get(':id/addresses') addresses(@Param('id') value: string) { return this.customers.addresses(parse(id, value)); }
  @Patch(':id/addresses/:addressId') updateAddress(@Param('id') value: string, @Param('addressId') addressId: string, @Body() body: unknown) { return this.customers.updateAddress(parse(id, value), parse(id, addressId), parse(address.partial(), body)); }
  @Post(':id/addresses') addAddress(@Param('id') value: string, @Body() body: unknown) { return this.customers.addAddress(parse(id, value), parse(address, body)); }
}
