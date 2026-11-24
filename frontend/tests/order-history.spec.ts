import { expect, test } from '@playwright/test';

const id = '11111111-1111-4111-8111-111111111111';
const createdAt = '2026-11-24T04:45:00.000Z';
const history = [
  { id: 'one', fromStatus: null, toStatus: 'PENDING_PAYMENT', label: 'Order Placed', paymentStatus: null, actorType: 'CUSTOMER', actor: null, note: null, internalNote: null, action: 'created', resumedFrom: null, createdAt },
  { id: 'two', fromStatus: 'PENDING_PAYMENT', toStatus: 'NEW', label: 'Payment Confirmed', paymentStatus: 'SUCCEEDED', actorType: 'SYSTEM', actor: null, note: 'Payment confirmed.', internalNote: 'Gateway reference', action: 'payment_captured', resumedFrom: null, createdAt: '2026-11-24T04:50:00.000Z' },
];
const order = { id, orderNumber: 'HL123', createdAt, status: 'NEW', paymentStatus: 'PAID', currency: 'INR', sourceMode: 'DIRECT', subtotalPaise: 10000, discountPaise: 0, automaticDiscountPaise: 0, couponDiscountPaise: 0, shippingPaise: 0, totalPaise: 10000, couponCode: null, shippingAddress: null, billingAddress: null, lines: [], payments: [], statusHistory: history.map(({ id, toStatus, label, note, createdAt }) => ({ id, toStatus, label, note, createdAt })) };

for (const width of [1280, 375]) {
  test(`customer history is readable and private at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.route('**/api/auth/refresh', route => route.fulfill({ json: { user: { id, name: 'Asha', email: 'asha@example.test', role: 'CUSTOMER' }, accessToken: 'test-token', expiresIn: 900 } }));
    await page.route(`**/api/orders/${id}`, route => route.fulfill({ json: order }));
    await page.goto(`/account/orders/${id}`);
    const timeline = page.getByRole('region', { name: 'Order Status History' });
    await expect(timeline.getByText('Order Placed')).toBeVisible();
    await expect(timeline.getByText('Payment Confirmed', { exact: true })).toBeVisible();
    await expect(timeline.getByText('24 Nov 2026')).toHaveCount(2);
    await expect(timeline).not.toContainText('Gateway reference');
    await expect(timeline).not.toContainText('asha@example.test');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
  test(`admin history refreshes after an action at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.route('**/api/auth/refresh', route => route.fulfill({ json: { user: { id, name: 'Store Admin', email: 'admin@example.test', role: 'ADMIN' }, accessToken: 'test-token', expiresIn: 900 } }));
    let status = 'NEW';
    await page.route(`**/api/admin/orders/${id}`, route => route.fulfill({ json: { ...order, status, email: 'asha@example.test', customerName: 'Asha', phone: null, deliveryAddress: null, billingAddress: null, taxPaise: null, giftFeePaise: 0, receivedPaise: 10000, shipments: [], adjustments: [], allowedActions: status === 'NEW' ? ['accept'] : [], statusHistory: status === 'NEW' ? history : [...history, { id: 'three', fromStatus: 'NEW', toStatus: 'ACCEPTED', label: 'Accepted', paymentStatus: null, actorType: 'ADMIN', actor: { name: 'Store Admin', email: 'admin@example.test' }, note: null, internalNote: null, action: 'accept', resumedFrom: null, createdAt: '2026-11-24T05:00:00.000Z' }] } }));
    await page.route(`**/api/admin/orders/${id}/actions`, route => { status = 'ACCEPTED'; return route.fulfill({ json: { status, allowedActions: [] } }); });
    await page.goto(`/admin/orders/${id}`);
    await expect(page.getByRole('heading', { name: 'Status History' })).toBeVisible();
    await page.getByRole('button', { name: 'Accept order' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText('Store Admin (admin@example.test)')).toBeVisible();
    await expect(page.getByText('Internal note: Gateway reference')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Status History' })).toBeVisible();
  });
}
