import { expect, test } from '@playwright/test';

const id = '11111111-1111-4111-8111-111111111111';
const createdAt = '2026-11-24T04:45:00.000Z';
const history = [
  { id: 'one', fromStatus: null, toStatus: 'PENDING_PAYMENT', label: 'Order Placed', paymentStatus: null, actorType: 'CUSTOMER', actor: null, note: null, internalNote: null, action: 'created', resumedFrom: null, createdAt },
  { id: 'two', fromStatus: 'PENDING_PAYMENT', toStatus: 'NEW', label: 'Payment Confirmed', paymentStatus: 'SUCCEEDED', actorType: 'SYSTEM', actor: null, note: 'Payment confirmed.', internalNote: 'Gateway reference', action: 'payment_captured', resumedFrom: null, createdAt: '2026-11-24T04:50:00.000Z' },
];
const simpleOrder = { id, orderNumber: 'HL123', createdAt, status: 'NEW', paymentStatus: 'PAID', currency: 'INR', sourceMode: 'DIRECT', subtotalPaise: 10000, discountPaise: 0, automaticDiscountPaise: 0, couponDiscountPaise: 0, shippingPaise: 0, totalPaise: 10000, couponCode: null, shippingAddress: null, billingAddress: null, lines: [], payments: [], statusHistory: history.map(({ id, toStatus, label, note, createdAt }) => ({ id, toStatus, label, note, createdAt })) };

