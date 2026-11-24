import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CartService } from '../cart/cart.service';
import { PrismaService } from '../prisma.service';
import { RazorpayClient } from '../payments/razorpay-client';
import { customerHistory } from './status-history';

type CheckoutInput = { mode: 'CART' | 'DIRECT'; shippingAddressId: string; billingAddressId: string; couponCode?: string; variantId?: string; quantity?: number };
const address = (row: { recipient: string; phone: string; line1: string; line2: string | null; city: string; state: string; pinCode: string; countryCode: string; label: string | null }) => ({ recipient: row.recipient, phone: row.phone, line1: row.line1, line2: row.line2, city: row.city, state: row.state, pinCode: row.pinCode, countryCode: row.countryCode, label: row.label });
const invalid = (message: string) => new BadRequestException({ code: 'CHECKOUT_INVALID', message });
const validPin = (pinCode: unknown): pinCode is string => typeof pinCode === 'string' && /^[1-9][0-9]{5}$/.test(pinCode);
const deliveryUnavailable = () => invalid('Delivery is unavailable for the selected shipping PIN. Choose another address.');
const paymentStatus = (order: { status: string; payments: { status: string }[] }) => order.status === 'PAYMENT_EXCEPTION' ? 'EXCEPTION' : order.payments.some(row => ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(row.status)) ? 'PAID' : order.payments[0]?.status ?? 'PENDING';
const orderInclude = { lines: { orderBy: { id: 'asc' as const } }, payments: { orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }] }, statusHistory: { include: { admin: { select: { name: true, email: true } } }, orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }] } };

@Injectable()
export class CustomerOrdersService {
  constructor(private readonly db: PrismaService, private readonly cart: CartService, private readonly razorpay: RazorpayClient) {}

