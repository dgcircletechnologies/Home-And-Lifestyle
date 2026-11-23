const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { Buffer } = require('node:buffer');
const { CustomerPaymentsService } = require('../dist/src/payments/customer-payments.service.js');
const { RazorpayClient } = require('../dist/src/payments/razorpay-client.js');

test('missing gateway configuration returns a clean service error', () => {
  const previous = Object.fromEntries(['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_API_BASE_URL', 'RAZORPAY_CURRENCY'].map(key => [key, process.env[key]]));
  try { for (const key of Object.keys(previous)) delete process.env[key]; assert.throws(() => new RazorpayClient().config(), error => error.getStatus() === 503 && error.getResponse().code === 'RAZORPAY_NOT_CONFIGURED'); }
  finally { for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});

function fixture(sourceMode = 'CART', stock = 3) {
  const state = { order: { id: 'order-1', status: 'PENDING_PAYMENT', sourceMode, customerId: 'customer-1', couponCodeSnapshot: sourceMode === 'CART' ? 'WELCOME10' : null, lines: [{ variantIdSnapshot: 'variant-1', quantity: 2, optionsSnapshot: { cartLineId: 'cartline-1' }, discountsSnapshot: { couponPaise: sourceMode === 'CART' ? 1000 : 0 } }] }, payment: { id: 'attempt-1', orderId: 'order-1', provider: 'RAZORPAY', providerAccount: 'test-key', providerOrderId: 'rpay-order-1', providerPaymentId: null, amountPaise: 100000, currency: 'INR', status: 'PENDING' }, extraPayments: [], stock, cartLines: 2, redemptionCount: 0, events: {} };
  const db = { user: { findUnique: async () => ({ id: 'user-1', customerId: 'customer-1' }) }, paymentAttempt: { findFirst: async () => state.payment }, paymentEvent: { create: async () => ({}), upsert: async ({ where }) => { const key = where.provider_providerAccount_providerEventId.providerEventId; return state.events[key] ||= { id: key, processedAt: null }; }, update: async ({ where, data }) => Object.assign(state.events[where.id], data) }, $transaction: async fn => {
    const next = JSON.parse(JSON.stringify(state));
    const tx = { $queryRaw: async () => [], order: { findUnique: async () => ({ ...next.order, payments: [next.payment, ...next.extraPayments] }), update: async ({ data }) => Object.assign(next.order, data) }, productVariant: { updateMany: async ({ where, data }) => { if (next.stock < where.stockQuantity.gte) return { count: 0 }; next.stock -= data.stockQuantity.decrement; return { count: 1 }; } }, coupon: { findFirst: async () => ({ id: 'coupon-1' }) }, couponRedemption: { create: async () => { next.redemptionCount++; } }, paymentAttempt: { update: async ({ data }) => Object.assign(next.payment, data), create: async ({ data }) => { next.extraPayments.push({ id: `extra-${next.extraPayments.length + 1}`, ...data }); } }, user: { findUnique: async () => ({ id: 'user-1' }) }, cartLine: { findFirst: async () => next.cartLines ? { id: 'cartline-1', quantity: next.cartLines } : null, update: async ({ data }) => { next.cartLines = data.quantity; }, delete: async () => { next.cartLines = 0; } } };
    const result = await fn(tx); Object.assign(state, next); return result;
  } };
  const gateway = { config: () => ({ keyId: 'test-key', secret: 'test-secret', webhookSecret: 'webhook-secret' }), validSignature: RazorpayClient.prototype.validSignature, payment: async id => ({ id, order_id: 'rpay-order-1', amount: 100000, currency: 'INR', status: 'captured' }), orderPayments: async () => ({ items: [{ id: 'pay-1', order_id: 'rpay-order-1', amount: 100000, currency: 'INR', status: 'captured' }] }) };
  return { state, service: new CustomerPaymentsService(db, gateway), gateway };
}

test('captured cart payment decrements stock, redeems once, clears cart once, and replays safely', async () => {
  const { state, service } = fixture();
  const attempt = state.payment;
  assert.equal((await service.finalize(attempt, 'pay-1')).status, 'PAID');
  assert.equal(state.stock, 1); assert.equal(state.cartLines, 0); assert.equal(state.redemptionCount, 1); assert.equal(state.order.status, 'NEW');
  assert.equal((await service.finalize(attempt, 'pay-1')).replayed, true);
  assert.equal(state.stock, 1); assert.equal(state.redemptionCount, 1);
});

test('direct payment leaves cart alone; a failed payment leaves stock and cart untouched', async () => {
  const direct = fixture('DIRECT'); await direct.service.finalize(direct.state.payment, 'pay-1');
  assert.equal(direct.state.cartLines, 2); assert.equal(direct.state.redemptionCount, 0);
  const failed = fixture(); await failed.service.fail('user-1', { orderId: 'order-1', razorpayOrderId: 'rpay-order-1', reason: 'Closed' });
  assert.equal(failed.state.payment.status, 'FAILED'); assert.equal(failed.state.stock, 3); assert.equal(failed.state.cartLines, 2);
});

test('cart finalization leaves quantities added after initiation in the cart', async () => {
  const { state, service } = fixture(); state.cartLines = 3;
  await service.finalize(state.payment, 'pay-1');
  assert.equal(state.cartLines, 1);
});

test('captured payment with insufficient stock is flagged without negative stock or cart clearing', async () => {
  const { state, service } = fixture('CART', 1);
  assert.equal((await service.finalize(state.payment, 'pay-1')).status, 'EXCEPTION');
  assert.equal(state.stock, 1); assert.equal(state.cartLines, 2); assert.equal(state.redemptionCount, 0); assert.equal(state.order.status, 'PAYMENT_EXCEPTION');
});

test('a distinct second capture is retained and flagged without a second stock decrement', async () => {
  const { state, service } = fixture();
  await service.finalize(state.payment, 'pay-1');
  assert.equal((await service.finalize(state.payment, 'pay-2')).status, 'EXCEPTION');
  assert.equal(state.stock, 1); assert.equal(state.redemptionCount, 1); assert.equal(state.order.status, 'PAYMENT_EXCEPTION');
  assert.equal(state.payment.providerPaymentId, 'pay-1'); assert.equal(state.extraPayments[0].providerPaymentId, 'pay-2');
});

test('checkout signature is timing-safe checked and provider capture is checked before finalization', async () => {
  const { state, service, gateway } = fixture();
  const signature = createHmac('sha256', 'test-secret').update('rpay-order-1|pay-1').digest('hex');
  await assert.rejects(service.verify('user-1', { orderId: 'order-1', razorpayOrderId: 'rpay-order-1', razorpayPaymentId: 'pay-1', razorpaySignature: '0'.repeat(64) }), error => error.getStatus() === 400);
  assert.equal(state.stock, 3);
  gateway.payment = async () => ({ id: 'pay-1', order_id: 'rpay-order-1', amount: 100000, currency: 'INR', status: 'authorized' });
  await assert.rejects(service.verify('user-1', { orderId: 'order-1', razorpayOrderId: 'rpay-order-1', razorpayPaymentId: 'pay-1', razorpaySignature: signature }), error => error.getStatus() === 409);
  assert.equal(state.stock, 3);
  gateway.payment = async () => ({ id: 'pay-1', order_id: 'rpay-order-1', amount: 100000, currency: 'INR', status: 'captured' });
  assert.equal((await service.verify('user-1', { orderId: 'order-1', razorpayOrderId: 'rpay-order-1', razorpayPaymentId: 'pay-1', razorpaySignature: signature })).status, 'PAID');
});

test('raw-body webhook accepts order.paid without a payment entity and deduplicates by header event ID', async () => {
  const { state, service } = fixture();
  const body = Buffer.from(JSON.stringify({ event: 'order.paid', payload: { order: { entity: { id: 'rpay-order-1' } } } }));
  const signature = createHmac('sha256', 'webhook-secret').update(body).digest('hex');
  await assert.rejects(service.webhook(body, '0'.repeat(64), 'event-1'), error => error.getStatus() === 401);
  assert.equal((await service.webhook(body, signature, 'event-1')).received, true);
  assert.equal(state.stock, 1); assert.equal(state.redemptionCount, 1);
  assert.equal((await service.webhook(body, signature, 'event-1')).replayed, true);
  assert.equal(state.stock, 1); assert.equal(state.redemptionCount, 1);
});
