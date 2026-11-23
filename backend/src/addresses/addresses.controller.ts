import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { Roles, type AuthRequest } from '../auth/access';
import { parse } from '../auth/contracts';
import { AddressesService } from './addresses.service';

const id = z.string().uuid();
const fields = z.object({
  fullName: z.string().trim().min(1).max(100),
  phone: z.string().regex(/^[6-9][0-9]{9}$/, 'Enter a valid 10-digit Indian mobile number.'),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  pinCode: z.string().regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit Indian PIN code.'),
  label: z.enum(['Home', 'Office', 'Other']).nullable().optional(),
  isDefault: z.boolean().optional(),
}).strict();

@Roles('CUSTOMER') @Controller('addresses')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}
  @Get() list(@Req() req: AuthRequest) { return this.addresses.list(req.user.id); }
  @Post() create(@Req() req: AuthRequest, @Body() body: unknown) { return this.addresses.create(req.user.id, parse(fields, body)); }
  @Patch(':id') update(@Req() req: AuthRequest, @Param('id') addressId: string, @Body() body: unknown) { return this.addresses.update(req.user.id, parse(id, addressId), parse(fields.partial(), body)); }
  @Delete(':id') remove(@Req() req: AuthRequest, @Param('id') addressId: string) { return this.addresses.remove(req.user.id, parse(id, addressId)); }
}
