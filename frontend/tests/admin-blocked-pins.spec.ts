import { expect, test } from '@playwright/test';

test('admin shipping shows only blocked PINs and can block and unblock one', async ({ page }) => {
  const admin = { id: '11111111-1111-4111-8111-111111111111', name: 'Admin', email: 'admin@example.test', role: 'ADMIN' };
  let version = 0;
  let legacyRequests = 0;
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') pageErrors.push(message.location().url + ': ' + message.text()); });
  const blocked: { pinCode: string; supported: false; enabled: true; reason: string | null }[] = [];
  await page.route('**/api/auth/refresh', route => route.fulfill({ json: { user: admin, accessToken: 'test-token', expiresIn: 900 } }));
  await page.route('**/api/store/config', route => route.fulfill({ json: { storeName: 'Home & Lifestyle', market: 'India', currency: 'INR', language: 'English', timezone: 'Asia/Kolkata', gifting: {} } }));
  await page.route('**/api/cart/preview', route => route.fulfill({ json: { items: [], itemCount: 0, subtotalPaise: 0, automaticDiscountPaise: 0, couponDiscountPaise: 0, estimatedTotalPaise: 0, canCheckout: false, coupon: null } }));
  await page.route('**/api/admin/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/settings/shipping/rules') || url.pathname.endsWith('/settings/shipping/quote') || (url.pathname.endsWith('/settings/shipping') && route.request().method() === 'PATCH')) legacyRequests++;
    if (url.pathname.endsWith('/settings/shipping/pins') && route.request().method() === 'GET') {
      const search = url.searchParams.get('search') ?? '';
      const items = blocked.filter(row => row.pinCode.startsWith(search));
      return route.fulfill({ json: { items, total: items.length, page: 1, pageSize: 50 } });
    }
    if (url.pathname.endsWith('/settings/shipping/pins') && route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { pinCode: string; reason: string | null };
      blocked.push({ pinCode: body.pinCode, supported: false, enabled: true, reason: body.reason });
      return route.fulfill({ status: 201, json: { version: ++version, pinCode: body.pinCode } });
    }
    if (url.pathname.endsWith('/settings/shipping/pins/560001') && route.request().method() === 'DELETE') {
      blocked.splice(0, blocked.length);
      return route.fulfill({ json: { version: ++version, pinCode: '560001' } });
    }
    if (url.pathname.endsWith('/settings/shipping')) return route.fulfill({ json: { version, coveragePolicy: 'BLOCKLIST', thresholdBasis: 'AFTER_DISCOUNTS', waiveHandlingOnFree: false, currency: 'INR', weightUnit: 'grams', dimensionUnit: 'millimetres' } });
    return route.fulfill({ json: {} });
  });
  await page.goto('/admin/settings?section=shipping');
  await expect(page.getByText('All valid 6-digit Indian PIN codes are deliverable by default. Add only PIN codes where delivery is restricted or unavailable.')).toBeVisible();
  await expect(page.getByText('Shipping is included in product cost. Checkout adds ₹0 in separate shipping fees.')).toBeVisible();
  await expect(page.getByText('No restricted PIN codes match.')).toBeVisible();
  for (const name of ['Test Delivery', 'Shipping Charges', 'Charge rules']) await expect(page.getByRole('heading', { name })).toHaveCount(0);
  await page.getByLabel('Indian PIN code (required)').fill('000001');
  await expect(page.getByText('Enter a valid 6-digit Indian PIN code.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Restricted PIN Code' })).toBeDisabled();
  await page.getByLabel('Indian PIN code (required)').fill('560001');
  await page.getByLabel('Reason (optional)').fill('Courier unavailable');
  await page.getByRole('button', { name: 'Add Restricted PIN Code' }).click();
  await expect(page.getByText('560001', { exact: true })).toBeVisible();
  await expect(page.getByText('Courier unavailable', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  page.once('dialog', dialog => void dialog.accept());
  await page.getByRole('button', { name: 'Remove / Unrestrict' }).click();
  await expect(page.getByText('No restricted PIN codes match.')).toBeVisible();
  expect(legacyRequests).toBe(0);
  expect(pageErrors).toEqual([]);
});
