import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { authConfig } from '../auth/config';
import { PrismaService } from '../prisma.service';
import {
  orderConfirmationEmail,
  paymentFailedEmail,
  orderStatusUpdateEmail,
  type OrderItemLine,
  type ShippingAddressData,
} from './order-email-templates';

const safeAddress = (value: unknown): ShippingAddressData | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const s = value as Record<string, unknown>;
  const result: ShippingAddressData = {};
  if (typeof s.recipient === 'string') result.recipient = s.recipient;
  if (typeof s.phone === 'string') result.phone = s.phone;
  if (typeof s.line1 === 'string') result.line1 = s.line1;
  if (typeof s.line2 === 'string') result.line2 = s.line2;
  if (typeof s.city === 'string') result.city = s.city;
  if (typeof s.state === 'string') result.state = s.state;
  if (typeof s.pinCode === 'string') result.pinCode = s.pinCode;
  if (typeof s.countryCode === 'string') result.countryCode = s.countryCode;
  return Object.keys(result).length > 0 ? result : null;
};

const extractAttributes = (optionsSnapshot: unknown): Record<string, string> | null => {
  if (!optionsSnapshot || typeof optionsSnapshot !== 'object') return null;
  const s = optionsSnapshot as Record<string, unknown>;
  if (Array.isArray(s.attributes)) {
    const res: Record<string, string> = {};
    for (const item of s.attributes) {
      if (item && typeof item === 'object' && 'name' in item && 'value' in item) {
        res[String(item.name)] = String(item.value);
      }
    }
    return Object.keys(res).length > 0 ? res : null;
  }
  if (s.attributes && typeof s.attributes === 'object' && !Array.isArray(s.attributes)) {
    const res: Record<string, string> = {};
    for (const [k, v] of Object.entries(s.attributes as Record<string, unknown>)) {
      if (typeof v === 'string' || typeof v === 'number') res[k] = String(v);
    }
    return Object.keys(res).length > 0 ? res : null;
  }
  return null;
};

@Injectable()
export class OrderMailService {
  private readonly logger = new Logger(OrderMailService.name);

  constructor(private readonly db?: PrismaService) {}

