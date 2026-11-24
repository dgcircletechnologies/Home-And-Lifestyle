import { expect, test, type Page } from '@playwright/test';

const eligibleId = '11111111-1111-4111-8111-111111111111';
const ineligibleId = '22222222-2222-4222-8222-222222222222';
const lineId = '33333333-3333-4333-8333-333333333333';
const addressId = '44444444-4444-4444-8444-444444444444';
const orderId = '55555555-5555-4555-8555-555555555555';
const customer = { id: '66666666-6666-4666-8666-666666666666', name: 'Asha', email: 'asha@example.test', role: 'CUSTOMER' };
type Item = { variantId: string; quantity: number; itemId?: string; giftWrapSelected?: boolean; giftMessage?: string | null };
const quote = (items: Item[]) => {
  const lines = items.map(item => ({ itemId: item.itemId ?? null, variantId: item.variantId, quantity: item.quantity, product: { id: item.variantId, slug: item.variantId, name: item.variantId === eligibleId ? 'Giftable vase' : 'Plain plate', image: null }, variant: { id: item.variantId, sku: 'SKU', pricePaise: 10000, stockQuantity: 5, attributes: [] }, unitPricePaise: 10000, effectiveUnitPricePaise: 10000, automaticDiscountPaise: 0, couponDiscountPaise: 0, lineTotalPaise: 10000 * item.quantity, warning: null, isGiftWrapEligible: item.variantId === eligibleId, giftWrapPricePaise: item.variantId === eligibleId ? 2500 : 0, allowGiftMessage: item.variantId === eligibleId, giftWrapSelected: item.variantId === eligibleId && item.giftWrapSelected === true, giftMessage: item.variantId === eligibleId && item.giftWrapSelected ? item.giftMessage?.trim() || null : null }));
  const subtotalPaise = lines.reduce((sum, line) => sum + line.lineTotalPaise, 0);
  const giftWrapTotalPaise = lines.reduce((sum, line) => sum + (line.giftWrapSelected ? line.giftWrapPricePaise * line.quantity : 0), 0);
  return { currency: 'INR', items: lines, itemCount: lines.reduce((sum, line) => sum + line.quantity, 0), subtotalPaise, automaticDiscountPaise: 0, couponDiscountPaise: 0, giftWrapTotalPaise, estimatedTotalPaise: subtotalPaise + giftWrapTotalPaise, coupon: null, canCheckout: true, note: 'Prices are rechecked.' };
};
const address = { id: addressId, fullName: 'Asha', phone: '9876543210', line1: 'Market Road', line2: null, city: 'Pune', state: 'Maharashtra', pinCode: '411001', countryCode: 'IN', label: 'Home', isDefault: true };
async function baseRoutes(page: Page, signedIn: boolean) {
  await page.route('**/api/auth/refresh', route => route.fulfill(signedIn ? { json: { user: customer, accessToken: 'test-token', expiresIn: 900 } } : { status: 401, json: { error: { code: 'ACCESS_INVALID', message: 'Sign in.' } } }));
  await page.route('**/api/cart/preview', route => route.fulfill({ json: quote((route.request().postDataJSON() as { items: Item[] }).items) }));
  await page.route('**/api/addresses', route => route.fulfill({ json: [address] }));
}