  private async owner(userId: string) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { customerId: true, name: true, email: true } });
    if (!user?.customerId) throw new NotFoundException('Customer account not found.');
    return { customerId: user.customerId, name: user.name, email: user.email };
  }

  private present(row: Awaited<ReturnType<typeof this.db.order.findFirst<{ include: typeof orderInclude }>>>) {
    if (!row) return null;
    const automaticDiscountPaise = row.lines.reduce((sum, line) => sum + Number((line.discountsSnapshot as Record<string, unknown> | null)?.automaticPaise ?? 0), 0);
    const couponDiscountPaise = row.lines.reduce((sum, line) => sum + Number((line.discountsSnapshot as Record<string, unknown> | null)?.couponPaise ?? 0), 0);
    return { id: row.id, orderNumber: row.orderNumber, createdAt: row.createdAt, status: row.status, statusHistory: customerHistory(row, row.statusHistory), paymentStatus: paymentStatus(row), currency: row.currency, sourceMode: row.sourceMode, subtotalPaise: row.subtotalPaise, discountPaise: row.discountPaise, automaticDiscountPaise, couponDiscountPaise, shippingPaise: row.shippingPaise, totalPaise: row.totalPaise, couponCode: row.couponCodeSnapshot, shippingAddress: row.deliveryAddress, billingAddress: row.billingAddress, lines: row.lines.map(line => ({ id: line.id, productName: line.productName, sku: line.sku, quantity: line.quantity, unitPricePaise: line.unitPricePaise, effectiveUnitPricePaise: Number((line.discountsSnapshot as Record<string, unknown> | null)?.effectiveUnitPricePaise ?? line.unitPricePaise - Math.floor(line.discountPaise / Math.max(line.quantity, 1))), discountPaise: line.discountPaise, totalPaise: line.totalPaise, attributes: (line.optionsSnapshot as Record<string, unknown> | null)?.attributes ?? [], image: (line.optionsSnapshot as Record<string, unknown> | null)?.image ?? null })), payments: row.payments.map(attempt => ({ id: attempt.id, status: attempt.status, providerPaymentId: attempt.providerPaymentId, failureCode: attempt.failureCode, failureReason: attempt.failureReason, paidAt: attempt.paidAt })) };
  }

  async list(userId: string) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { customerId: true } });
    if (!user) throw new NotFoundException('Customer account not found.');
    if (!user.customerId) return [];
    const customerId = user.customerId;
    const rows = await this.db.order.findMany({ where: { customerId }, include: orderInclude, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    return rows.map(row => this.present(row));
  }

  async detail(userId: string, id: string) {
    const { customerId } = await this.owner(userId);
    const row = await this.db.order.findFirst({ where: { id, customerId }, include: orderInclude });
    if (!row) throw new NotFoundException('Order not found.');
    return this.present(row);
  }

  async checkout(userId: string, input: CheckoutInput) {
    if (input.mode === 'DIRECT' && (input.couponCode || !input.variantId || !input.quantity)) throw invalid('Direct orders need a variant and quantity and cannot use a coupon.');
    if (input.mode === 'CART' && (input.variantId || input.quantity)) throw invalid('Cart checkout uses the items in your saved cart.');
    const owner = await this.owner(userId);
    const [shipping, billing] = await Promise.all([this.db.customerAddress.findFirst({ where: { id: input.shippingAddressId, customerId: owner.customerId } }), this.db.customerAddress.findFirst({ where: { id: input.billingAddressId, customerId: owner.customerId } })]);
    if (!shipping || !billing) throw invalid('Choose saved shipping and billing addresses from your account.');
    if (!validPin(shipping.pinCode)) throw invalid('Enter a valid 6-digit Indian shipping PIN code.');
    const coverage = await this.db.pinCodeServiceability.findUnique({ where: { pinCode: shipping.pinCode } });
    if (coverage?.enabled && !coverage.supported) throw deliveryUnavailable();
    this.razorpay.config();
    const quote = input.mode === 'DIRECT' ? await this.cart.preview([{ variantId: input.variantId!, quantity: input.quantity! }], undefined, owner.customerId) : await this.cart.get(userId, input.couponCode);
    if (!quote.canCheckout || quote.estimatedTotalPaise <= 0) throw invalid(quote.items.find(row => row.warning)?.warning ?? 'Your order has no available items or payable total.');
    if (input.couponCode && !quote.coupon?.valid) throw invalid(quote.coupon?.message ?? 'This coupon cannot be applied.');
    const id = randomUUID();
    const orderNumber = `HL${Date.now().toString(36).toUpperCase()}${id.slice(0, 6).toUpperCase()}`;
    const created = await this.db.$transaction(async tx => {
      // Recheck live stock and the address ownership just before writing the immutable snapshot.
      if (input.mode === 'CART') {
        // Cart writers use the same lock, so a second tab cannot edit lines during this snapshot.
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${userId}), 146223)`;
        const cart = await tx.cart.findFirst({ where: { customerId: owner.customerId }, orderBy: { createdAt: 'asc' }, include: { lines: true } });
        const current = new Map<string, number>();
        for (const line of cart?.lines ?? []) current.set(line.variantId, (current.get(line.variantId) ?? 0) + line.quantity);
        const quoted = new Map<string, number>();
        for (const line of quote.items) quoted.set(line.variantId, (quoted.get(line.variantId) ?? 0) + line.quantity);
        if (current.size !== quoted.size || [...quoted].some(([variantId, quantity]) => current.get(variantId) !== quantity)) throw new ConflictException('Your cart changed. Refresh checkout and try again.');
      }
      for (const line of quote.items) {
        const variant = await tx.productVariant.findUnique({ where: { id: line.variantId }, select: { stockQuantity: true, pricePaise: true } });
        if (!variant || variant.stockQuantity < line.quantity || variant.pricePaise !== line.unitPricePaise) throw new ConflictException('Prices or stock changed. Refresh checkout and try again.');
      }
      const [liveShipping, liveBilling] = await Promise.all([tx.customerAddress.findFirst({ where: { id: shipping.id, customerId: owner.customerId } }), tx.customerAddress.findFirst({ where: { id: billing.id, customerId: owner.customerId } })]);
      if (!liveShipping || !liveBilling) throw invalid('A selected address was removed. Choose an address again.');
      if (!validPin(liveShipping.pinCode)) throw invalid('Enter a valid 6-digit Indian shipping PIN code.');
      const liveCoverage = await tx.pinCodeServiceability.findUnique({ where: { pinCode: liveShipping.pinCode } });
      if (liveCoverage?.enabled && !liveCoverage.supported) throw deliveryUnavailable();
      const created = await tx.order.create({ data: { id, orderNumber, checkoutKey: randomUUID(), customerId: owner.customerId, email: owner.email, phone: shipping.phone, currency: 'INR', deliveryAddress: address(liveShipping), billingAddress: address(liveBilling), sourceMode: input.mode, couponCodeSnapshot: quote.coupon?.valid ? quote.coupon.code : null, status: 'PENDING_PAYMENT', subtotalPaise: quote.subtotalPaise, discountPaise: quote.automaticDiscountPaise + quote.couponDiscountPaise, shippingPaise: 0, giftFeePaise: 0, totalPaise: quote.estimatedTotalPaise, lines: { create: quote.items.map(line => ({ productIdSnapshot: line.product!.id, variantIdSnapshot: line.variantId, variantId: line.variantId, productName: line.product!.name, variantName: line.variant!.sku, sku: line.variant!.sku, quantity: line.quantity, unitPricePaise: line.unitPricePaise, discountPaise: line.automaticDiscountPaise + line.couponDiscountPaise, totalPaise: line.lineTotalPaise, discountsSnapshot: { effectiveUnitPricePaise: line.effectiveUnitPricePaise, automaticPaise: line.automaticDiscountPaise, couponPaise: line.couponDiscountPaise }, optionsSnapshot: { attributes: line.variant!.attributes, image: line.product!.image, cartLineId: input.mode === 'CART' ? line.itemId : null } })) } } });
      await tx.orderStatusHistory.create({ data: { orderId: id, previousStatus: null, status: 'PENDING_PAYMENT', action: 'created', actorType: 'CUSTOMER' } });
      return created;
    });
    return this.startPayment(created.id, owner.name, owner.email, shipping.phone);
  }

  private async startPayment(orderId: string, name: string, email: string, contact?: string | null, retry = false) {
    const order = await this.db.order.findUniqueOrThrow({ where: { id: orderId } });
    const keyId = this.razorpay.config().keyId;
    const providerOrderId = await this.razorpay.createOrder(order.totalPaise, order.orderNumber);
    await this.db.$transaction(async tx => {
      await tx.paymentAttempt.create({ data: { orderId, provider: 'RAZORPAY', providerAccount: keyId, idempotencyKey: randomUUID(), providerOrderId, amountPaise: order.totalPaise, currency: 'INR', status: 'PENDING' } });
      if (retry) await tx.orderStatusHistory.create({ data: { orderId, previousStatus: order.status, status: order.status, action: 'payment_retry', paymentStatus: 'PENDING', actorType: 'CUSTOMER', note: 'Payment retried.' } });
    });
    return { orderId, orderNumber: order.orderNumber, razorpayOrderId: providerOrderId, amount: order.totalPaise, currency: 'INR', keyId, prefill: { name, email, contact: contact ?? '' } };
  }

  async retry(userId: string, id: string) {
    const { customerId, name, email } = await this.owner(userId);
    const order = await this.db.order.findFirst({ where: { id, customerId }, include: { lines: true, payments: true } });
    if (!order) throw new NotFoundException('Order not found.');
    if (order.status !== 'PENDING_PAYMENT' || order.payments.some(row => row.status === 'SUCCEEDED')) throw new ConflictException('This order cannot be retried.');
    const shippingPin = (order.deliveryAddress as { pinCode?: unknown }).pinCode;
    if (!validPin(shippingPin)) throw invalid('Enter a valid 6-digit Indian shipping PIN code.');
    const coverage = await this.db.pinCodeServiceability.findUnique({ where: { pinCode: shippingPin } });
    if (coverage?.enabled && !coverage.supported) throw deliveryUnavailable();
    for (const attempt of order.payments.filter(row => ['PENDING', 'FAILED'].includes(row.status) && row.providerOrderId)) {
      const captures = await this.razorpay.orderPayments(attempt.providerOrderId!);
      if (captures.items.some(item => ['authorized', 'captured'].includes(item.status))) throw new ConflictException('A payment is already being confirmed. Refresh your order status before retrying.');
    }
    for (const line of order.lines) {
      const variant = await this.db.productVariant.findUnique({ where: { id: line.variantIdSnapshot }, select: { stockQuantity: true } });
      if (!variant || variant.stockQuantity < line.quantity) throw new ConflictException(`${line.sku} is no longer available in the purchased quantity.`);
    }
    return this.startPayment(order.id, name, email, order.phone, true);
  }
}