  /**
   * Internal sender helper with timeouts, retries, and strict non-blocking fault isolation.
   */
  private async deliver(to: string, content: { subject: string; text: string; html: string }, metadata: { orderId: string; orderNumber: string; emailType: string }): Promise<'sent' | 'skipped' | 'failed'> {
    let config: ReturnType<typeof authConfig>;
    try {
      config = authConfig();
    } catch (err) {
      this.logger.warn(`Email provider configuration invalid: ${err instanceof Error ? err.message : String(err)}. Order email skipped.`);
      return 'skipped';
    }

    if (!config.smtpHost || !config.smtpPort || !config.mailFrom || Boolean(config.smtpUser) !== Boolean(config.smtpPassword)) {
      this.logger.warn(`SMTP provider configuration is incomplete. Skipping ${metadata.emailType} email for order #${metadata.orderNumber} (${metadata.orderId}).`);
      return 'skipped';
    }

    let transport: ReturnType<typeof nodemailer.createTransport> | undefined;
    try {
      transport = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        requireTLS: !config.smtpSecure,
        auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPassword } : undefined,
        connectionTimeout: 3000,
        greetingTimeout: 3000,
        socketTimeout: 5000,
        logger: false,
        debug: false,
      });

      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const result = await transport.sendMail({
            from: { name: config.storeName, address: config.mailFrom },
            to,
            subject: content.subject,
            text: content.text,
            html: content.html,
            disableFileAccess: true,
            disableUrlAccess: true,
          });
          if (result.accepted.length > 0) {
            this.logger.log(`Successfully sent ${metadata.emailType} email to ${to} for order #${metadata.orderNumber} (${metadata.orderId}).`);
            return 'sent';
          }
        } catch (err) {
          lastError = err;
        }
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 100 * 2 ** attempt));
        }
      }

      const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
      this.logger.warn(`SMTP server rejected ${metadata.emailType} email for order #${metadata.orderNumber} (${metadata.orderId}): ${errMsg}`);
      return 'failed';
    } catch (err) {
      this.logger.error(`Error preparing or sending ${metadata.emailType} email for order #${metadata.orderNumber} (${metadata.orderId}): ${err instanceof Error ? err.message : String(err)}`);
      return 'failed';
    } finally {
      transport?.close();
    }
  }

  private async getStoreInfo() {
    const config = authConfig();
    try {
      const settings = this.db
        ? await this.db.storeSettings.findUnique({
            where: { id: 'store' },
            select: { storeName: true, supportEmail: true, supportPhone: true, publicAddress: true },
          })
        : null;
      return {
        storeName: settings?.storeName?.trim() || config.storeName,
        supportEmail: settings?.supportEmail?.trim() || null,
        supportPhone: settings?.supportPhone?.trim() || null,
        publicAddress: settings?.publicAddress?.trim() || null,
        frontendUrl: config.frontend,
      };
    } catch {
      return {
        storeName: config.storeName,
        supportEmail: null,
        supportPhone: null,
        publicAddress: null,
        frontendUrl: config.frontend,
      };
    }
  }

  /**
   * Send Order Confirmation Email (Payment Successful)
   */
  async sendOrderConfirmation(orderId: string): Promise<'sent' | 'skipped' | 'failed'> {
    try {
      if (!this.db) {
        this.logger.warn('Database service unavailable. Cannot send order confirmation.');
        return 'skipped';
      }

      const order = await this.db.order.findUnique({
        where: { id: orderId },
        include: {
          customer: { select: { name: true, email: true } },
          lines: true,
          payments: {
            where: { status: 'SUCCEEDED' },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 1,
          },
        },
      });

      if (!order) {
        this.logger.warn(`Order ${orderId} not found for order confirmation email.`);
        return 'failed';
      }

      const storeInfo = await this.getStoreInfo();
      const customerName = order.customer?.name || (safeAddress(order.deliveryAddress)?.recipient) || 'Valued Customer';
      const toEmail = order.email;

      const lines: OrderItemLine[] = order.lines.map(line => {
        const giftOpts = line.giftOptions as Record<string, unknown> | null;
        return {
          productName: line.productName,
          variantName: line.variantName,
          sku: line.sku,
          quantity: line.quantity,
          unitPricePaise: line.unitPricePaise,
          totalPaise: line.totalPaise,
          attributes: extractAttributes(line.optionsSnapshot),
          giftWrapped: Boolean(giftOpts?.giftWrapEnabled),
          giftMessage: typeof giftOpts?.giftMessage === 'string' ? giftOpts.giftMessage : null,
        };
      });

      const orderGiftOpts = order.giftOptions as Record<string, unknown> | null;
      const orderGiftMessage = typeof orderGiftOpts?.giftMessage === 'string'
        ? orderGiftOpts.giftMessage
        : lines.find(l => l.giftMessage)?.giftMessage || null;

      const content = orderConfirmationEmail({
        storeName: storeInfo.storeName,
        supportEmail: storeInfo.supportEmail,
        supportPhone: storeInfo.supportPhone,
        publicAddress: storeInfo.publicAddress,
        frontendUrl: storeInfo.frontendUrl,
        customerName,
        orderNumber: order.orderNumber,
        orderId: order.id,
        createdAt: order.createdAt,
        paymentReference: order.payments[0]?.providerPaymentId ?? null,
        lines,
        subtotalPaise: order.subtotalPaise,
        discountPaise: order.discountPaise,
        couponDiscountPaise: order.lines.reduce((sum, line) => {
          const discounts = line.discountsSnapshot as Record<string, unknown> | null;
          return sum + Number(discounts?.couponPaise ?? 0);
        }, 0),
        couponCode: order.couponCodeSnapshot,
        giftFeePaise: order.giftFeePaise,
        shippingPaise: order.shippingPaise,
        totalPaise: order.totalPaise,
        shippingAddress: safeAddress(order.deliveryAddress),
        orderGiftMessage,
        orderGiftWrapped: order.giftFeePaise > 0 || Boolean(orderGiftOpts?.giftWrapEnabled),
      });

      return await this.deliver(toEmail, content, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        emailType: 'Order Confirmation',
      });
    } catch (err) {
      this.logger.error(`Error in sendOrderConfirmation for order ${orderId}: ${err instanceof Error ? err.message : String(err)}`);
      return 'failed';
    }
  }

  /**
   * Send Payment Failed Email
   */
  async sendPaymentFailed(orderId: string, options?: { code?: string; reason?: string }): Promise<'sent' | 'skipped' | 'failed'> {
    try {
      if (!this.db) {
        this.logger.warn('Database service unavailable. Cannot send payment failed email.');
        return 'skipped';
      }

      const order = await this.db.order.findUnique({
        where: { id: orderId },
        include: {
          customer: { select: { name: true } },
          lines: { select: { productName: true, quantity: true } },
        },
      });

      if (!order) {
        this.logger.warn(`Order ${orderId} not found for payment failed email.`);
        return 'failed';
      }

      const storeInfo = await this.getStoreInfo();
      const customerName = order.customer?.name || (safeAddress(order.deliveryAddress)?.recipient) || 'Valued Customer';
      const toEmail = order.email;
      const itemCount = order.lines.reduce((sum, l) => sum + l.quantity, 0);

      const content = paymentFailedEmail({
        storeName: storeInfo.storeName,
        supportEmail: storeInfo.supportEmail,
        supportPhone: storeInfo.supportPhone,
        frontendUrl: storeInfo.frontendUrl,
        customerName,
        orderNumber: order.orderNumber,
        orderId: order.id,
        totalPaise: order.totalPaise,
        failureReason: options?.reason || 'Your payment was not completed.',
        itemCount,
        items: order.lines.map(l => ({ productName: l.productName, quantity: l.quantity })),
      });

      return await this.deliver(toEmail, content, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        emailType: 'Payment Failed',
      });
    } catch (err) {
      this.logger.error(`Error in sendPaymentFailed for order ${orderId}: ${err instanceof Error ? err.message : String(err)}`);
      return 'failed';
    }
  }

  /**
   * Send Order Status Update Email (Admin Transitions)
   */
  async sendOrderStatusUpdate(
    orderId: string,
    options: {
      action: string;
      targetStatus: string;
      eventId?: string;
      carrier?: string;
      trackingNumber?: string;
      trackingUrl?: string;
      estimatedDeliveryAt?: Date | string | null;
      customerNote?: string | null;
    },
  ): Promise<'sent' | 'skipped' | 'failed'> {
    try {
      if (!this.db) {
        this.logger.warn('Database service unavailable. Cannot send order status update email.');
        return 'skipped';
      }

      const order = await this.db.order.findUnique({
        where: { id: orderId },
        include: {
          customer: { select: { name: true } },
          lines: { select: { quantity: true } },
          shipments: {
            orderBy: [{ dispatchedAt: 'desc' }, { id: 'desc' }],
            take: 1,
            select: { carrier: true, trackingNumber: true, trackingUrl: true, estimatedDeliveryAt: true },
          },
        },
      });

      if (!order) {
        this.logger.warn(`Order ${orderId} not found for status update email.`);
        return 'failed';
      }

      const storeInfo = await this.getStoreInfo();
      const customerName = order.customer?.name || (safeAddress(order.deliveryAddress)?.recipient) || 'Valued Customer';
      const toEmail = order.email;
      const itemCount = order.lines.reduce((sum, l) => sum + l.quantity, 0);

      // Resolve shipment details
      const latestShipment = order.shipments[0];
      const carrier = options.carrier || latestShipment?.carrier || null;
      const trackingNumber = options.trackingNumber || latestShipment?.trackingNumber || null;
      const trackingUrl = options.trackingUrl || latestShipment?.trackingUrl || null;
      const estimatedDeliveryAt = options.estimatedDeliveryAt || latestShipment?.estimatedDeliveryAt || null;

      const content = orderStatusUpdateEmail({
        storeName: storeInfo.storeName,
        supportEmail: storeInfo.supportEmail,
        supportPhone: storeInfo.supportPhone,
        frontendUrl: storeInfo.frontendUrl,
        customerName,
        orderNumber: order.orderNumber,
        orderId: order.id,
        status: options.targetStatus,
        action: options.action,
        updatedAt: new Date(),
        totalPaise: order.totalPaise,
        itemCount,
        carrier,
        trackingNumber,
        trackingUrl,
        estimatedDeliveryAt,
        customerNote: options.customerNote ?? null,
      });

      return await this.deliver(toEmail, content, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        emailType: `Status Update (${options.targetStatus})`,
      });
    } catch (err) {
      this.logger.error(`Error in sendOrderStatusUpdate for order ${orderId}: ${err instanceof Error ? err.message : String(err)}`);
      return 'failed';
    }
  }
}