for (const width of [1280, 375]) {
  test(`guest cart shows only eligible gift options and updates totals at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await baseRoutes(page, false);
    await page.addInitScript(ids => localStorage.setItem('hl_guest_cart_v1', JSON.stringify(ids.map(variantId => ({ variantId, quantity: 1 })))), [eligibleId, ineligibleId]);
    await page.goto('/cart');
    await expect(page.getByRole('checkbox', { name: /Add gift wrapping/ })).toHaveCount(1);
    await expect(page.locator('.store-cart-total strong').getByText('₹200', { exact: true })).toBeVisible();
    await page.getByRole('checkbox', { name: /Add gift wrapping/ }).click();
    await expect(page.getByRole('checkbox', { name: /Add gift wrapping/ })).toBeChecked();
    await expect(page.getByText('Gift Wrapping', { exact: true })).toBeVisible();
    await expect(page.getByText('₹225', { exact: true })).toBeVisible();
    await page.getByLabel(/Custom Gift Message/).fill('Happy home!');
    await page.getByLabel(/Custom Gift Message/).blur();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('hl_guest_cart_v1') || '[]')[0]?.giftMessage)).toBe('Happy home!');
    await page.getByRole('checkbox', { name: /Add gift wrapping/ }).uncheck();
    await expect(page.getByText('Gift Wrapping', { exact: true })).toHaveCount(0);
    await expect(page.locator('.store-cart-total strong').getByText('₹200', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });

  test(`cart and direct checkout submit selected gift options at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await baseRoutes(page, true);
    let selection: Item = { variantId: eligibleId, quantity: 1, itemId: lineId };
    let submitted: Record<string, unknown> | null = null;
    await page.route(/\/api\/cart(?:\?.*)?$/, route => route.fulfill({ json: quote([selection]) }));
    await page.route(`**/api/cart/items/${lineId}/gift`, route => { selection = { ...selection, ...(route.request().postDataJSON() as Item) }; return route.fulfill({ json: quote([selection]) }); });
    await page.route('**/api/orders/checkout', route => { submitted = route.request().postDataJSON() as Record<string, unknown>; return route.fulfill({ status: 400, json: { error: { code: 'CHECKOUT_INVALID', message: 'Test payment stopped.' } } }); });
    await page.goto('/checkout');
    await expect(page.getByRole('checkbox', { name: /Add gift wrapping/ })).toBeVisible();
    await page.getByRole('checkbox', { name: /Add gift wrapping/ }).check();
    await expect(page.getByText('₹125', { exact: true })).toBeVisible();
    await page.getByLabel(/Custom Gift Message/).fill('For your new space');
    await page.getByRole('button', { name: 'Proceed to Payment' }).click();
    await expect.poll(() => (submitted as { giftOptions?: Item[] } | null)?.giftOptions?.[0]?.giftMessage).toBe('For your new space');
    await page.goto(`/checkout?mode=direct&variantId=${eligibleId}&quantity=1`);
    await page.getByRole('checkbox', { name: /Add gift wrapping/ }).check();
    await page.getByLabel(/Custom Gift Message/).fill('Direct gift');
    await page.getByRole('button', { name: 'Proceed to Payment' }).click();
    await expect.poll(() => (submitted as { giftMessage?: string } | null)?.giftMessage).toBe('Direct gift');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.goto(`/checkout?mode=direct&variantId=${ineligibleId}&quantity=1`);
    await expect(page.getByRole('checkbox', { name: /Add gift wrapping/ })).toHaveCount(0);
  });
}

for (const width of [1280, 375]) {
  test(`customer and admin order details show snapshotted gift message at ${width}px`, async ({ browser }) => {
    const wrappedLine = { id: lineId, productName: 'Giftable vase', variantName: 'SKU', sku: 'SKU', quantity: 1, unitPricePaise: 10000, effectiveUnitPricePaise: 10000, discountPaise: 0, taxPaise: null, totalPaise: 10000, attributes: [], image: null, optionsSnapshot: {}, giftWrapEnabled: true, giftWrapFeePaise: 2500, giftMessage: 'For your new space' };
    const order = { id: orderId, orderNumber: 'HL-GIFT', createdAt: new Date().toISOString(), status: 'NEW', paymentStatus: 'PAID', currency: 'INR', sourceMode: 'DIRECT', subtotalPaise: 10000, discountPaise: 0, automaticDiscountPaise: 0, couponDiscountPaise: 0, shippingPaise: 0, giftFeePaise: 2500, totalPaise: 12500, couponCode: null, shippingAddress: null, billingAddress: null, deliveryAddress: null, lines: [wrappedLine], payments: [], statusHistory: [], shipments: [], adjustments: [], customerName: 'Asha', email: 'asha@example.test', phone: null, receivedPaise: 12500, allowedActions: [] };
    for (const role of ['CUSTOMER', 'ADMIN']) {
      const context = await browser.newContext({ viewport: { width, height: 850 } });
      const page = await context.newPage();
      await page.route('**/api/auth/refresh', route => route.fulfill({ json: { user: { ...customer, role }, accessToken: 'test-token', expiresIn: 900 } }));
      await page.route(`**/api/${role === 'ADMIN' ? 'admin/' : ''}orders/${orderId}`, route => route.fulfill({ json: order }));
      await page.goto(role === 'ADMIN' ? `/admin/orders/${orderId}` : `/account/orders/${orderId}`);
      await expect(page.getByText(role === 'ADMIN' ? 'Gift Wrapping Requested' : 'Gift Wrapped')).toBeVisible();
      await expect(page.getByText('For your new space')).toBeVisible();
      await expect(page.getByText('Gift Wrapping', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await context.close();
    }
  });
}
