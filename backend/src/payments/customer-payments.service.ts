import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import { RazorpayClient } from './razorpay-client';

type Attempt = { id: string; orderId: string; providerOrderId: string | null; amountPaise: number; currency: string; status: string; providerPaymentId: string | null };
class StockUnavailable extends Error {}

@Injectable()
export class CustomerPaymentsService {
  constructor(private readonly db: PrismaService, private readonly razorpay: RazorpayClient) {}

  private async ownedAttempt(userId: string, orderId: string, providerOrderId: string) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { customerId: true } });
    const attempt = user?.customerId ? await this.db.paymentAttempt.findFirst({ where: { orderId, providerOrderId, provider: 'RAZORPAY', order: { customerId: user.customerId } } }) : null;
    if (!attempt) throw new NotFoundException('Payment attempt not found.');
    return attempt;
  }

  async verify(userId: string, input: { orderId: string; razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) {
    const attempt = await this.ownedAttempt(userId, input.orderId, input.razorpayOrderId);
    const config = this.razorpay.config();
    if (!this.razorpay.validSignature(`${attempt.providerOrderId}|${input.razorpayPaymentId}`, input.razorpaySignature, config.secret)) {
      await this.db.paymentEvent.create({ data: { provider: 'RAZORPAY', providerAccount: config.keyId, providerEventId: `invalid-${randomUUID()}`, payload: { orderId: input.orderId, attemptId: attempt.id }, processingError: 'Invalid checkout signature' } });
      throw new BadRequestException({ code: 'PAYMENT_SIGNATURE_INVALID', message: 'Payment verification failed. Please check your order status before trying again.' });
    }
    const providerPayment = await this.razorpay.payment(input.razorpayPaymentId);
    if (providerPayment.order_id !== attempt.providerOrderId || providerPayment.amount !== attempt.amountPaise || providerPayment.currency !== attempt.currency || providerPayment.status !== 'captured') throw new ConflictException({ code: 'PAYMENT_NOT_CAPTURED', message: 'Payment is awaiting gateway confirmation. Check your order status shortly.' });
    return this.finalize(attempt, providerPayment.id, input.razorpaySignature);
  }

  async fail(userId: string, input: { orderId: string; razorpayOrderId: string; code?: string; reason?: string }) {
    const attempt = await this.ownedAttempt(userId, input.orderId, input.razorpayOrderId);
    return this.markFailed(attempt, input.code ?? 'CHECKOUT_DISMISSED', input.reason ?? 'Payment was not completed.');
  }

  private async markFailed(attempt: Attempt, code: string, reason: string) {
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${attempt.orderId}))`;
      const order = await tx.order.findUnique({ where: { id: attempt.orderId }, include: { payments: true } });
      const current = order?.payments.find(row => row.id === attempt.id);
      if (!order || !current) throw new NotFoundException('Payment attempt not found.');
      if (current.status === 'SUCCEEDED' || order.status === 'NEW') return { orderId: order.id, status: 'PAID' };
      if (order.status === 'PAYMENT_EXCEPTION') return { orderId: order.id, status: 'EXCEPTION' };
      if (current.status !== 'FAILED') await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: 'FAILED', failureCode: code.slice(0, 100), failureReason: reason.slice(0, 500) } });
      return { orderId: order.id, status: 'FAILED' };
    });
  }

  async finalize(attempt: Attempt, paymentId: string, signature?: string) {
    try {
      return await this.db.$transaction(async tx => {
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${attempt.orderId}))`;
        const order = await tx.order.findUnique({ where: { id: attempt.orderId }, include: { lines: true, payments: true } });
        const current = order?.payments.find(row => row.id === attempt.id);
        if (!order || !current) throw new NotFoundException('Payment attempt not found.');
        if (order.status === 'NEW' || order.status === 'PAYMENT_EXCEPTION') {
          if (order.payments.some(row => row.status === 'SUCCEEDED' && row.providerPaymentId === paymentId)) return { orderId: order.id, status: order.status === 'NEW' ? 'PAID' : 'EXCEPTION', replayed: true };
          const extra = { status: 'SUCCEEDED' as const, providerPaymentId: paymentId, providerSignature: signature, paidAt: new Date(), failureCode: 'DUPLICATE_CAPTURE', failureReason: 'An additional payment was captured for this order. Manual reconciliation required.' };
          if (current.status === 'SUCCEEDED') await tx.paymentAttempt.create({ data: { ...extra, orderId: order.id, provider: current.provider, providerAccount: current.providerAccount, providerOrderId: current.providerOrderId, idempotencyKey: randomUUID(), amountPaise: current.amountPaise, currency: current.currency } });
          else await tx.paymentAttempt.update({ where: { id: attempt.id }, data: extra });
          if (order.status === 'NEW') await tx.order.update({ where: { id: order.id }, data: { status: 'PAYMENT_EXCEPTION' } });
          return { orderId: order.id, status: 'EXCEPTION', replayed: false };
        }
        if (order.payments.some(row => row.status === 'SUCCEEDED' && row.providerPaymentId !== paymentId)) throw new ConflictException('This order was already paid by another payment. Manual reconciliation is required.');
        const grouped = new Map<string, number>();
        for (const line of order.lines) grouped.set(line.variantIdSnapshot, (grouped.get(line.variantIdSnapshot) ?? 0) + line.quantity);
        for (const [variantId, quantity] of grouped) {
          const result = await tx.productVariant.updateMany({ where: { id: variantId, stockQuantity: { gte: quantity } }, data: { stockQuantity: { decrement: quantity } } });
          if (result.count !== 1) throw new StockUnavailable('Captured payment could not be allocated to available stock.');
        }
        if (order.couponCodeSnapshot) {
          const coupon = await tx.coupon.findFirst({ where: { code: { equals: order.couponCodeSnapshot, mode: 'insensitive' } } });
          const couponDiscount = order.lines.reduce((sum, line) => sum + Number((line.discountsSnapshot as Record<string, unknown> | null)?.couponPaise ?? 0), 0);
          if (couponDiscount > 0) await tx.couponRedemption.create({ data: { couponId: coupon?.id, customerId: order.customerId, orderId: order.id, codeSnapshot: order.couponCodeSnapshot, discountPaise: couponDiscount, rulesSnapshot: { source: 'checkout' } } });
        }
        await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: 'SUCCEEDED', providerPaymentId: paymentId, providerSignature: signature, paidAt: new Date(), failureCode: null, failureReason: null } });
        await tx.order.update({ where: { id: order.id }, data: { status: 'NEW' } });
        if (order.sourceMode === 'CART' && order.customerId) {
          const account = await tx.user.findUnique({ where: { customerId: order.customerId }, select: { id: true } });
          if (account) await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${account.id}), 146223)`;
          for (const line of order.lines) {
            const cartLineId = (line.optionsSnapshot as Record<string, unknown> | null)?.cartLineId;
            if (typeof cartLineId !== 'string') continue;
            const currentLine = await tx.cartLine.findFirst({ where: { id: cartLineId, cart: { customerId: order.customerId } } });
            if (!currentLine) continue;
            if (currentLine.quantity > line.quantity) await tx.cartLine.update({ where: { id: cartLineId }, data: { quantity: currentLine.quantity - line.quantity } });
            else await tx.cartLine.delete({ where: { id: cartLineId } });
          }
        }
        return { orderId: order.id, status: 'PAID', replayed: false };
      }, { timeout: 10000 });
    } catch (error) {
      if (!(error instanceof StockUnavailable)) throw error;
      return this.db.$transaction(async tx => {
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${attempt.orderId}))`;
        const order = await tx.order.findUnique({ where: { id: attempt.orderId } });
        if (!order) throw new NotFoundException('Order not found.');
        if (order.status === 'NEW') return { orderId: order.id, status: 'PAID', replayed: true };
        await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: 'SUCCEEDED', providerPaymentId: paymentId, providerSignature: signature, paidAt: new Date(), failureCode: 'STOCK_UNAVAILABLE', failureReason: 'Payment captured but stock was unavailable. Manual resolution required.' } });
        await tx.order.update({ where: { id: order.id }, data: { status: 'PAYMENT_EXCEPTION' } });
        return { orderId: order.id, status: 'EXCEPTION', replayed: false };
      });
    }
  }

  async webhook(rawBody: Buffer | undefined, signature: string | undefined, eventId: string | undefined) {
    const config = this.razorpay.config(true);
    if (!rawBody || !this.razorpay.validSignature(rawBody, signature, config.webhookSecret!)) throw new UnauthorizedException('Invalid payment webhook signature.');
    let event: { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string; status?: string; amount?: number; currency?: string; error_code?: string; error_description?: string } }; order?: { entity?: { id?: string } } } };
    try { event = JSON.parse(rawBody.toString('utf8')) as typeof event; } catch { throw new BadRequestException('Invalid webhook payload.'); }
    if (!eventId || !event.event || eventId.length > 200) throw new BadRequestException('Invalid webhook event.');
    const stored = await this.db.paymentEvent.upsert({ where: { provider_providerAccount_providerEventId: { provider: 'RAZORPAY', providerAccount: config.keyId, providerEventId: eventId } }, create: { provider: 'RAZORPAY', providerAccount: config.keyId, providerEventId: eventId, payload: event as Prisma.InputJsonValue }, update: {} });
    if (stored.processedAt) return { received: true, replayed: true };
    const entity = event.payload?.payment?.entity;
    if (!['payment.captured', 'order.paid', 'payment.failed'].includes(event.event)) { await this.db.paymentEvent.update({ where: { id: stored.id }, data: { processedAt: new Date() } }); return { received: true }; }
    const providerOrderId = entity?.order_id ?? event.payload?.order?.entity?.id;
    if (!providerOrderId) throw new BadRequestException('Webhook payment reference is missing.');
    const attempt = await this.db.paymentAttempt.findFirst({ where: { provider: 'RAZORPAY', providerAccount: config.keyId, providerOrderId } });
    if (!attempt) { await this.db.paymentEvent.update({ where: { id: stored.id }, data: { processingError: 'Unknown provider order' } }); return { received: true, unmatched: true }; }
    try {
      if (event.event === 'payment.failed') await this.markFailed(attempt, entity?.error_code ?? 'PAYMENT_FAILED', entity?.error_description ?? 'Payment failed.');
      else {
        let payment = entity?.id ? await this.razorpay.payment(entity.id) : null;
        if (!payment) payment = (await this.razorpay.orderPayments(providerOrderId)).items.find(item => item.status === 'captured') ?? null;
        if (!payment || payment.status !== 'captured' || payment.order_id !== attempt.providerOrderId || payment.amount !== attempt.amountPaise || payment.currency !== attempt.currency) throw new ConflictException('Captured payment details do not match this order.');
        await this.finalize(attempt, payment.id);
      }
      await this.db.paymentEvent.update({ where: { id: stored.id }, data: { processedAt: new Date(), processingError: null } });
      return { received: true };
    } catch (error) {
      await this.db.paymentEvent.update({ where: { id: stored.id }, data: { processingError: error instanceof Error ? error.message.slice(0, 500) : 'Webhook processing failed' } });
      throw error;
    }
  }
}
