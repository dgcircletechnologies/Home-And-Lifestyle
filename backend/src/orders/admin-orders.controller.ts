import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { z } from 'zod';
import { Roles, type AuthRequest } from '../auth/access';
import { parse } from '../auth/contracts';
import { AdminOrdersService } from './admin-orders.service';

const uuid = z.string().uuid();
const pagination = { page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) };
const ordersQuery = z.object({ ...pagination, search: z.string().trim().max(100).optional(), status: z.string().trim().min(1).max(40).optional(), paymentStatus: z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED']).optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional() }).strict().refine(value => !value.from || !value.to || value.from <= value.to, 'From date must precede to date.');
const paymentsQuery = z.object({ ...pagination, search: z.string().trim().max(100).optional(), status: z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED']).optional(), orderId: uuid.optional() }).strict();
const action = z.object({ action: z.enum(['accept', 'reject', 'hold', 'resume', 'process', 'ready', 'dispatch', 'deliver', 'cancel']), reason: z.string().trim().min(3).max(500).optional(), carrier: z.string().trim().min(1).max(120).optional(), trackingNumber: z.string().trim().min(1).max(120).optional() }).strict();

@Roles('ADMIN') @Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly service: AdminOrdersService) {}
  @Get() list(@Query() query: unknown) { return this.service.listOrders(parse(ordersQuery, query)); }
  @Get(':id') detail(@Param('id') id: string) { return this.service.order(parse(uuid, id)); }
  @Patch(':id/actions') act(@Param('id') id: string, @Body() body: unknown, @Req() request: AuthRequest) { return this.service.act(parse(uuid, id), request.user.id, parse(action, body)); }
}

@Roles('ADMIN') @Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly service: AdminOrdersService) {}
  @Get() list(@Query() query: unknown) { return this.service.listPayments(parse(paymentsQuery, query)); }
  @Get(':id') detail(@Param('id') id: string) { return this.service.payment(parse(uuid, id)); }
}
