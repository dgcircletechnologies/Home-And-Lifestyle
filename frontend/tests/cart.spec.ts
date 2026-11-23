import { expect, test, type Page } from '@playwright/test';

const vase = { id: '11111111-1111-4111-8111-111111111111', name: 'Ceramic vase', slug: 'ceramic-vase', description: 'A vase.', story: null, image: null, images: [], categories: [{ name: 'Decor', slug: 'decor' }], variants: [
  { id: 'large', sku: 'VASE-L', pricePaise: 120000, effectivePricePaise: 100000, compareAtPricePaise: 120000, stockQuantity: 3, available: true, attributes: [{ title: 'Size', value: 'Large' }, { title: 'Color', value: 'Terracotta' }] },
  { id: 'small', sku: 'VASE-S', pricePaise: 70000, effectivePricePaise: 60000, compareAtPricePaise: 70000, stockQuantity: 2, available: true, attributes: [{ title: 'Size', value: 'Small' }] },
] };
type Item = { variantId: string; quantity: number; itemId?: string };
function summary(items: Item[], code?: string) {
  const lines = items.map(item => { const variant = vase.variants.find(row => row.id === item.variantId)!; return { ...item, itemId: item.itemId ?? null, product: { id: vase.id, name: vase.name, slug: vase.slug, image: null }, variant: { id: variant.id, sku: variant.sku, pricePaise: variant.pricePaise, stockQuantity: variant.stockQuantity, attributes: variant.attributes }, unitPricePaise: variant.pricePaise, effectiveUnitPricePaise: variant.effectivePricePaise, automaticDiscountPaise: (variant.pricePaise - variant.effectivePricePaise) * item.quantity, couponDiscountPaise: 0, lineTotalPaise: variant.effectivePricePaise * item.quantity, warning: item.quantity > variant.stockQuantity ? `Only ${variant.stockQuantity} available.` : null }; });
  const valid = code === 'WELCOME10';
  const subtotalPaise = lines.reduce((sum, line) => sum + line.unitPricePaise * line.quantity, 0);
  const automaticDiscountPaise = lines.reduce((sum, line) => sum + line.automaticDiscountPaise, 0);
  const couponDiscountPaise = valid ? Math.floor((subtotalPaise - automaticDiscountPaise) / 10) : 0;
  return { currency: 'INR', items: lines, itemCount: items.reduce((sum, item) => sum + item.quantity, 0), subtotalPaise, automaticDiscountPaise, couponDiscountPaise, estimatedTotalPaise: subtotalPaise - automaticDiscountPaise - couponDiscountPaise, coupon: code ? { code, valid, message: valid ? 'Coupon applied.' : 'Coupon code not found.', savingsPaise: couponDiscountPaise } : null, canCheckout: lines.length > 0 && lines.every(line => !line.warning), note: 'Merchandise estimate only.' };
}
async function routes(page: Page) {
  await page.route('**/api/auth/refresh', route => route.fulfill({ status: 401, json: { error: { code: 'ACCESS_INVALID', message: 'Sign in.' } } }));
  await page.route('**/api/storefront/products/ceramic-vase', route => route.fulfill({ json: vase }));
  await page.route('**/api/storefront/products/ceramic-vase/reviews?page=1', route => route.fulfill({ json: { summary: { averageRating: null, reviewCount: 0 }, items: [], page: 1, pageSize: 10 } }));
  await page.route('**/api/cart/preview', route => { const body = route.request().postDataJSON() as { items: Item[]; couponCode?: string }; return route.fulfill({ json: summary(body.items, body.couponCode) }); });
}

