const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const {
  orderConfirmationEmail,
  paymentFailedEmail,
  orderStatusUpdateEmail,
} = require('../dist/src/orders/order-email-templates.js');
const { OrderMailService } = require('../dist/src/orders/order-mail.service.js');
const { CustomerPaymentsService } = require('../dist/src/payments/customer-payments.service.js');
const { AdminOrdersService } = require('../dist/src/orders/admin-orders.service.js');

test('orderConfirmationEmail generates brand-aligned HTML and plain text with items, gift options, INR breakdown, and track link', () => {
  const email = orderConfirmationEmail({
    storeName: 'Home & <Lifestyle>',
    supportEmail: 'care@homeandlifestyle.in',
    supportPhone: '+91 98765 43210',
    publicAddress: 'Indiranagar, Bangalore, India',
    frontendUrl: 'https://homeandlifestyle.in',
    customerName: '<Aarav> Sharma',
    orderNumber: 'HL-20261124-ABCD',
    orderId: '00000000-0000-0000-0000-000000000001',
    createdAt: new Date('2026-11-26T10:00:00Z'),
    paymentReference: 'pay_test_987654321',
    lines: [
      {
        productName: 'Terracotta Vase',
        variantName: 'Rustic Ochre / Medium',
        sku: 'TC-VASE-OCHRE-M',
        quantity: 2,
        unitPricePaise: 149900,
        totalPaise: 299800,
        attributes: { Finish: 'Matte Ochre', Height: '24cm' },
        giftWrapped: true,
        giftMessage: 'Happy New Home!',
      },
    ],
    subtotalPaise: 299800,
    discountPaise: 20000,
    couponDiscountPaise: 29900,
    couponCode: 'WELCOME10',
    giftFeePaise: 10000,
    shippingPaise: 0,
    totalPaise: 259900,
    shippingAddress: {
      recipient: 'Aarav Sharma',
      phone: '+91 98765 43210',
      line1: 'Flat 402, Lotus Residency',
      line2: '12th Main, HAL 2nd Stage',
      city: 'Bengaluru',
      state: 'Karnataka',
      pinCode: '560038',
    },
    orderGiftMessage: 'Happy New Home, enjoy the vase!',
    orderGiftWrapped: true,
  });

  // Subject line
  assert.equal(email.subject, 'Order Confirmed — #HL-20261124-ABCD | Home & <Lifestyle>');

  // HTML checks
  assert.match(email.html, /Home &amp; &lt;Lifestyle&gt;/);
  assert.match(email.html, /Hello &lt;Aarav&gt;,/);
  assert.match(email.html, /#HL-20261124-ABCD/);
  assert.match(email.html, /Terracotta Vase/);
  assert.match(email.html, /TC-VASE-OCHRE-M/);
  assert.match(email.html, /Finish: Matte Ochre/);
  assert.match(email.html, /Happy New Home, enjoy the vase!/);
  assert.match(email.html, /pay_test_987654321/);
  assert.match(email.html, /₹2,599/);
  assert.match(email.html, /Free \(Included\)/);
  assert.match(email.html, /WELCOME10/);
  assert.match(email.html, /Flat 402, Lotus Residency/);
  assert.match(email.html, /560038/);
  assert.match(email.html, /https:\/\/homeandlifestyle\.in\/account\/orders\/00000000-0000-0000-0000-000000000001/);
  assert.match(email.html, /Track Your Order/);
  assert.doesNotMatch(email.html, /<Aarav>/);

  // Plain text checks
  assert.match(email.text, /Hello <Aarav>,/);
  assert.match(email.text, /Order Number: #HL-20261124-ABCD/);
  assert.match(email.text, /Terracotta Vase \(Qty: 2\)/);
  assert.match(email.text, /SKU: TC-VASE-OCHRE-M/);
  assert.match(email.text, /Coupon Discount \(WELCOME10\): -₹299/);
  assert.match(email.text, /Total Paid: ₹2,599/);
  assert.match(email.text, /560038/);
  assert.match(email.text, /https:\/\/homeandlifestyle\.in\/account\/orders\/00000000-0000-0000-0000-000000000001/);
});

test('paymentFailedEmail provides reassuring message, safe failure reason, and working retry link', () => {
  const email = paymentFailedEmail({
    storeName: 'Home & Lifestyle',
    supportEmail: 'help@homeandlifestyle.in',
    frontendUrl: 'https://homeandlifestyle.in',
    customerName: 'Priya Patel',
    orderNumber: 'HL-20261124-FAIL',
    orderId: '00000000-0000-0000-0000-000000000002',
    totalPaise: 429900,
    failureReason: 'The bank declined the transaction due to insufficient limit.',
    itemCount: 3,
  });

  assert.equal(email.subject, 'Payment Unsuccessful for Order #HL-20261124-FAIL | Home & Lifestyle');
  assert.match(email.html, /Your payment didn’t go through/);
  assert.match(email.html, /The bank declined the transaction due to insufficient limit\./);
  assert.match(email.html, /₹4,299/);
  assert.match(email.html, /3 items/);
  assert.match(email.html, /Retry Payment/);
  assert.match(email.html, /https:\/\/homeandlifestyle\.in\/account\/orders\/00000000-0000-0000-0000-000000000002/);

  assert.match(email.text, /Hello Priya,/);
  assert.match(email.text, /payment for order #HL-20261124-FAIL was not completed/);
  assert.match(email.text, /Order Total: ₹4,299/);
  assert.match(email.text, /https:\/\/homeandlifestyle\.in\/account\/orders\/00000000-0000-0000-0000-000000000002/);
});

test('orderStatusUpdateEmail formats status transitions, highlights tracking/courier callout when present, and strictly omits internal notes', () => {
  // Test Shipped status with tracking details
  const shippedEmail = orderStatusUpdateEmail({
    storeName: 'Home & Lifestyle',
    supportEmail: 'care@homeandlifestyle.in',
    frontendUrl: 'https://homeandlifestyle.in',
    customerName: 'Meera Sen',
    orderNumber: 'HL-20261124-SHIP',
    orderId: '00000000-0000-0000-0000-000000000003',
    status: 'SHIPPED',
    action: 'dispatch',
    updatedAt: new Date('2026-11-26T12:00:00Z'),
    totalPaise: 349900,
    itemCount: 1,
    carrier: 'BlueDart Express',
    trackingNumber: 'BD-9988776655',
    trackingUrl: 'https://track.bluedart.com/BD-9988776655',
    estimatedDeliveryAt: '28 Nov 2026',
    customerNote: 'Tracking number: BD-9988776655',
  });

  assert.match(shippedEmail.subject, /Your order is on the way — #HL-20261124-SHIP | Home & Lifestyle/);
  assert.match(shippedEmail.html, /Shipped/);
  assert.match(shippedEmail.html, /BlueDart Express/);
  assert.match(shippedEmail.html, /BD-9988776655/);
  assert.match(shippedEmail.html, /https:\/\/track\.bluedart\.com\/BD-9988776655/);
  assert.match(shippedEmail.html, /Track Courier Shipment/);
  assert.match(shippedEmail.html, /28 Nov 2026/);
  assert.match(shippedEmail.html, /View Order &amp; Status History/);

  assert.match(shippedEmail.text, /Courier \/ Carrier: BlueDart Express/);
  assert.match(shippedEmail.text, /Tracking ID \/ AWB: BD-9988776655/);
  assert.match(shippedEmail.text, /Track Link: https:\/\/track\.bluedart\.com\/BD-9988776655/);

  // Strict Privacy: Never include internal notes or admin personal identifiers
  const internalSecretNote = 'CONFIDENTIAL_ADMIN_NOTE_12345';
  const adminEmail = 'admin.private@internal-system.local';
  assert.doesNotMatch(shippedEmail.html, new RegExp(internalSecretNote));
  assert.doesNotMatch(shippedEmail.html, new RegExp(adminEmail));
  assert.doesNotMatch(shippedEmail.text, new RegExp(internalSecretNote));
  assert.doesNotMatch(shippedEmail.text, new RegExp(adminEmail));

  // Test other transitions: Accepted and Delivered
  const acceptedEmail = orderStatusUpdateEmail({
    storeName: 'Home & Lifestyle',
    frontendUrl: 'https://homeandlifestyle.in',
    customerName: 'Meera Sen',
    orderNumber: 'HL-20261124-ACC',
    orderId: '00000000-0000-0000-0000-000000000004',
    status: 'ACCEPTED',
    updatedAt: new Date(),
    totalPaise: 199900,
    itemCount: 2,
  });
  assert.match(acceptedEmail.subject, /Your order has been accepted/);
  assert.match(acceptedEmail.html, /Accepted/);

  const deliveredEmail = orderStatusUpdateEmail({
    storeName: 'Home & Lifestyle',
    frontendUrl: 'https://homeandlifestyle.in',
    customerName: 'Meera Sen',
    orderNumber: 'HL-20261124-DEL',
    orderId: '00000000-0000-0000-0000-000000000005',
    status: 'DELIVERED',
    updatedAt: new Date(),
    totalPaise: 199900,
    itemCount: 2,
  });
  assert.match(deliveredEmail.subject, /Package delivered/);
  assert.match(deliveredEmail.html, /Delivered/);
});

test('CustomerPaymentsService verify + webhook deduplication sends only 1 order confirmation email', async () => {
  let confirmationEmailCount = 0;
  const mockOrderMail = {
    sendOrderConfirmation: async () => {
      confirmationEmailCount++;
      return 'sent';
    },
    sendPaymentFailed: async () => 'sent',
    sendOrderStatusUpdate: async () => 'sent',
  };

  const state = {
    order: {
      id: 'order-email-test-1',
      status: 'PENDING_PAYMENT',
      sourceMode: 'CART',
      customerId: 'cust-1',
      couponCodeSnapshot: null,
      lines: [{ variantIdSnapshot: 'var-1', quantity: 1, optionsSnapshot: {}, discountsSnapshot: {} }],
    },
    payment: {
      id: 'pay-att-1',
      orderId: 'order-email-test-1',
      provider: 'RAZORPAY',
      providerAccount: 'test-key',
      providerOrderId: 'rpay-ord-1',
      providerPaymentId: null,
      amountPaise: 150000,
      currency: 'INR',
      status: 'PENDING',
    },
    events: {},
  };

  const db = {
    user: { findUnique: async () => ({ id: 'usr-1', customerId: 'cust-1' }) },
    paymentAttempt: { findFirst: async () => state.payment },
    paymentEvent: {
      create: async () => ({}),
      upsert: async ({ where }) => {
        const k = where.provider_providerAccount_providerEventId.providerEventId;
        return (state.events[k] ||= { id: k, processedAt: null });
      },
      update: async ({ where, data }) => Object.assign(state.events[where.id], data),
    },
    $transaction: async (fn) => {
      const next = JSON.parse(JSON.stringify(state));
      const tx = {
        $queryRaw: async () => [],
        order: {
          findUnique: async () => ({ ...next.order, payments: [next.payment] }),
          update: async ({ data }) => Object.assign(next.order, data),
        },
        productVariant: { updateMany: async () => ({ count: 1 }) },
        paymentAttempt: { update: async ({ data }) => Object.assign(next.payment, data) },
        orderStatusHistory: { create: async () => ({}) },
        user: { findUnique: async () => ({ id: 'usr-1' }) },
        cartLine: { findFirst: async () => null },
      };
      const res = await fn(tx);
      Object.assign(state, next);
      return res;
    },
  };

  const razorpay = {
    config: () => ({ keyId: 'test-key', secret: 'test-secret', webhookSecret: 'test-webhook-secret' }),
    validSignature: () => true,
    payment: async (id) => ({ id, order_id: 'rpay-ord-1', amount: 150000, currency: 'INR', status: 'captured' }),
    orderPayments: async () => ({ items: [{ id: 'pay_capture_1', order_id: 'rpay-ord-1', amount: 150000, currency: 'INR', status: 'captured' }] }),
  };

  const service = new CustomerPaymentsService(db, razorpay, mockOrderMail);

  // 1. First trigger: verify endpoint
  const verifyResult = await service.verify('usr-1', {
    orderId: 'order-email-test-1',
    razorpayOrderId: 'rpay-ord-1',
    razorpayPaymentId: 'pay_capture_1',
    razorpaySignature: 'a'.repeat(64),
  });
  assert.equal(verifyResult.status, 'PAID');
  assert.equal(verifyResult.replayed, false);
  assert.equal(confirmationEmailCount, 1);

  // 2. Second trigger: Razorpay webhook hits shortly after for the same payment
  const webhookBody = Buffer.from(
    JSON.stringify({
      event: 'order.paid',
      payload: {
        payment: { entity: { id: 'pay_capture_1', order_id: 'rpay-ord-1', status: 'captured', amount: 150000, currency: 'INR' } },
      },
    }),
  );

  const webhookResult = await service.webhook(webhookBody, 'dummy-signature', 'evt_123456');
  assert.equal(webhookResult.received, true);
  // Email count MUST still be 1 (strictly deduplicated and idempotent)
  assert.equal(confirmationEmailCount, 1);
});

test('AdminOrdersService triggers status update email on status transition and ignores replays', async () => {
  let statusUpdateCalls = [];
  const mockOrderMail = {
    sendOrderStatusUpdate: async (id, opts) => {
      statusUpdateCalls.push({ id, opts });
      return 'sent';
    },
  };

  const orderState = {
    id: '00000000-0000-0000-0000-000000000010',
    status: 'NEW',
    lines: [{ id: 'line-1', quantity: 2 }],
    shipments: [],
    statusHistory: [],
  };

  const db = {
    $transaction: async (fn) => {
      const tx = {
        $queryRaw: async () => [],
        order: {
          findUnique: async () => ({ ...orderState }),
          update: async ({ data }) => {
            orderState.status = data.status;
            return { id: orderState.id, status: data.status, updatedAt: new Date() };
          },
        },
        orderStatusHistory: {
          create: async ({ data }) => {
            orderState.statusHistory.push(data);
            return { id: 'hist-1', ...data };
          },
        },
        shipment: {
          create: async ({ data }) => {
            const ship = { id: 'ship-1', ...data, lines: [] };
            orderState.shipments.push(ship);
            return ship;
          },
          updateMany: async () => ({ count: 1 }),
        },
        shipmentLine: { createMany: async () => ({ count: 1 }) },
      };
      return fn(tx);
    },
  };

  const adminService = new AdminOrdersService(db, mockOrderMail);

  // Transition: accept
  const resAccept = await adminService.act('00000000-0000-0000-0000-000000000010', 'admin-1', { action: 'accept' });
  assert.equal(resAccept.status, 'ACCEPTED');
  assert.equal(statusUpdateCalls.length, 1);
  assert.equal(statusUpdateCalls[0].opts.targetStatus, 'ACCEPTED');

  // Replay of same action: replayed=true, should NOT send duplicate email
  const resReplay = await adminService.act('00000000-0000-0000-0000-000000000010', 'admin-1', { action: 'accept' });
  assert.equal(resReplay.replayed, true);
  assert.equal(statusUpdateCalls.length, 1);
});

test('SMTP Down Resilience: Unreachable/invalid SMTP does not throw or crash API transitions', async () => {
  const previous = {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    sender: process.env.MAIL_FROM,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  };

  try {
    // Point to non-existent / unreachable port with instant failure
    process.env.SMTP_HOST = '127.0.0.1';
    process.env.SMTP_PORT = '9999';
    process.env.MAIL_FROM = 'noreply@homeandlifestyle.in';
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;

    const mockDb = {
      storeSettings: {
        findUnique: async () => ({ storeName: 'Home & Lifestyle', supportEmail: 'care@homeandlifestyle.in' }),
      },
      order: {
        findUnique: async () => ({
          id: '00000000-0000-0000-0000-000000000099',
          orderNumber: 'HL-TEST-SMTP',
          email: 'customer@example.test',
          currency: 'INR',
          status: 'NEW',
          subtotalPaise: 100000,
          discountPaise: 0,
          giftFeePaise: 0,
          shippingPaise: 0,
          totalPaise: 100000,
          createdAt: new Date(),
          deliveryAddress: { recipient: 'Test Customer', line1: 'Street', city: 'City', pinCode: '110001' },
          lines: [{ productName: 'Lamp', quantity: 1, unitPricePaise: 100000, totalPaise: 100000, sku: 'LAMP-1' }],
          payments: [{ providerPaymentId: 'pay_test', status: 'SUCCEEDED' }],
          shipments: [],
          customer: { name: 'Test Customer' },
        }),
      },
    };

    const realMailService = new OrderMailService(mockDb);

    // 1. Order Confirmation Send: does not throw, safely returns 'failed'
    const confResult = await realMailService.sendOrderConfirmation('00000000-0000-0000-0000-000000000099');
    assert.equal(confResult, 'failed');

    // 2. Payment Failed Send: does not throw, safely returns 'failed'
    const failResult = await realMailService.sendPaymentFailed('00000000-0000-0000-0000-000000000099', { reason: 'Timeout' });
    assert.equal(failResult, 'failed');

    // 3. Status Update Send: does not throw, safely returns 'failed'
    const statusResult = await realMailService.sendOrderStatusUpdate('00000000-0000-0000-0000-000000000099', {
      action: 'dispatch',
      targetStatus: 'SHIPPED',
      carrier: 'Delhivery',
      trackingNumber: 'DEL-12345',
    });
    assert.equal(statusResult, 'failed');
  } finally {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test('email templates include viewport meta, x-apple reformatting disable, fluid container and responsive mobile classes', () => {
  const conf = orderConfirmationEmail({
    storeName: 'Home & Lifestyle',
    frontendUrl: 'https://homeandlifestyle.in',
    customerName: 'Aarav',
    orderNumber: 'HL-1234',
    orderId: '00000000-0000-0000-0000-000000000001',
    createdAt: new Date(),
    lines: [{ productName: 'Vase', sku: 'V1', quantity: 1, unitPricePaise: 100000, totalPaise: 100000 }],
    subtotalPaise: 100000,
    discountPaise: 0,
    couponDiscountPaise: 0,
    giftFeePaise: 0,
    shippingPaise: 0,
    totalPaise: 100000,
    shippingAddress: null,
  });

  const fail = paymentFailedEmail({
    storeName: 'Home & Lifestyle',
    frontendUrl: 'https://homeandlifestyle.in',
    customerName: 'Aarav',
    orderNumber: 'HL-1234',
    orderId: '00000000-0000-0000-0000-000000000001',
    totalPaise: 100000,
    itemCount: 1,
  });

  const update = orderStatusUpdateEmail({
    storeName: 'Home & Lifestyle',
    frontendUrl: 'https://homeandlifestyle.in',
    customerName: 'Aarav',
    orderNumber: 'HL-1234',
    orderId: '00000000-0000-0000-0000-000000000001',
    status: 'SHIPPED',
    updatedAt: new Date(),
    totalPaise: 100000,
    itemCount: 1,
    carrier: 'BlueDart',
    trackingNumber: '123456',
  });

  for (const html of [conf.html, fail.html, update.html]) {
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1\.0">/);
    assert.match(html, /<meta name="x-apple-disable-message-reformatting">/);
    assert.match(html, /max-width:600px/);
    assert.doesNotMatch(html, /width="600"/);
    assert.match(html, /\.mobile-btn/);
    assert.match(html, /\.mobile-header-stack/);
    assert.match(html, /\.mobile-header-badge/);
    assert.match(html, /table-layout:fixed/);
  }
});
