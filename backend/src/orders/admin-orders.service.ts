import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { PaymentStatus, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import { period } from '../dashboard/period';

const customer = { select: { name: true, email: true } } as const;
const paymentFields = { id: true, orderId: true, provider: true, providerPaymentId: true, amountPaise: true, currency: true, status: true, failureCode: true, createdAt: true, updatedAt: true } as const;
const paymentDto = (row: { id: string; orderId: string; provider: string; providerPaymentId: string | null; amountPaise: number; currency: string; status: PaymentStatus; failureCode: string | null; createdAt: Date; updatedAt: Date; order: { orderNumber: string; email: string; customer: { name: string | null } | null } }) => ({ id: row.id, orderId: row.orderId, orderNumber: row.order.orderNumber, customerName: row.order.customer?.name ?? row.order.email, provider: row.provider, reference: row.providerPaymentId, amountPaise: row.amountPaise, currency: row.currency, status: row.status, failureCode: row.failureCode, createdAt: row.createdAt, updatedAt: row.updatedAt });
const safeAddress = (value: unknown) => { if (!value || typeof value !== 'object' || Array.isArray(value)) return null; const source = value as Record<string, unknown>; return Object.fromEntries(['recipient', 'line1', 'line2', 'city', 'state', 'pinCode', 'countryCode', 'phone'].filter(key => typeof source[key] === 'string').map(key => [key, source[key]])); };
@Injectable()
export class AdminOrdersService {
  constructor(private readonly db: PrismaService) {}
  private next(status: string): string[] { return ({ NEW: ['accept', 'reject', 'hold', 'cancel'], ACCEPTED: ['process', 'hold', 'cancel'], PROCESSING: ['ready', 'dispatch', 'hold', 'cancel'], READY_TO_SHIP: ['dispatch', 'hold', 'cancel'], SHIPPED: ['deliver'], ON_HOLD: ['resume', 'cancel'] } as Record<string, string[]>)[status] ?? []; }
  async act(id: string, adminId: string, input: { action: 'accept' | 'reject' | 'hold' | 'resume' | 'process' | 'ready' | 'dispatch' | 'deliver' | 'cancel'; reason?: string; carrier?: string; trackingNumber?: string }) {
    if (['reject', 'hold', 'cancel'].includes(input.action) && !input.reason) throw new BadRequestException({ code: 'REASON_REQUIRED', message: 'A reason is required for this action.' });
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${id}))`;
      const current = await tx.order.findUnique({ where: { id }, include: { lines: { select: { id: true, quantity: true } }, shipments: { include: { lines: true } }, statusHistory: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1 } } });
      if (!current) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found.' });
      const destination: Record<string, string> = { accept: 'ACCEPTED', reject: 'REJECTED', hold: 'ON_HOLD', process: 'PROCESSING', ready: 'READY_TO_SHIP', dispatch: 'SHIPPED', deliver: 'DELIVERED', cancel: 'CANCELLED' };
      if (input.action !== 'resume' && current.status === destination[input.action]) return { id, status: current.status, allowedActions: this.next(current.status), replayed: true };
      if (!this.next(current.status).includes(input.action)) throw new ConflictException({ code: 'ORDER_TRANSITION_CONFLICT', message: `Cannot ${input.action} an order in ${current.status}. Refresh the order.` });
      const previousStage = current.statusHistory[0]?.resumedFrom;
      const target = input.action === 'resume' ? previousStage : destination[input.action];
      if (!target || (input.action === 'resume' && !['NEW', 'ACCEPTED', 'PROCESSING', 'READY_TO_SHIP'].includes(target))) throw new ConflictException({ code: 'HOLD_STAGE_UNKNOWN', message: 'The stage before hold is not recorded.' });
      if (['cancel', 'reject'].includes(input.action) && current.shipments.some(shipment => shipment.lines.length || shipment.dispatchedAt)) throw new ConflictException({ code: 'ORDER_ALREADY_SHIPPED', message: 'This order has shipped units. Use the shipment or return workflow.' });
      if (input.action === 'dispatch') {
        if (current.shipments.length) throw new ConflictException({ code: 'SHIPMENT_EXISTS', message: 'A shipment already exists. Review its quantities before dispatching more items.' });
        const shipment = await tx.shipment.create({ data: { orderId: id, status: 'SHIPPED', carrier: input.carrier, trackingNumber: input.trackingNumber, dispatchedAt: new Date() } });
        await tx.shipmentLine.createMany({ data: current.lines.map(line => ({ shipmentId: shipment.id, orderId: id, orderLineId: line.id, quantity: line.quantity })) });
      }
      if (input.action === 'deliver') {
        if (!current.shipments.length || current.shipments.some(shipment => shipment.status !== 'SHIPPED')) throw new ConflictException({ code: 'SHIPMENT_NOT_READY', message: 'Every shipment must be dispatched before delivery.' });
        const shipped = new Map<string, number>();
        for (const shipment of current.shipments) for (const line of shipment.lines) shipped.set(line.orderLineId, (shipped.get(line.orderLineId) ?? 0) + line.quantity);
        if (current.lines.some(line => (shipped.get(line.id) ?? 0) !== line.quantity)) throw new ConflictException({ code: 'PARTIAL_SHIPMENT', message: 'Not every purchased unit has shipped.' });
        await tx.shipment.updateMany({ where: { orderId: id, status: 'SHIPPED' }, data: { status: 'DELIVERED', deliveredAt: new Date() } });
      }
      const saved = await tx.order.update({ where: { id }, data: { status: target } });
      const event = await tx.orderStatusHistory.create({ data: { orderId: id, adminId, previousStatus: current.status, status: target, action: input.action, reason: input.reason, resumedFrom: input.action === 'hold' ? current.status : null } });
      return { id, status: saved.status, updatedAt: saved.updatedAt, allowedActions: this.next(saved.status), event, replayed: false };
    });
  }
  async listOrders(query: { page: number; pageSize: number; search?: string; status?: string; paymentStatus?: PaymentStatus; from?: Date; to?: Date }) {
    const base: Prisma.OrderWhereInput = { ...(query.search ? { OR: [{ orderNumber: { contains: query.search, mode: 'insensitive' } }, { email: { contains: query.search, mode: 'insensitive' } }, { customer: { name: { contains: query.search, mode: 'insensitive' } } }] } : {}), ...(query.paymentStatus ? { payments: { some: { status: query.paymentStatus } } } : {}), ...((query.from || query.to) ? { createdAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } : {}) };
    const where = { ...base, ...(query.status ? { status: query.status } : {}) };
    const [total, rows, groups] = await this.db.$transaction([this.db.order.count({ where }), this.db.order.findMany({ where, select: { id: true, orderNumber: true, createdAt: true, updatedAt: true, email: true, currency: true, totalPaise: true, status: true, customer, lines: { select: { quantity: true } }, payments: { select: { status: true, amountPaise: true, refunds: { select: { status: true, amountPaise: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }), this.db.order.groupBy({ by: ['status'], where: base, orderBy: { status: 'asc' }, _count: { id: true } })]);
    return { items: rows.map(row => ({ id: row.id, orderNumber: row.orderNumber, createdAt: row.createdAt, updatedAt: row.updatedAt, customerName: row.customer?.name ?? row.email, email: row.email, currency: row.currency, totalPaise: row.totalPaise, status: row.status, itemCount: row.lines.reduce((sum, line) => sum + line.quantity, 0), receivedPaise: row.payments.filter(payment => payment.status === 'SUCCEEDED' || payment.status === 'PARTIALLY_REFUNDED' || payment.status === 'REFUNDED').reduce((sum, payment) => sum + payment.amountPaise - payment.refunds.filter(refund => refund.status === 'SUCCEEDED').reduce((total, refund) => total + refund.amountPaise, 0), 0), paymentStatus: row.payments.length ? row.payments[0]?.status : null })), page: query.page, pageSize: query.pageSize, total, counts: Object.fromEntries(groups.map(group => [group.status, (group._count as { id: number }).id])) };
  }
  async order(id: string) {
    const row = await this.db.order.findUnique({ where: { id }, include: { customer, lines: { select: { id: true, productName: true, variantName: true, sku: true, quantity: true, unitPricePaise: true, discountPaise: true, taxPaise: true, totalPaise: true, optionsSnapshot: true } }, payments: { select: { ...paymentFields, refunds: { select: { id: true, amountPaise: true, status: true, createdAt: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }, shipments: { select: { id: true, status: true, carrier: true, trackingNumber: true, trackingUrl: true, dispatchedAt: true, estimatedDeliveryAt: true, deliveredAt: true } }, adjustments: { select: { id: true, kind: true, status: true, quantity: true, createdAt: true } }, statusHistory: { select: { id: true, previousStatus: true, status: true, action: true, reason: true, resumedFrom: true, createdAt: true, admin: { select: { name: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] } } });
    if (!row) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found.' });
    return { id: row.id, orderNumber: row.orderNumber, createdAt: row.createdAt, updatedAt: row.updatedAt, status: row.status, currency: row.currency, email: row.email, phone: row.phone, customerName: row.customer?.name ?? row.email, deliveryAddress: safeAddress(row.deliveryAddress), billingAddress: safeAddress(row.billingAddress), lines: row.lines, subtotalPaise: row.subtotalPaise, discountPaise: row.discountPaise, shippingPaise: row.shippingPaise, taxPaise: row.taxPaise, giftFeePaise: row.giftFeePaise, totalPaise: row.totalPaise, payments: row.payments.map(payment => ({ id: payment.id, provider: payment.provider, reference: payment.providerPaymentId, amountPaise: payment.amountPaise, currency: payment.currency, status: payment.status, failureCode: payment.failureCode, createdAt: payment.createdAt, updatedAt: payment.updatedAt, refunds: payment.refunds })), shipments: row.shipments, adjustments: row.adjustments, history: row.statusHistory, allowedActions: this.next(row.status), receivedPaise: row.payments.filter(payment => payment.status === 'SUCCEEDED' || payment.status === 'PARTIALLY_REFUNDED' || payment.status === 'REFUNDED').reduce((sum, payment) => sum + payment.amountPaise - payment.refunds.filter(refund => refund.status === 'SUCCEEDED').reduce((total, refund) => total + refund.amountPaise, 0), 0) };
  }
  async listPayments(query: { page: number; pageSize: number; search?: string; status?: PaymentStatus; orderId?: string; currency?: 'INR'; range?: ReturnType<typeof period> }) {
    const where: Prisma.PaymentAttemptWhereInput = { currency: query.currency ?? 'INR', ...(query.status ? { status: query.status } : {}), ...(query.orderId ? { orderId: query.orderId } : {}), ...(query.search ? { OR: [{ providerPaymentId: { contains: query.search, mode: 'insensitive' } }, { order: { orderNumber: { contains: query.search, mode: 'insensitive' } } }] } : {}), ...(query.range ? { AND: [{ OR: [{ updatedAt: { gte: query.range.from, lt: query.range.to } }, { refunds: { some: { status: 'SUCCEEDED', updatedAt: { gte: query.range.from, lt: query.range.to } } } }] }] } : {}) };
    const [total, rows] = await this.db.$transaction([this.db.paymentAttempt.count({ where }), this.db.paymentAttempt.findMany({ where, select: { ...paymentFields, order: { select: { orderNumber: true, email: true, customer: { select: { name: true } } } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize })]);
    return { items: rows.map(paymentDto), page: query.page, pageSize: query.pageSize, total };
  }
  async paymentSummary(range: ReturnType<typeof period>) {
    const [captured, pending, refunded] = await Promise.all([
      this.db.paymentAttempt.aggregate({ where: { currency: 'INR', status: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'] }, updatedAt: { gte: range.from, lt: range.to } }, _sum: { amountPaise: true } }),
      this.db.paymentAttempt.aggregate({ where: { currency: 'INR', status: 'PENDING', updatedAt: { gte: range.from, lt: range.to } }, _sum: { amountPaise: true } }),
      this.db.refund.aggregate({ where: { payment: { currency: 'INR' }, status: 'SUCCEEDED', updatedAt: { gte: range.from, lt: range.to } }, _sum: { amountPaise: true } }),
    ]);
    const capturedPaise = captured._sum.amountPaise ?? 0, pendingPaise = pending._sum.amountPaise ?? 0, refundedPaise = refunded._sum.amountPaise ?? 0;
    return { currency: 'INR', period: { start: range.start, end: range.end, timezone: range.timezone }, capturedPaise, pendingPaise, refundedPaise, netPaise: capturedPaise - refundedPaise, refreshedAt: new Date().toISOString(), timestampNote: 'Capture and refund completion times are not stored; latest successful record update is used.' };
  }
  async payment(id: string) {
    const row = await this.db.paymentAttempt.findUnique({ where: { id }, select: { ...paymentFields, order: { select: { orderNumber: true, email: true, customer: { select: { name: true } } } }, refunds: { select: { id: true, amountPaise: true, status: true, reason: true, createdAt: true } } } });
    if (!row) throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND', message: 'Payment not found.' });
    return { ...paymentDto(row), refunds: row.refunds };
  }
}