const detailedOrder = {
  id: '22222222-2222-4222-8222-222222222222',
  orderNumber: 'HL-20261125-998877665544-LONGER-SUFFIX-12345',
  createdAt,
  status: 'PROCESSING',
  paymentStatus: 'PAID',
  currency: 'INR',
  sourceMode: 'CART',
  subtotalPaise: 2499900,
  discountPaise: 250000,
  automaticDiscountPaise: 100000,
  couponDiscountPaise: 150000,
  giftFeePaise: 19900,
  shippingPaise: 0,
  totalPaise: 2269800,
  couponCode: 'FESTIVECELEBRATION2026',
  shippingAddress: {
    recipient: 'Ananya Roy Chowdhury-Mukherjee',
    line1: 'Flat 402, Signature Tower B, Orchid Woods Lifestyle Residency',
    line2: 'Near Prestige Technopolis, Sarjapur Outer Ring Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    pinCode: '560103',
    phone: '9876543210'
  },
  billingAddress: {
    recipient: 'Ananya Roy Chowdhury-Mukherjee',
    line1: 'Flat 402, Signature Tower B, Orchid Woods Lifestyle Residency',
    line2: 'Near Prestige Technopolis, Sarjapur Outer Ring Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    pinCode: '560103',
    phone: '9876543210'
  },
  lines: [
    {
      id: 'line-1',
      productId: 'prod-1',
      productName: 'Handcrafted Terracotta Ceramic Urli with Floral Embossing',
      sku: 'TERRA-URLI-XL-ANTIQUE-BRONZE-001',
      quantity: 2,
      unitPricePaise: 499900,
      effectiveUnitPricePaise: 449900,
      totalPaise: 899800,
      giftWrapEnabled: true,
      giftWrapFeePaise: 19900,
      giftMessage: 'Wishing you endless warmth and celebration in your magnificent new home! From all of us at Kolkata.',
      image: { url: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=600&q=80', altText: 'Terracotta Urli' },
      attributes: [
        { title: 'Finish', value: 'Antique Weathered Bronze Finish' },
        { title: 'Size & Diameter', value: 'Extra Large 16 Inches Handcrafted' },
      ]
    },
    {
      id: 'line-2',
      productId: 'prod-2',
      productName: 'Pure Belgian Linen Tasseled Throw Pillow Cover',
      sku: 'LINEN-THROW-PLW-CORAL-50X50',
      quantity: 3,
      unitPricePaise: 450000,
      effectiveUnitPricePaise: 450000,
      totalPaise: 1350000,
      giftWrapEnabled: false,
      giftWrapFeePaise: 0,
      giftMessage: null,
      image: null,
      attributes: [
        { title: 'Color Palette', value: 'Terracotta Rose & Sunlit Mustard' }
      ]
    }
  ],
  payments: [
    {
      id: 'pay-1',
      providerPaymentId: 'pay_P1Q2R3S4T5U6V7W8X9Y0Z12345',
      paymentStatus: 'PAID',
      amountPaise: 2269800,
      failureReason: null
    }
  ],
  statusHistory: [
    ...history,
    { id: 'three', toStatus: 'PROCESSING', label: 'In Production & Inspection', note: 'Pieces carefully packed with protective recycled honeycomb wrap.', createdAt: '2026-11-24T06:00:00.000Z' }
  ]
};

for (const width of [1280, 390, 375, 360]) {
  test(`customer history is readable and private at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.route('**/api/auth/refresh', route => route.fulfill({ json: { user: { id, name: 'Asha', email: 'asha@example.test', role: 'CUSTOMER' }, accessToken: 'test-token', expiresIn: 900 } }));
    await page.route(`**/api/orders/${id}`, route => route.fulfill({ json: simpleOrder }));
    await page.goto(`/account/orders/${id}`);
    const timeline = page.getByRole('region', { name: 'Order Status History' });
    await expect(timeline.getByText('Order Placed')).toBeVisible();
    await expect(timeline.getByText('Payment Confirmed', { exact: true })).toBeVisible();
    await expect(timeline.getByText('24 Nov 2026')).toHaveCount(2);
    await expect(timeline).not.toContainText('Gateway reference');
    await expect(timeline).not.toContainText('asha@example.test');
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalOverflow).toBe(false);
  });

  test(`customer order details with rich content has zero horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.route('**/api/auth/refresh', route => route.fulfill({ json: { user: { id, name: 'Ananya', email: 'ananya@example.test', role: 'CUSTOMER' }, accessToken: 'test-token', expiresIn: 900 } }));
    await page.route(`**/api/orders/${id}`, route => route.fulfill({ json: detailedOrder }));
    await page.goto(`/account/orders/${id}`);

    // Confirm long order number heading is visible and readable
    await expect(page.getByRole('heading', { name: detailedOrder.orderNumber })).toBeVisible();

    // Confirm timeline is visible
    const timeline = page.getByRole('region', { name: 'Order Status History' });
    await expect(timeline.getByText('In Production & Inspection')).toBeVisible();

    // Confirm line items, attributes, gift wrapping callout are visible
    await expect(page.getByText('Handcrafted Terracotta Ceramic Urli')).toBeVisible();
    await expect(page.getByText('Antique Weathered Bronze Finish')).toBeVisible();
    await expect(page.getByText('Custom Gift Message:')).toBeVisible();

    // Confirm shipping address and price details
    await expect(page.getByText('Ananya Roy Chowdhury-Mukherjee').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Price details' })).toBeVisible();

    // Verify zero horizontal scrolling
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalOverflow).toBe(false);
  });

  test(`my orders list page has zero horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.route('**/api/auth/refresh', route => route.fulfill({ json: { user: { id, name: 'Ananya', email: 'ananya@example.test', role: 'CUSTOMER' }, accessToken: 'test-token', expiresIn: 900 } }));
    await page.route('**/api/orders', route => route.fulfill({ json: [detailedOrder, simpleOrder] }));
    await page.goto('/account/orders');

    await expect(page.getByRole('heading', { name: 'My Orders' })).toBeVisible();
    await expect(page.getByText(detailedOrder.orderNumber)).toBeVisible();

    // Verify zero horizontal scrolling
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalOverflow).toBe(false);
  });
}

for (const width of [1280, 375]) {
  test(`admin history refreshes after an action at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.route('**/api/auth/refresh', route => route.fulfill({ json: { user: { id, name: 'Store Admin', email: 'admin@example.test', role: 'ADMIN' }, accessToken: 'test-token', expiresIn: 900 } }));
    let status = 'NEW';
    await page.route(`**/api/admin/orders/${id}`, route => route.fulfill({ json: { ...simpleOrder, status, email: 'asha@example.test', customerName: 'Asha', phone: null, deliveryAddress: null, billingAddress: null, taxPaise: null, giftFeePaise: 0, receivedPaise: 10000, shipments: [], adjustments: [], allowedActions: status === 'NEW' ? ['accept'] : [], statusHistory: status === 'NEW' ? history : [...history, { id: 'three', fromStatus: 'NEW', toStatus: 'ACCEPTED', label: 'Accepted', paymentStatus: null, actorType: 'ADMIN', actor: { name: 'Store Admin', email: 'admin@example.test' }, note: null, internalNote: null, action: 'accept', resumedFrom: null, createdAt: '2026-11-24T05:00:00.000Z' }] } }));
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