test('guest cart survives reload, respects stock, applies coupon, and fits mobile', async ({ page }) => {
  const hydrationErrors: string[] = [];
  page.on('console', message => { if (message.type() === 'error' && /hydration|did not match|server rendered html/i.test(message.text())) hydrationErrors.push(message.text()); });
  await routes(page);
  await page.goto('/products/ceramic-vase');
  await page.getByRole('button', { name: /VASE-L,/ }).click();
  await page.getByRole('button', { name: 'Add to Cart' }).click();
  await expect(page.getByRole('link', { name: 'View Cart' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cart, 1 item' })).toBeVisible();
  await page.getByRole('link', { name: 'View Cart' }).click();
  await expect(page.getByText('SKU VASE-L')).toBeVisible();
  await expect(page.getByText('Size: Large · Color: Terracotta')).toBeVisible();
  await expect(page.getByText('₹1,000', { exact: true }).first()).toBeVisible();
  const inspectCartLayout = async () => page.evaluate(() => {
    const photo = document.querySelector('.store-cart-photo')!.getBoundingClientRect();
    const price = getComputedStyle(document.querySelector('.store-cart-line-total')!);
    const input = document.querySelector('.store-cart-coupon input')!.getBoundingClientRect();
    const apply = document.querySelector('.store-cart-coupon form button')!.getBoundingClientRect();
    const pageBox = document.querySelector('.store-cart-page')!.getBoundingClientRect();
    const summary = document.querySelector('.store-cart-summary')!.getBoundingClientRect();
    return { square: Math.abs(photo.width - photo.height) < 1, numericFont: price.fontFamily, numericVariant: price.fontVariantNumeric, couponAligned: Math.abs(input.height - apply.height) < 1 && Math.abs(input.top - apply.top) < 1, summaryInsidePage: summary.left >= pageBox.left - 1 && summary.right <= pageBox.right + 1 };
  });
  expect(await inspectCartLayout()).toMatchObject({ square: true, numericFont: expect.stringMatching(/Arial/i), numericVariant: expect.stringContaining('tabular-nums'), couponAligned: true, summaryInsidePage: true });
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  await expect(page.getByRole('link', { name: 'Cart, 2 items' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Cart, 2 items' })).toBeVisible();
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  await expect(page.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
  await page.getByLabel('Have a coupon?').fill('WELCOME10');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText(/WELCOME10.*saved/)).toBeVisible();
  await page.getByRole('button', { name: 'Remove', exact: true }).last().click();
  await expect(page.getByText('Coupon savings')).toHaveCount(0);
  await page.getByLabel('Have a coupon?').fill('EXPIRED');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('Coupon code not found.')).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  expect(await inspectCartLayout()).toMatchObject({ square: true, numericFont: expect.stringMatching(/Arial/i), numericVariant: expect.stringContaining('tabular-nums'), couponAligned: true, summaryInsidePage: true });
  await page.getByRole('button', { name: 'Remove' }).first().click();
  await expect(page.getByRole('link', { name: 'Explore Shop All' })).toBeVisible();
  expect(hydrationErrors).toEqual([]);
});

test('login submits guest items to additive merge and clears local storage only after success', async ({ page }) => {
  await routes(page);
  await page.addInitScript(() => localStorage.setItem('hl_guest_cart_v1', JSON.stringify([{ variantId: 'large', quantity: 2 }])));
  const customer = { id: '22222222-2222-4222-8222-222222222222', name: 'Anika', email: 'anika@example.test', role: 'CUSTOMER' };
  let merged: Item[] = [];
  await page.route('**/api/auth/login', route => route.fulfill({ json: { user: customer, accessToken: 'test-token', expiresIn: 900 } }));
  await page.route('**/api/cart/merge', route => { merged = (route.request().postDataJSON() as {items:Item[]}).items; return route.fulfill({ json: { ...summary([{ variantId: 'small', quantity: 1, itemId: 'small-line' }, { variantId: 'large', quantity: 3, itemId: 'large-line' }]), notes: ['VASE-L was capped at 3 available.'] } }); });
  await page.route('**/api/cart', route => route.fulfill({ json: summary([{ variantId: 'small', quantity: 1, itemId: 'small-line' }, { variantId: 'large', quantity: 3, itemId: 'large-line' }]) }));
  await page.goto('/login?returnTo=%2Fcart');
  await page.getByLabel('Email address').fill('anika@example.test');
  await page.locator('#password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByText('SKU VASE-L')).toBeVisible();
  await expect(page.getByText('SKU VASE-S')).toBeVisible();
  await expect(page.getByText('VASE-L was capped at 3 available.')).toBeVisible();
  expect(merged).toEqual([{ variantId: 'large', quantity: 2 }]);
  expect(await page.evaluate(() => localStorage.getItem('hl_guest_cart_v1'))).toBeNull();
});
