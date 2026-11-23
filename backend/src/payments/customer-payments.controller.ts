import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { Public, Roles, type AuthRequest } from '../auth/access';
import { parse } from '../auth/contracts';
import { CustomerPaymentsService } from './customer-payments.service';

const id = z.string().uuid();
const reference = z.string().trim().min(1).max(100);
const verify = z.object({ orderId: id, razorpayOrderId: reference, razorpayPaymentId: reference, razorpaySignature: z.string().regex(/^[a-f0-9]{64}$/i) }).strict();
const failed = z.object({ orderId: id, razorpayOrderId: reference, code: z.string().max(100).optional(), reason: z.string().max(500).optional() }).strict();

@Controller('payments/razorpay')
export class CustomerPaymentsController {
  constructor(private readonly payments: CustomerPaymentsService) {}
  @Roles('CUSTOMER') @Post('verify') verify(@Req() req: AuthRequest, @Body() body: unknown) { return this.payments.verify(req.user.id, parse(verify, body)); }
  @Roles('CUSTOMER') @Post('fail') fail(@Req() req: AuthRequest, @Body() body: unknown) { return this.payments.fail(req.user.id, parse(failed, body)); }
  @Public() @Post('webhook') webhook(@Req() req: Request & { rawBody?: Buffer }, @Headers('x-razorpay-signature') signature: string | undefined, @Headers('x-razorpay-event-id') eventId: string | undefined) { return this.payments.webhook(req.rawBody, signature, eventId); }
}
