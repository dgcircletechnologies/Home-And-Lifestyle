export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

export const formatInr = (paise: number): string => {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

export const formatIstDate = (date: Date): string => {
  try {
    const formatted = date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${formatted} IST`;
  } catch {
    return `${date.toISOString().slice(0, 10)} UTC`;
  }
};

export interface OrderItemLine {
  productName: string;
  variantName?: string | null;
  sku: string;
  quantity: number;
  unitPricePaise: number;
  totalPaise: number;
  attributes?: Record<string, string> | null;
  giftWrapped?: boolean;
  giftMessage?: string | null;
}

export interface ShippingAddressData {
  recipient?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  countryCode?: string;
}

export interface OrderConfirmationEmailData {
  storeName: string;
  supportEmail?: string | null;
  supportPhone?: string | null;
  publicAddress?: string | null;
  frontendUrl: string;
  customerName: string;
  orderNumber: string;
  orderId: string;
  createdAt: Date;
  paymentReference?: string | null;
  lines: OrderItemLine[];
  subtotalPaise: number;
  discountPaise: number;
  couponDiscountPaise: number;
  couponCode?: string | null;
  giftFeePaise: number;
  shippingPaise: number;
  totalPaise: number;
  shippingAddress: ShippingAddressData | null;
  orderGiftMessage?: string | null;
  orderGiftWrapped?: boolean;
}

export interface PaymentFailedEmailData {
  storeName: string;
  supportEmail?: string | null;
  supportPhone?: string | null;
  frontendUrl: string;
  customerName: string;
  orderNumber: string;
  orderId: string;
  totalPaise: number;
  failureReason?: string | null;
  itemCount: number;
  items?: Array<{ productName: string; quantity: number }>;
}

export interface OrderStatusUpdateEmailData {
  storeName: string;
  supportEmail?: string | null;
  supportPhone?: string | null;
  frontendUrl: string;
  customerName: string;
  orderNumber: string;
  orderId: string;
  status: string;
  action?: string;
  updatedAt: Date;
  totalPaise: number;
  itemCount: number;
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  estimatedDeliveryAt?: Date | string | null;
  customerNote?: string | null;
}

const statusMeta = (status: string) => {
  switch (status) {
    case 'NEW':
      return {
        label: 'Payment Confirmed',
        headline: 'Payment confirmed & preparing your order',
        description: 'Thank you for your purchase! We have received your payment and our team is getting your pieces ready.',
        badgeBg: '#eaf5ee',
        badgeColor: '#28613a',
        badgeBorder: '#b8dfc4',
      };
    case 'ACCEPTED':
      return {
        label: 'Accepted',
        headline: 'Your order has been accepted',
        description: 'Great news! Your order has been reviewed and accepted by our team. We are preparing it with care.',
        badgeBg: '#eaf5ee',
        badgeColor: '#28613a',
        badgeBorder: '#b8dfc4',
      };
    case 'PROCESSING':
      return {
        label: 'Processing',
        headline: 'Your items are being packed',
        description: 'Our warehouse team is carefully wrapping and assembling your pieces for dispatch.',
        badgeBg: '#fdf3e7',
        badgeColor: '#8c531b',
        badgeBorder: '#fae1be',
      };
    case 'READY_TO_SHIP':
      return {
        label: 'Ready to Ship',
        headline: 'Ready for courier handover',
        description: 'Your package is safely packed, labeled, and scheduled for pickup by our delivery partner.',
        badgeBg: '#fdf3e7',
        badgeColor: '#8c531b',
        badgeBorder: '#fae1be',
      };
    case 'SHIPPED':
      return {
        label: 'Shipped',
        headline: 'Your order is on the way',
        description: 'Exciting news! Your package has been dispatched and is traveling safely to your doorstep.',
        badgeBg: '#f2f8f4',
        badgeColor: '#1d542d',
        badgeBorder: '#a9d6b7',
      };
    case 'DELIVERED':
      return {
        label: 'Delivered',
        headline: 'Package delivered',
        description: 'Your order has been delivered. We hope your new home pieces bring warmth and joy to your space.',
        badgeBg: '#eaf5ee',
        badgeColor: '#28613a',
        badgeBorder: '#b8dfc4',
      };
    case 'ON_HOLD':
      return {
        label: 'On Hold',
        headline: 'Order placed on temporary hold',
        description: 'Your order is temporarily on hold while our fulfillment team verifies order details. We will update you shortly.',
        badgeBg: '#f4eff3',
        badgeColor: '#5c3555',
        badgeBorder: '#e0d0dd',
      };
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        headline: 'Your order has been cancelled',
        description: 'Your order has been cancelled. If any payment was captured, your refund will be processed back to your original payment method.',
        badgeBg: '#fdf0ed',
        badgeColor: '#9c2d1b',
        badgeBorder: '#f6c9c2',
      };
    case 'REJECTED':
      return {
        label: 'Rejected',
        headline: 'Order could not be fulfilled',
        description: 'Unfortunately, your order could not be fulfilled and has been rejected. Any captured payment will be refunded immediately.',
        badgeBg: '#fdf0ed',
        badgeColor: '#9c2d1b',
        badgeBorder: '#f6c9c2',
      };
    default:
      return {
        label: status.replaceAll('_', ' '),
        headline: `Order update: ${status.replaceAll('_', ' ')}`,
        description: `Your order status has been updated to ${status.replaceAll('_', ' ')}.`,
        badgeBg: '#f4eff3',
        badgeColor: '#4d2946',
        badgeBorder: '#dfd4dc',
      };
  }
};

const sharedEmailHead = (subject: string) => `
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(subject)}</title>
  <style type="text/css">
    *, *:before, *:after { box-sizing: border-box !important; }
    html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; min-width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    td, th { word-break: break-word; overflow-wrap: anywhere; }
    @media only screen and (max-width: 600px) {
      .email-card { width: 100% !important; max-width: 100% !important; border-radius: 8px !important; }
      .email-outer-td { padding: 12px 8px 32px !important; }
      .email-header-td { padding: 16px 16px 12px !important; }
      .email-body-td { padding: 20px 16px 20px !important; }
      .email-footer-td { padding: 16px 16px !important; }
      .mobile-header-stack { display: block !important; width: 100% !important; text-align: left !important; padding-bottom: 6px !important; }
      .mobile-header-badge { display: block !important; width: 100% !important; text-align: left !important; padding-top: 4px !important; }
      .mobile-btn { display: block !important; width: 100% !important; text-align: center !important; padding: 14px 16px !important; }
      .price-breakdown-spacer { display: none !important; width: 0 !important; max-width: 0 !important; font-size: 0 !important; line-height: 0 !important; }
      .price-breakdown-cell { display: block !important; width: 100% !important; }
    }
  </style>
</head>`;

/**
 * 1. Order Confirmation Email (Payment Successful)
 */
export function orderConfirmationEmail(data: OrderConfirmationEmailData) {
  const storeName = data.storeName.trim() || 'Home & Lifestyle';
  const firstName = data.customerName.trim().split(/\s+/)[0] || '';
  const greeting = firstName ? `Hello ${firstName},` : 'Hello there,';
  const trackUrl = `${data.frontendUrl}/account/orders/${data.orderId}`;
  const istDate = formatIstDate(data.createdAt);
  const subject = `Order Confirmed — #${data.orderNumber} | ${storeName}`;

  // Plain-text lines
  const textLines: string[] = [
    greeting,
    '',
    `Thank you for your order! Your payment has been confirmed and order #${data.orderNumber} is now being processed.`,
    '',
    `Order Number: #${data.orderNumber}`,
    `Order Date: ${istDate}`,
  ];
  if (data.paymentReference) {
    textLines.push(`Payment Reference: ${data.paymentReference}`);
  }
  textLines.push('', '--- ITEMS ORDERED ---');
  for (const line of data.lines) {
    let lineDesc = `${line.productName} (Qty: ${line.quantity}) - ${formatInr(line.totalPaise)}`;
    if (line.variantName && line.variantName !== 'Default') {
      lineDesc += ` [${line.variantName}]`;
    }
    if (line.sku) {
      lineDesc += ` (SKU: ${line.sku})`;
    }
    textLines.push(lineDesc);
    if (line.attributes && Object.keys(line.attributes).length > 0) {
      const attrs = Object.entries(line.attributes).map(([k, v]) => `${k}: ${v}`).join(', ');
      textLines.push(`  Attributes: ${attrs}`);
    }
    if (line.giftWrapped) {
      textLines.push(`  * Gift Wrapped`);
    }
    if (line.giftMessage) {
      textLines.push(`  * Gift Message: "${line.giftMessage}"`);
    }
  }

  textLines.push('', '--- PRICE BREAKDOWN ---');
  textLines.push(`Subtotal: ${formatInr(data.subtotalPaise)}`);
  if (data.discountPaise > 0) {
    textLines.push(`Product Discount: -${formatInr(data.discountPaise)}`);
  }
  if (data.couponDiscountPaise > 0) {
    textLines.push(`Coupon Discount${data.couponCode ? ` (${data.couponCode})` : ''}: -${formatInr(data.couponDiscountPaise)}`);
  }
  if (data.giftFeePaise > 0) {
    textLines.push(`Gift Wrapping: ${formatInr(data.giftFeePaise)}`);
  }
  textLines.push(`Shipping: Free (Included in cost)`);
  textLines.push(`Total Paid: ${formatInr(data.totalPaise)}`);

  if (data.orderGiftMessage) {
    textLines.push('', `Gift Message: "${data.orderGiftMessage}"`);
  }

  if (data.shippingAddress) {
    textLines.push('', '--- DELIVERY ADDRESS ---');
    const addr = data.shippingAddress;
    if (addr.recipient) textLines.push(addr.recipient);
    if (addr.line1) textLines.push(addr.line1);
    if (addr.line2) textLines.push(addr.line2);
    const cityStatePin = [addr.city, addr.state, addr.pinCode].filter(Boolean).join(', ');
    if (cityStatePin) textLines.push(cityStatePin);
    if (addr.phone) textLines.push(`Phone: ${addr.phone}`);
  }

  textLines.push('', '--- TRACK ORDER ---', `You can view your order progress and receipt anytime at:`, trackUrl, '');
  textLines.push(`The ${storeName} team`);
  if (data.supportEmail) textLines.push(`Need help? Write to ${data.supportEmail}`);
  if (data.supportPhone) textLines.push(`Phone: ${data.supportPhone}`);

  const text = textLines.join('\n');

  // HTML format - Clean 2-column mobile-friendly layout (Left: item + details + unit price/qty stacked; Right: line total)
  const rowsHtml = data.lines
    .map(line => {
      const attrText = line.attributes && Object.keys(line.attributes).length > 0
        ? Object.entries(line.attributes).map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(v)}`).join(' &bull; ')
        : '';
      const giftWrapTag = line.giftWrapped
        ? `<div style="margin-top:4px;font-size:12px;color:#8c531b;font-weight:600;word-break:break-word;overflow-wrap:anywhere;">&#127873; Gift Wrapped${line.giftMessage ? `: <em>&ldquo;${escapeHtml(line.giftMessage)}&rdquo;</em>` : ''}</div>`
        : '';
      return `<tr>
        <td style="padding:12px 8px;border-bottom:1px solid #f0eae1;font-size:14px;color:#24221f;vertical-align:top;width:72%;word-break:break-word;overflow-wrap:anywhere;">
          <div style="font-weight:600;color:#24221f;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(line.productName)}</div>
          ${line.variantName && line.variantName !== 'Default' ? `<div style="font-size:12px;color:#615955;margin-top:2px;word-break:break-word;overflow-wrap:anywhere;">Variant: ${escapeHtml(line.variantName)}</div>` : ''}
          ${line.sku ? `<div style="font-size:11px;color:#766e65;margin-top:2px;font-family:monospace;word-break:break-word;overflow-wrap:anywhere;">SKU: ${escapeHtml(line.sku)}</div>` : ''}
          ${attrText ? `<div style="font-size:12px;color:#615955;margin-top:2px;word-break:break-word;overflow-wrap:anywhere;">${attrText}</div>` : ''}
          <div style="font-size:12px;color:#615955;margin-top:4px;">
            Qty: <strong style="color:#24221f;font-variant-numeric:tabular-nums;">${line.quantity}</strong> &bull; <span style="font-variant-numeric:tabular-nums;">${escapeHtml(formatInr(line.unitPricePaise))} each</span>
          </div>
          ${giftWrapTag}
        </td>
        <td align="right" style="padding:12px 8px;border-bottom:1px solid #f0eae1;font-size:14px;font-weight:600;color:#24221f;vertical-align:top;width:28%;font-variant-numeric:tabular-nums;white-space:nowrap;">
          ${escapeHtml(formatInr(line.totalPaise))}
        </td>
      </tr>`;
    })
    .join('');

  let addressHtml = '';
  if (data.shippingAddress) {
    const a = data.shippingAddress;
    const parts = [
      a.recipient ? `<strong style="color:#24221f;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(a.recipient)}</strong>` : '',
      a.line1 ? `<span style="word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(a.line1)}</span>` : '',
      a.line2 ? `<span style="word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(a.line2)}</span>` : '',
      [a.city, a.state, a.pinCode].filter(Boolean).map(s => escapeHtml(s!)).join(', '),
      a.phone ? `Phone: ${escapeHtml(a.phone)}` : '',
    ].filter(Boolean);
    addressHtml = parts.join('<br>');
  }

  const giftCallout = data.orderGiftMessage
    ? `<div style="background:#faf6f0;border-left:3px solid #8c531b;padding:12px 16px;margin:20px 0;border-radius:4px;word-break:break-word;overflow-wrap:anywhere;">
        <div style="font-size:12px;font-weight:700;color:#8c531b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">&#127873; Personal Gift Message</div>
        <div style="font-size:14px;line-height:20px;color:#433e3c;font-style:italic;">&ldquo;${escapeHtml(data.orderGiftMessage)}&rdquo;</div>
      </div>`
    : '';

  const html = `<!doctype html>
<html lang="en">
${sharedEmailHead(subject)}
<body style="margin:0;padding:0;width:100%!important;background:#f8f5ee;color:#24221f;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">Your order #${escapeHtml(data.orderNumber)} has been confirmed. Thank you for shopping with ${escapeHtml(storeName)}!</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;background:#f8f5ee;margin:0;padding:0;">
    <tr>
      <td align="center" class="email-outer-td" style="padding:24px 12px 36px;box-sizing:border-box;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="email-card" style="width:100%;max-width:600px;background:#fffdf8;border:1px solid #e4ded5;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.03);overflow:hidden;box-sizing:border-box;">
          <!-- Store Header -->
          <tr>
            <td class="email-header-td" style="padding:20px 24px 16px;border-bottom:1px solid #e4ded5;background:#ffffff;box-sizing:border-box;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
                <tr>
                  <td class="mobile-header-stack" style="font-size:20px;font-weight:700;letter-spacing:-0.5px;color:#4d2946;vertical-align:middle;">
                    ${escapeHtml(storeName)}
                  </td>
                  <td class="mobile-header-badge" align="right" style="vertical-align:middle;">
                    <span style="background:#eaf5ee;color:#28613a;border:1px solid #b8dfc4;border-radius:9999px;padding:4px 10px;font-size:12px;font-weight:700;letter-spacing:0.3px;display:inline-block;white-space:nowrap;">
                      &check; Payment Confirmed
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td class="email-body-td" style="padding:28px 24px 24px;box-sizing:border-box;">
              <p style="margin:0 0 12px;font-size:15px;line-height:22px;color:#24221f;">${escapeHtml(greeting)}</p>
              <h1 style="margin:0 0 12px;font-size:24px;line-height:30px;letter-spacing:-0.5px;color:#24221f;">
                Thank you for your order!
              </h1>
              <p style="margin:0 0 20px;font-size:14px;line-height:22px;color:#514a47;">
                We have received your payment and confirmed your order. We are preparing your pieces with care and will notify you as soon as your package ships.
              </p>

              <!-- Order Meta Box -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;table-layout:fixed;background:#f9f7f2;border:1px solid #e9e4dc;border-radius:8px;margin-bottom:24px;box-sizing:border-box;">
                <tr>
                  <td style="padding:14px 16px;box-sizing:border-box;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;table-layout:fixed;">
                      <tr>
                        <td style="font-size:13px;color:#615955;padding:3px 0;width:38%;">Order Number:</td>
                        <td align="right" style="font-size:13px;font-weight:700;color:#24221f;padding:3px 0;font-family:monospace;width:62%;word-break:break-word;overflow-wrap:anywhere;">#${escapeHtml(data.orderNumber)}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#615955;padding:3px 0;width:38%;">Order Date:</td>
                        <td align="right" style="font-size:13px;color:#24221f;padding:3px 0;width:62%;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(istDate)}</td>
                      </tr>
                      ${data.paymentReference ? `
                      <tr>
                        <td style="font-size:13px;color:#615955;padding:3px 0;width:38%;">Payment Ref:</td>
                        <td align="right" style="font-size:13px;color:#24221f;padding:3px 0;font-family:monospace;width:62%;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(data.paymentReference)}</td>
                      </tr>` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Itemized Table (2-Column Mobile-Friendly) -->
              <h3 style="margin:0 0 10px;font-size:15px;font-weight:700;color:#24221f;letter-spacing:-0.2px;">Order Summary</h3>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;table-layout:fixed;border-collapse:collapse;margin-bottom:20px;box-sizing:border-box;">
                <thead>
                  <tr style="background:#f4efe8;border-bottom:2px solid #e0d7cc;">
                    <th align="left" style="padding:8px;font-size:12px;font-weight:700;color:#615955;text-transform:uppercase;letter-spacing:0.5px;width:72%;">Item</th>
                    <th align="right" style="padding:8px;font-size:12px;font-weight:700;color:#615955;text-transform:uppercase;letter-spacing:0.5px;width:28%;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>

              ${giftCallout}

              <!-- Pricing Totals -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;table-layout:fixed;margin-bottom:24px;box-sizing:border-box;">
                <tr>
                  <td class="price-breakdown-spacer" width="35%" style="vertical-align:top;"></td>
                  <td class="price-breakdown-cell" width="65%" style="vertical-align:top;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;table-layout:fixed;font-size:13px;line-height:20px;">
                      <tr>
                        <td style="color:#615955;padding:4px 0;width:60%;">Subtotal:</td>
                        <td align="right" style="color:#24221f;padding:4px 0;font-variant-numeric:tabular-nums;white-space:nowrap;width:40%;">${escapeHtml(formatInr(data.subtotalPaise))}</td>
                      </tr>
                      ${data.discountPaise > 0 ? `
                      <tr>
                        <td style="color:#28613a;padding:4px 0;width:60%;">Product Discount:</td>
                        <td align="right" style="color:#28613a;padding:4px 0;font-variant-numeric:tabular-nums;white-space:nowrap;width:40%;">-${escapeHtml(formatInr(data.discountPaise))}</td>
                      </tr>` : ''}
                      ${data.couponDiscountPaise > 0 ? `
                      <tr>
                        <td style="color:#28613a;padding:4px 0;width:60%;word-break:break-word;overflow-wrap:anywhere;">Coupon (${escapeHtml(data.couponCode ?? 'DISCOUNT')}):</td>
                        <td align="right" style="color:#28613a;padding:4px 0;font-variant-numeric:tabular-nums;white-space:nowrap;width:40%;">-${escapeHtml(formatInr(data.couponDiscountPaise))}</td>
                      </tr>` : ''}
                      ${data.giftFeePaise > 0 ? `
                      <tr>
                        <td style="color:#615955;padding:4px 0;width:60%;">Gift Wrapping:</td>
                        <td align="right" style="color:#24221f;padding:4px 0;font-variant-numeric:tabular-nums;white-space:nowrap;width:40%;">${escapeHtml(formatInr(data.giftFeePaise))}</td>
                      </tr>` : ''}
                      <tr>
                        <td style="color:#615955;padding:4px 0;width:60%;">Shipping:</td>
                        <td align="right" style="color:#28613a;font-weight:600;padding:4px 0;white-space:nowrap;width:40%;">Free (Included)</td>
                      </tr>
                      <tr style="border-top:1px solid #dfd8cc;">
                        <td style="font-size:15px;font-weight:700;color:#24221f;padding:10px 0 4px;width:60%;">Total Paid:</td>
                        <td align="right" style="font-size:16px;font-weight:700;color:#28613a;padding:10px 0 4px;font-variant-numeric:tabular-nums;white-space:nowrap;width:40%;">${escapeHtml(formatInr(data.totalPaise))}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Delivery Address Block -->
              ${addressHtml ? `
              <div style="background:#fcfbf8;border:1px solid #ebe6df;border-radius:8px;padding:14px 16px;margin-bottom:24px;word-break:break-word;overflow-wrap:anywhere;box-sizing:border-box;">
                <div style="font-size:12px;font-weight:700;color:#615955;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Shipping Address</div>
                <div style="font-size:14px;line-height:22px;color:#433e3c;word-break:break-word;overflow-wrap:anywhere;">${addressHtml}</div>
              </div>` : ''}

              <!-- Track Order CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin-bottom:20px;">
                <tr>
                  <td align="center">
                    <a href="${escapeHtml(trackUrl)}" class="mobile-btn" style="background:#4d2946;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:700;display:inline-block;max-width:100%;box-sizing:border-box;box-shadow:0 2px 6px rgba(77,41,70,0.25);">
                      Track Your Order
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 6px;font-size:12px;line-height:18px;color:#766e65;text-align:center;word-break:break-word;overflow-wrap:anywhere;">
                If the button above does not open, copy this link into your browser:<br>
                <a href="${escapeHtml(trackUrl)}" style="color:#4d2946;text-decoration:underline;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(trackUrl)}</a>
              </p>
            </td>
          </tr>

          <!-- Store Footer -->
          <tr>
            <td class="email-footer-td" style="padding:20px 24px;background:#f8f5ee;border-top:1px solid #e4ded5;font-size:13px;line-height:20px;color:#615955;box-sizing:border-box;word-break:break-word;overflow-wrap:anywhere;">
              <p style="margin:0 0 6px;font-weight:600;color:#24221f;">The ${escapeHtml(storeName)} Team</p>
              ${data.supportEmail ? `<p style="margin:0 0 4px;word-break:break-word;overflow-wrap:anywhere;">Questions or changes? Email us at <a href="mailto:${escapeHtml(data.supportEmail)}" style="color:#4d2946;font-weight:600;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(data.supportEmail)}</a></p>` : ''}
              ${data.supportPhone ? `<p style="margin:0 0 4px;">Call us: ${escapeHtml(data.supportPhone)}</p>` : ''}
              ${data.publicAddress ? `<p style="margin:4px 0 0;font-size:12px;color:#766e65;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(data.publicAddress)}</p>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

/**
 * 2. Payment Failed Email
 */
export function paymentFailedEmail(data: PaymentFailedEmailData) {
  const storeName = data.storeName.trim() || 'Home & Lifestyle';
  const firstName = data.customerName.trim().split(/\s+/)[0] || '';
  const greeting = firstName ? `Hello ${firstName},` : 'Hello there,';
  const retryUrl = `${data.frontendUrl}/account/orders/${data.orderId}`;
  const subject = `Payment Unsuccessful for Order #${data.orderNumber} | ${storeName}`;
  const failureReason = data.failureReason || 'Your transaction could not be processed by your bank or the payment window was closed.';

  const textLines: string[] = [
    greeting,
    '',
    `We noticed that payment for order #${data.orderNumber} was not completed.`,
    '',
    `Don't worry—your order has been saved and is currently awaiting payment.`,
    `Reason: ${failureReason}`,
    '',
    `Order Number: #${data.orderNumber}`,
    `Order Total: ${formatInr(data.totalPaise)}`,
    `Items: ${data.itemCount} ${data.itemCount === 1 ? 'item' : 'items'}`,
    '',
    'To complete your purchase with UPI, Debit/Credit Card, or Netbanking, please click the link below:',
    retryUrl,
    '',
    `If you have any questions or need assistance, feel free to reply to this email${data.supportEmail ? ` or contact ${data.supportEmail}` : ''}.`,
    '',
    `The ${storeName} team`,
  ];
  const text = textLines.join('\n');

  const html = `<!doctype html>
<html lang="en">
${sharedEmailHead(subject)}
<body style="margin:0;padding:0;width:100%!important;background:#f8f5ee;color:#24221f;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">Your payment for order #${escapeHtml(data.orderNumber)} was not completed. Your items are saved.</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;background:#f8f5ee;margin:0;padding:0;">
    <tr>
      <td align="center" class="email-outer-td" style="padding:24px 12px 36px;box-sizing:border-box;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="email-card" style="width:100%;max-width:600px;background:#fffdf8;border:1px solid #e4ded5;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.03);overflow:hidden;box-sizing:border-box;">
          <!-- Store Header -->
          <tr>
            <td class="email-header-td" style="padding:20px 24px 16px;border-bottom:1px solid #e4ded5;background:#ffffff;box-sizing:border-box;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
                <tr>
                  <td class="mobile-header-stack" style="font-size:20px;font-weight:700;letter-spacing:-0.5px;color:#4d2946;vertical-align:middle;">
                    ${escapeHtml(storeName)}
                  </td>
                  <td class="mobile-header-badge" align="right" style="vertical-align:middle;">
                    <span style="background:#fdf0ed;color:#9c2d1b;border:1px solid #f6c9c2;border-radius:9999px;padding:4px 10px;font-size:12px;font-weight:700;letter-spacing:0.3px;display:inline-block;white-space:nowrap;">
                      Payment Incomplete
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td class="email-body-td" style="padding:28px 24px 24px;box-sizing:border-box;">
              <p style="margin:0 0 12px;font-size:15px;line-height:22px;color:#24221f;">${escapeHtml(greeting)}</p>
              <h1 style="margin:0 0 12px;font-size:24px;line-height:30px;letter-spacing:-0.4px;color:#24221f;">
                Your payment didn’t go through
              </h1>
              <p style="margin:0 0 18px;font-size:14px;line-height:22px;color:#514a47;">
                Don’t worry—your order has been saved and is currently awaiting payment. No charges were made to your account.
              </p>

              <!-- Reason Notice -->
              <div style="background:#fdf7f6;border-left:3px solid #c94c36;padding:12px 14px;margin-bottom:22px;border-radius:4px;word-break:break-word;overflow-wrap:anywhere;box-sizing:border-box;">
                <div style="font-size:12px;font-weight:700;color:#9c2d1b;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px;">Status Notice</div>
                <div style="font-size:14px;line-height:20px;color:#59261d;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(failureReason)}</div>
              </div>

              <!-- Order Summary Callout -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;table-layout:fixed;background:#f9f7f2;border:1px solid #e9e4dc;border-radius:8px;margin-bottom:24px;box-sizing:border-box;">
                <tr>
                  <td style="padding:14px 16px;box-sizing:border-box;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;table-layout:fixed;">
                      <tr>
                        <td style="font-size:13px;color:#615955;padding:3px 0;width:38%;">Order Number:</td>
                        <td align="right" style="font-size:13px;font-weight:700;color:#24221f;padding:3px 0;font-family:monospace;width:62%;word-break:break-word;overflow-wrap:anywhere;">#${escapeHtml(data.orderNumber)}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#615955;padding:3px 0;width:38%;">Items:</td>
                        <td align="right" style="font-size:13px;color:#24221f;padding:3px 0;width:62%;">${data.itemCount} ${data.itemCount === 1 ? 'item' : 'items'}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#615955;padding:3px 0;width:38%;">Amount Due:</td>
                        <td align="right" style="font-size:14px;font-weight:700;color:#24221f;padding:3px 0;font-variant-numeric:tabular-nums;white-space:nowrap;width:62%;">${escapeHtml(formatInr(data.totalPaise))}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Retry CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin-bottom:20px;">
                <tr>
                  <td align="center">
                    <a href="${escapeHtml(retryUrl)}" class="mobile-btn" style="background:#4d2946;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:700;display:inline-block;max-width:100%;box-sizing:border-box;box-shadow:0 2px 6px rgba(77,41,70,0.25);">
                      Retry Payment
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:12px;line-height:18px;color:#615955;text-align:center;word-break:break-word;overflow-wrap:anywhere;">
                You can retry with UPI, Credit/Debit Card, or Netbanking.<br>
                Link: <a href="${escapeHtml(retryUrl)}" style="color:#4d2946;text-decoration:underline;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(retryUrl)}</a>
              </p>
            </td>
          </tr>

          <!-- Store Footer -->
          <tr>
            <td class="email-footer-td" style="padding:20px 24px;background:#f8f5ee;border-top:1px solid #e4ded5;font-size:13px;line-height:20px;color:#615955;box-sizing:border-box;word-break:break-word;overflow-wrap:anywhere;">
              <p style="margin:0 0 6px;font-weight:600;color:#24221f;">The ${escapeHtml(storeName)} Team</p>
              ${data.supportEmail ? `<p style="margin:0 0 4px;word-break:break-word;overflow-wrap:anywhere;">Questions or need help? <a href="mailto:${escapeHtml(data.supportEmail)}" style="color:#4d2946;font-weight:600;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(data.supportEmail)}</a></p>` : ''}
              ${data.supportPhone ? `<p style="margin:0 0 4px;">Call us: ${escapeHtml(data.supportPhone)}</p>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

/**
 * 3. Admin Order Status Update Emails (Every Status Transition)
 */
export function orderStatusUpdateEmail(data: OrderStatusUpdateEmailData) {
  const storeName = data.storeName.trim() || 'Home & Lifestyle';
  const firstName = data.customerName.trim().split(/\s+/)[0] || '';
  const greeting = firstName ? `Hello ${firstName},` : 'Hello there,';
  const orderUrl = `${data.frontendUrl}/account/orders/${data.orderId}`;
  const meta = statusMeta(data.status);
  const istDate = formatIstDate(data.updatedAt);
  const subject = `${meta.headline} — #${data.orderNumber} | ${storeName}`;

  const hasTracking = Boolean(data.trackingNumber || data.carrier || data.trackingUrl);

  const textLines: string[] = [
    greeting,
    '',
    meta.description,
    '',
    `Status: ${meta.label}`,
    `Order Number: #${data.orderNumber}`,
    `Updated: ${istDate}`,
  ];

  if (hasTracking) {
    textLines.push('', '--- SHIPMENT & TRACKING DETAILS ---');
    if (data.carrier) textLines.push(`Courier / Carrier: ${data.carrier}`);
    if (data.trackingNumber) textLines.push(`Tracking ID / AWB: ${data.trackingNumber}`);
    if (data.estimatedDeliveryAt) {
      const estStr = typeof data.estimatedDeliveryAt === 'string'
        ? data.estimatedDeliveryAt
        : formatIstDate(data.estimatedDeliveryAt);
      textLines.push(`Estimated Delivery: ${estStr}`);
    }
    if (data.trackingUrl) textLines.push(`Track Link: ${data.trackingUrl}`);
  }

  if (data.customerNote) {
    textLines.push('', `Note: ${data.customerNote}`);
  }

  textLines.push(
    '',
    `Order Total: ${formatInr(data.totalPaise)} (${data.itemCount} ${data.itemCount === 1 ? 'item' : 'items'})`,
    '',
    `View order details and status timeline at:`,
    orderUrl,
    '',
    `The ${storeName} team`,
  );
  if (data.supportEmail) textLines.push(`Support: ${data.supportEmail}`);

  const text = textLines.join('\n');

  // Tracking callout in HTML
  let trackingHtml = '';
  if (hasTracking) {
    trackingHtml = `
      <div style="background:#f4f7f5;border:1px solid #c9decb;border-radius:10px;padding:16px;margin:20px 0;box-sizing:border-box;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;table-layout:fixed;">
          <tr>
            <td colspan="2" style="font-size:12px;font-weight:700;color:#28613a;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:10px;">
              &#128666; Shipment Tracking Details
            </td>
          </tr>
          ${data.carrier ? `
          <tr>
            <td style="font-size:13px;color:#514a47;padding:3px 0;width:38%;">Courier / Carrier:</td>
            <td style="font-size:13px;color:#24221f;font-weight:700;padding:3px 0;width:62%;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(data.carrier)}</td>
          </tr>` : ''}
          ${data.trackingNumber ? `
          <tr>
            <td style="font-size:13px;color:#514a47;padding:3px 0;width:38%;">Tracking ID / AWB:</td>
            <td style="font-size:13px;color:#24221f;font-family:monospace;font-weight:700;padding:3px 0;width:62%;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(data.trackingNumber)}</td>
          </tr>` : ''}
          ${data.estimatedDeliveryAt ? `
          <tr>
            <td style="font-size:13px;color:#514a47;padding:3px 0;width:38%;">Estimated Delivery:</td>
            <td style="font-size:13px;color:#24221f;font-weight:700;padding:3px 0;width:62%;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(typeof data.estimatedDeliveryAt === 'string' ? data.estimatedDeliveryAt : formatIstDate(data.estimatedDeliveryAt))}</td>
          </tr>` : ''}
          ${data.trackingUrl ? `
          <tr>
            <td colspan="2" style="padding-top:12px;">
              <a href="${escapeHtml(data.trackingUrl)}" class="mobile-btn" style="background:#28613a;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:13px;font-weight:700;display:inline-block;max-width:100%;box-sizing:border-box;">
                Track Courier Shipment &rarr;
              </a>
            </td>
          </tr>` : ''}
        </table>
      </div>`;
  }

  // Customer Note callout (STRICT PRIVACY: never internal note)
  const customerNoteHtml = data.customerNote
    ? `<div style="background:#faf8f5;border-left:3px solid #4d2946;padding:12px 14px;margin:18px 0;border-radius:4px;word-break:break-word;overflow-wrap:anywhere;box-sizing:border-box;">
        <div style="font-size:12px;font-weight:700;color:#4d2946;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px;">Update Note</div>
        <div style="font-size:14px;line-height:20px;color:#433e3c;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(data.customerNote)}</div>
      </div>`
    : '';

  const html = `<!doctype html>
<html lang="en">
${sharedEmailHead(subject)}
<body style="margin:0;padding:0;width:100%!important;background:#f8f5ee;color:#24221f;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${escapeHtml(meta.headline)} for order #${escapeHtml(data.orderNumber)}.</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;background:#f8f5ee;margin:0;padding:0;">
    <tr>
      <td align="center" class="email-outer-td" style="padding:24px 12px 36px;box-sizing:border-box;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="email-card" style="width:100%;max-width:600px;background:#fffdf8;border:1px solid #e4ded5;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.03);overflow:hidden;box-sizing:border-box;">
          <!-- Store Header -->
          <tr>
            <td class="email-header-td" style="padding:20px 24px 16px;border-bottom:1px solid #e4ded5;background:#ffffff;box-sizing:border-box;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
                <tr>
                  <td class="mobile-header-stack" style="font-size:20px;font-weight:700;letter-spacing:-0.5px;color:#4d2946;vertical-align:middle;">
                    ${escapeHtml(storeName)}
                  </td>
                  <td class="mobile-header-badge" align="right" style="vertical-align:middle;">
                    <span style="background:${meta.badgeBg};color:${meta.badgeColor};border:1px solid ${meta.badgeBorder};border-radius:9999px;padding:4px 10px;font-size:12px;font-weight:700;letter-spacing:0.3px;display:inline-block;white-space:nowrap;">
                      ${escapeHtml(meta.label)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td class="email-body-td" style="padding:28px 24px 24px;box-sizing:border-box;">
              <p style="margin:0 0 12px;font-size:15px;line-height:22px;color:#24221f;">${escapeHtml(greeting)}</p>
              <h1 style="margin:0 0 12px;font-size:24px;line-height:30px;letter-spacing:-0.4px;color:#24221f;">
                ${escapeHtml(meta.headline)}
              </h1>
              <p style="margin:0 0 18px;font-size:14px;line-height:22px;color:#514a47;">
                ${escapeHtml(meta.description)}
              </p>

              ${trackingHtml}
              ${customerNoteHtml}

              <!-- Order Summary Callout -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;table-layout:fixed;background:#f9f7f2;border:1px solid #e9e4dc;border-radius:8px;margin-bottom:24px;box-sizing:border-box;">
                <tr>
                  <td style="padding:14px 16px;box-sizing:border-box;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;table-layout:fixed;">
                      <tr>
                        <td style="font-size:13px;color:#615955;padding:3px 0;width:38%;">Order Number:</td>
                        <td align="right" style="font-size:13px;font-weight:700;color:#24221f;padding:3px 0;font-family:monospace;width:62%;word-break:break-word;overflow-wrap:anywhere;">#${escapeHtml(data.orderNumber)}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#615955;padding:3px 0;width:38%;">Items:</td>
                        <td align="right" style="font-size:13px;color:#24221f;padding:3px 0;width:62%;">${data.itemCount} ${data.itemCount === 1 ? 'item' : 'items'}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#615955;padding:3px 0;width:38%;">Order Total:</td>
                        <td align="right" style="font-size:14px;font-weight:700;color:#24221f;padding:3px 0;font-variant-numeric:tabular-nums;white-space:nowrap;width:62%;">${escapeHtml(formatInr(data.totalPaise))}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- View Order CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin-bottom:20px;">
                <tr>
                  <td align="center">
                    <a href="${escapeHtml(orderUrl)}" class="mobile-btn" style="background:#4d2946;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:700;display:inline-block;max-width:100%;box-sizing:border-box;box-shadow:0 2px 6px rgba(77,41,70,0.25);">
                      View Order &amp; Status History
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:12px;line-height:18px;color:#766e65;text-align:center;word-break:break-word;overflow-wrap:anywhere;">
                Direct link: <a href="${escapeHtml(orderUrl)}" style="color:#4d2946;text-decoration:underline;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(orderUrl)}</a>
              </p>
            </td>
          </tr>

          <!-- Store Footer -->
          <tr>
            <td class="email-footer-td" style="padding:20px 24px;background:#f8f5ee;border-top:1px solid #e4ded5;font-size:13px;line-height:20px;color:#615955;box-sizing:border-box;word-break:break-word;overflow-wrap:anywhere;">
              <p style="margin:0 0 6px;font-weight:600;color:#24221f;">The ${escapeHtml(storeName)} Team</p>
              ${data.supportEmail ? `<p style="margin:0 0 4px;word-break:break-word;overflow-wrap:anywhere;">Have questions? Contact us at <a href="mailto:${escapeHtml(data.supportEmail)}" style="color:#4d2946;font-weight:600;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(data.supportEmail)}</a></p>` : ''}
              ${data.supportPhone ? `<p style="margin:0 0 4px;">Phone: ${escapeHtml(data.supportPhone)}</p>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
