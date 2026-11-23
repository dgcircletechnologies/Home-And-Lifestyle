import { expect, test, type Page } from '@playwright/test';

const productId = '11111111-1111-4111-8111-111111111111';
const variantId = '22222222-2222-4222-8222-222222222222';
const otherVariantId = '33333333-3333-4333-8333-333333333333';
const customer = { id: '44444444-4444-4444-8444-444444444444', name: 'Asha Rao', email: 'asha@example.test', role: 'CUSTOMER' };
const product = { id: productId, name: 'Ceramic vase', slug: 'ceramic-vase', description: 'A vase.', story: null, image: null, images: [], categories: [{ name: 'Decor', slug: 'decor' }], variants: [
  { id: variantId, sku: 'VASE-L', pricePaise: 120000, effectivePricePaise: 100000, compareAtPricePaise: 120000, stockQuantity: 3, available: true, attributes: [{ title: 'Size', value: 'Large' }, { title: 'Color', value: 'Terracotta' }] },
  { id: otherVariantId, sku: 'VASE-S', pricePaise: 70000, effectivePricePaise: 60000, compareAtPricePaise: 70000, stockQuantity: 2, available: true, attributes: [{ title: 'Size', value: 'Small' }] },
] };
type Item = { variantId: string; quantity: number; itemId?: string };
type Address = { id: string; fullName: string; phone: string; line1: string; line2: string | null; city: string; state: string; pinCode: string; countryCode: string; label: string | null; isDefault: boolean };
const firstAddress: Address = { id: '55555555-5555-4555-8555-555555555555', fullName: 'Asha Rao', phone: '9876543210', line1: '12 Market Road', line2: null, city: 'Pune', state: 'Maharashtra', pinCode: '411001', countryCode: 'IN', label: 'Home', isDefault: true };
function summary(items: Item[], code?: string) {
  const lines = items.map(item => { const variant = product.variants.find(row => row.id === item.variantId)!; return { ...item, itemId: item.itemId ?? null, product: { id: productId, name: product.name, slug: product.slug, image: null }, variant: { id: variant.id, sku: variant.sku, pricePaise: variant.pricePaise, stockQuantity: variant.stockQuantity, attributes: variant.attributes }, unitPricePaise: variant.pricePaise, effectiveUnitPricePaise: variant.effectivePricePaise, automaticDiscountPaise: (variant.pricePaise - variant.effectivePricePaise) * item.quantity, couponDiscountPaise: 0, lineTotalPaise: variant.effectivePricePaise * item.quantity, warning: item.quantity > variant.stockQuantity ? `Only ${variant.stockQuantity} available.` : null }; });
  const subtotalPaise = lines.reduce((sum, row) => sum + row.unitPricePaise * row.quantity, 0);
  const automaticDiscountPaise = lines.reduce((sum, row) => sum + row.automaticDiscountPaise, 0);
  const couponDiscountPaise = code === 'WELCOME10' ? Math.round((subtotalPaise - automaticDiscountPaise) / 10) : 0;
  return { currency: 'INR', items: lines, itemCount: items.reduce((sum, row) => sum + row.quantity, 0), subtotalPaise, automaticDiscountPaise, couponDiscountPaise, estimatedTotalPaise: subtotalPaise - automaticDiscountPaise - couponDiscountPaise, coupon: code ? { code, valid: true, message: 'Coupon applied.', savingsPaise: couponDiscountPaise } : null, canCheckout: lines.length > 0 && lines.every(row => !row.warning), note: 'Merchandise estimate.' };
}
async function routes(page: Page, signedIn: boolean, initialAddresses: Address[] = []) {
  let addresses = [...initialAddresses];
  await page.route('**/api/auth/refresh', route => route.fulfill(signedIn ? { json: { user: customer, accessToken: 'test-token', expiresIn: 900 } } : { status: 401, json: { error: { code: 'ACCESS_INVALID', message: 'Sign in.' } } }));
  await page.route('**/api/storefront/products/ceramic-vase', route => route.fulfill({ json: product }));
  await page.route('**/api/storefront/products/ceramic-vase/reviews?page=1', route => route.fulfill({ json: { summary: { averageRating: null, reviewCount: 0 }, items: [], page: 1, pageSize: 10 } }));
  await page.route('**/api/cart/preview', route => { const body = route.request().postDataJSON() as { items: Item[]; couponCode?: string }; return route.fulfill({ json: summary(body.items, body.couponCode) }); });
  await page.route(/\/api\/cart(?:\?.*)?$/, route => { const code = new URL(route.request().url()).searchParams.get('couponCode') ?? undefined; return route.fulfill({ json: summary([{ variantId, quantity: 1, itemId: '66666666-6666-4666-8666-666666666666' }], code) }); });
  await page.route(/\/api\/addresses(?:\/[0-9a-f-]+)?$/, route => {
    const request = route.request(); const method = request.method(); const id = new URL(request.url()).pathname.split('/').at(-1);
    if (method === 'GET') return route.fulfill({ json: addresses });
    if (method === 'POST') { const body = request.postDataJSON() as Omit<Address, 'id' | 'countryCode'>; const row: Address = { ...body, id: addresses.some(item => item.id.startsWith('7777')) ? '88888888-8888-4888-8888-888888888888' : '77777777-7777-4777-8777-777777777777', countryCode: 'IN', isDefault: body.isDefault || addresses.length === 0 }; if (row.isDefault) addresses = addresses.map(item => ({ ...item, isDefault: false })); addresses.push(row); return route.fulfill({ status: 201, json: row }); }
    const index = addresses.findIndex(item => item.id === id);
    if (index < 0) return route.fulfill({ status: 404, json: { error: { message: 'Address not found.' } } });
    if (method === 'PATCH') { const body = request.postDataJSON() as Partial<Address>; if (body.isDefault) addresses = addresses.map(item => ({ ...item, isDefault: false })); addresses[index] = { ...addresses[index], ...body }; return route.fulfill({ json: addresses[index] }); }
    const removed = addresses[index]; addresses.splice(index, 1); if (removed.isDefault && addresses[0]) addresses[0].isDefault = true;
    return route.fulfill({ json: { deleted: true, id } });
  });
}

test('guest cart and direct entry points keep the checkout return URL', async ({ page }) => {
  await routes(page, false);
  await page.addInitScript(id => localStorage.setItem('hl_guest_cart_v1', JSON.stringify([{ variantId: id, quantity: 1 }])), variantId);
  await page.goto('/cart');
  await page.getByRole('link', { name: 'Proceed to Checkout' }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByRole('heading', { name: 'Make yourself at home.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Log In' })).toHaveAttribute('href', '/login?returnTo=%2Fcheckout');
  await page.goto('/products/ceramic-vase');
  await page.getByRole('link', { name: /Order Now/ }).click();
  await expect(page).toHaveURL(new RegExp(`/checkout\\?mode=direct&variantId=${otherVariantId}&quantity=1$`));
  await expect(page.getByRole('link', { name: 'Create Account' })).toHaveAttribute('href', `/register?returnTo=${encodeURIComponent(`/checkout?mode=direct&variantId=${otherVariantId}&quantity=1`)}`);
  await page.route('**/api/auth/register', route => route.fulfill({ status: 202, json: { message: 'Check your inbox.', delivery: 'accepted', resendAfterSeconds: 60 } }));
  await page.getByRole('link', { name: 'Create Account' }).click();
  await page.getByLabel('Full name').fill(customer.name);
  await page.getByLabel('Email address').fill(customer.email);
  await page.locator('#password').fill('password123');
  await page.locator('#confirm').fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/check-email$/);
  await expect(page.getByRole('link', { name: 'Back to login' })).toHaveAttribute('href', `/login?returnTo=${encodeURIComponent(`/checkout?mode=direct&variantId=${otherVariantId}&quantity=1`)}`);
  await page.route('**/api/auth/login', route => route.fulfill({ json: { user: customer, accessToken: 'test-token', expiresIn: 900 } }));
  await page.getByRole('link', { name: 'Back to login' }).click();
  await page.getByLabel('Email address').fill(customer.email);
  await page.locator('#password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(new RegExp(`/checkout\\?mode=direct&variantId=${otherVariantId}&quantity=1$`));
  await expect(page.getByRole('heading', { name: 'Shipping address' })).toBeVisible();
});

test('guest cart merges on login and returns to cart checkout', async ({ page }) => {
  await routes(page, false, [firstAddress]);
  await page.addInitScript(id => localStorage.setItem('hl_guest_cart_v1', JSON.stringify([{ variantId: id, quantity: 1 }])), variantId);
  let merged: Item[] = [];
  await page.route('**/api/auth/login', route => route.fulfill({ json: { user: customer, accessToken: 'test-token', expiresIn: 900 } }));
  await page.route('**/api/cart/merge', route => { merged = (route.request().postDataJSON() as { items: Item[] }).items; return route.fulfill({ json: summary([{ variantId, quantity: 1, itemId: '66666666-6666-4666-8666-666666666666' }]) }); });
  await page.goto('/checkout');
  await page.getByRole('link', { name: 'Log In' }).click();
  await page.getByLabel('Email address').fill(customer.email);
  await page.locator('#password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByText('SKU VASE-L · Qty 1')).toBeVisible();
  expect(merged).toEqual([{ variantId, quantity: 1 }]);
  expect(await page.evaluate(() => localStorage.getItem('hl_guest_cart_v1'))).toBeNull();
});

test('profile addresses create, validate, edit, set default, and delete', async ({ page }) => {
  await routes(page, true);
  page.on('dialog', dialog => void dialog.accept());
  await page.goto('/account/addresses');
  await expect(page.getByText('No saved addresses yet.')).toBeVisible();
  await page.getByRole('button', { name: '+ Add New Address' }).click();
  await page.getByRole('button', { name: 'Save address' }).click();
  await expect(page.getByText('Enter a valid 10-digit Indian mobile number.')).toBeVisible();
  await expect(page.getByText('Enter a valid 6-digit Indian PIN code.')).toBeVisible();
  await page.getByLabel(/Full name/).fill('Asha Rao'); await page.getByLabel(/Phone number/).fill('9876543210'); await page.getByLabel(/Address line 1/).fill('12 Market Road'); await page.getByLabel(/^City/).fill('Pune'); await page.getByLabel(/^State/).fill('Maharashtra'); await page.getByLabel(/PIN code/).fill('411001');
  await page.getByRole('button', { name: 'Save address' }).click();
  await expect(page.getByText('12 Market Road')).toBeVisible();
  await expect(page.getByText('Default', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel(/Address line 1/).fill('14 Market Road');
  await page.getByRole('button', { name: 'Save address' }).click();
  await expect(page.getByText('14 Market Road')).toBeVisible();
  await page.getByRole('button', { name: '+ Add New Address' }).click();
  await page.getByLabel(/Full name/).fill('Asha Rao'); await page.getByLabel(/Phone number/).fill('9876543210'); await page.getByLabel(/Address line 1/).fill('Office Lane'); await page.getByLabel(/^City/).fill('Pune'); await page.getByLabel(/^State/).fill('Maharashtra'); await page.getByLabel(/PIN code/).fill('411001');
  await page.getByRole('button', { name: 'Save address' }).click();
  await page.getByRole('button', { name: 'Set as default' }).click();
  await expect(page.locator('.store-address-card').filter({ hasText: 'Office Lane' }).getByText('Default')).toBeVisible();
  await page.locator('.store-address-card').filter({ hasText: 'Office Lane' }).getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('.store-address-card')).toHaveCount(1);
  await expect(page.locator('.store-address-card').getByText('Default')).toBeVisible();
});

test('cart checkout carries coupon; direct checkout excludes it and shares address selection', async ({ page }) => {
  await routes(page, true, [firstAddress]);
  await page.addInitScript(() => sessionStorage.setItem('hl_cart_coupon_v1', 'WELCOME10'));
  const inspectCheckoutLayout = async () => page.evaluate(() => {
    const photo = document.querySelector('.store-checkout-line-photo')!.getBoundingClientRect();
    const amount = getComputedStyle(document.querySelector('.store-checkout-total strong')!);
    const pageBox = document.querySelector('.store-checkout-page')!.getBoundingClientRect();
    const summaryBox = document.querySelector('.store-checkout-summary')!.getBoundingClientRect();
    const radio = document.querySelector('.store-checkout-address-option input')!.getBoundingClientRect();
    const copy = document.querySelector('.store-checkout-address-copy')!.getBoundingClientRect();
    return { square: Math.abs(photo.width - photo.height) < 1, numericFont: amount.fontFamily, numericVariant: amount.fontVariantNumeric, summaryInsidePage: summaryBox.left >= pageBox.left - 1 && summaryBox.right <= pageBox.right + 1, radioAligned: Math.abs(radio.top - copy.top) < 5 };
  });
  await page.goto('/checkout');
  await expect(page.getByText('Coupon · WELCOME10')).toBeVisible();
  await expect(page.getByText('Shipping included in cost')).toBeVisible();
  expect(await inspectCheckoutLayout()).toMatchObject({ square: true, numericFont: expect.stringMatching(/Arial/i), numericVariant: expect.stringContaining('tabular-nums'), summaryInsidePage: true, radioAligned: true });
  await expect(page.getByRole('radio', { name: /Asha Rao/ }).first()).toBeChecked();
  await expect(page.getByRole('button', { name: 'Proceed to Payment' })).toBeEnabled();
  await page.getByLabel('Billing address same as shipping address').uncheck();
  await expect(page.getByRole('heading', { name: 'Choose billing address' })).toBeVisible();
  await page.locator('.store-checkout-address-section').last().getByRole('button', { name: '+ Add New Address' }).click();
  expect(await page.getByLabel(/PIN code/).evaluate(element => getComputedStyle(element).fontVariantNumeric)).toContain('tabular-nums');
  await page.getByLabel(/Full name/).fill('Asha Rao'); await page.getByLabel(/Phone number/).fill('9876543210'); await page.getByLabel(/Address line 1/).fill('45 Billing Street'); await page.getByLabel(/^City/).fill('Pune'); await page.getByLabel(/^State/).fill('Maharashtra'); await page.getByLabel(/PIN code/).fill('411001');
  await page.getByRole('button', { name: 'Save address' }).click();
  await expect(page.locator('.store-checkout-address-section').last().getByRole('radio').last()).toBeChecked();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.goto(`/checkout?mode=direct&variantId=${otherVariantId}&quantity=2`);
  await expect(page.getByText('SKU VASE-S · Qty 2')).toBeVisible();
  expect(await inspectCheckoutLayout()).toMatchObject({ square: true, numericFont: expect.stringMatching(/Arial/i), numericVariant: expect.stringContaining('tabular-nums'), summaryInsidePage: true, radioAligned: true });
  await expect(page.getByText('Shipping included in cost')).toBeVisible();
  await expect(page.locator('.store-checkout-summary').getByText('Coupon')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Proceed to Payment' })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('checkout gives safe recovery for an empty cart and unavailable direct variant', async ({ page }) => {
  await routes(page, true, [firstAddress]);
  await page.route(/\/api\/cart(?:\?.*)?$/, route => route.fulfill({ json: summary([]) }));
  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: 'Your cart is empty.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Explore Shop All' })).toBeVisible();
  await page.route('**/api/cart/preview', route => route.fulfill({ json: { ...summary([{ variantId, quantity: 1 }]), items: [{ ...summary([{ variantId, quantity: 1 }]).items[0], warning: 'Out of stock. Remove this item.' }], canCheckout: false } }));
  await page.goto(`/checkout?mode=direct&variantId=${variantId}&quantity=1`);
  await expect(page.getByRole('heading', { name: 'Check your pieces before continuing.' })).toBeVisible();
  await expect(page.getByText('Out of stock. Remove this item.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to Shop All' })).toBeVisible();
});

const orderId = '99999999-9999-4999-8999-999999999999';
function order(paymentStatus: string, sourceMode: string) { return { id: orderId, orderNumber: 'HLTEST123', createdAt: new Date().toISOString(), status: paymentStatus === 'PAID' ? 'NEW' : 'PENDING_PAYMENT', paymentStatus, currency: 'INR', sourceMode, subtotalPaise: 120000, discountPaise: 20000, automaticDiscountPaise: sourceMode === 'CART' ? 10000 : 20000, couponDiscountPaise: sourceMode === 'CART' ? 10000 : 0, shippingPaise: 0, totalPaise: 100000, couponCode: sourceMode === 'CART' ? 'WELCOME10' : null, shippingAddress: { recipient: 'Asha Rao', line1: '12 Market Road', city: 'Pune', state: 'Maharashtra', pinCode: '411001', phone: '9876543210' }, billingAddress: { recipient: 'Asha Rao', line1: '12 Market Road', city: 'Pune', state: 'Maharashtra', pinCode: '411001', phone: '9876543210' }, lines: [{ id: 'line-1', productName: 'Ceramic vase', sku: 'VASE-L', quantity: 1, unitPricePaise: 120000, effectiveUnitPricePaise: 100000, discountPaise: 20000, totalPaise: 100000, attributes: [{ title: 'Size', value: 'Large' }], image: null }], payments: [{ id: 'attempt-1', status: paymentStatus === 'PAID' ? 'SUCCEEDED' : paymentStatus, providerPaymentId: paymentStatus === 'PAID' ? 'pay_test' : null, failureCode: paymentStatus === 'FAILED' ? 'CHECKOUT_DISMISSED' : null, failureReason: paymentStatus === 'FAILED' ? 'Payment window was closed.' : null, paidAt: null }] }; }
const launch = (suffix = '') => ({ orderId, orderNumber: 'HLTEST123', razorpayOrderId: `order_test${suffix}`, amount: 100000, currency: 'INR', keyId: 'test-public-key', prefill: { name: 'Asha Rao', email: 'asha@example.test', contact: '9876543210' } });

test('cart payment opens env-configured checkout, verifies, clears badge, and shows the result', async ({ page }) => {
  await routes(page, true, [firstAddress]);
  let paid = false; let checkoutBody: Record<string, unknown> = {};
  await page.route('**/test-checkout.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.Razorpay=class{constructor(options){this.options=options}on(){}open(){window.__checkoutOpened=this.options.order_id;setTimeout(()=>this.options.handler({razorpay_order_id:this.options.order_id,razorpay_payment_id:"pay_test",razorpay_signature:"a".repeat(64)}),10)}}' }));
  await page.route('**/api/orders/checkout', route => { checkoutBody = route.request().postDataJSON() as Record<string, unknown>; return route.fulfill({ json: launch() }); });
  await page.route('**/api/payments/razorpay/verify', route => { paid = true; return route.fulfill({ json: { orderId, status: 'PAID' } }); });
  await page.route(/\/api\/cart(?:\?.*)?$/, route => route.fulfill({ json: summary(paid ? [] : [{ variantId, quantity: 1, itemId: '66666666-6666-4666-8666-666666666666' }]) }));
  await page.route(`**/api/orders/${orderId}`, route => route.fulfill({ json: order(paid ? 'PAID' : 'PENDING', 'CART') }));
  await page.goto('/checkout');
  await page.getByRole('button', { name: 'Proceed to Payment' }).click();
  await expect(page).toHaveURL(new RegExp(`/checkout/result\\?orderId=${orderId}`), { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Payment Successful' })).toBeVisible({ timeout: 15000 });
  expect(checkoutBody).toMatchObject({ mode: 'CART', shippingAddressId: firstAddress.id, billingAddressId: firstAddress.id });
  expect(await page.evaluate(() => (window as typeof window & { __checkoutOpened?: string }).__checkoutOpened)).toBe('order_test');
  await expect(page.locator('.store-cart-badge')).toHaveCount(0);
  await expect(page.getByText('Payment ID pay_test')).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('direct payment excludes coupons; dismissal shows failure and retry opens a new attempt', async ({ page }) => {
  await routes(page, true, [firstAddress]);
  let paymentStatus = 'PENDING'; let checkoutBody: Record<string, unknown> = {}; let retryCount = 0;
  await page.route('**/test-checkout.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.Razorpay=class{constructor(options){this.options=options}on(){}open(){window.__paymentRuns=(window.__paymentRuns||0)+1;if(window.__paymentRuns===1)setTimeout(()=>this.options.modal.ondismiss(),10);else setTimeout(()=>this.options.handler({razorpay_order_id:this.options.order_id,razorpay_payment_id:"pay_test",razorpay_signature:"a".repeat(64)}),10)}}' }));
  await page.route('**/api/orders/checkout', route => { checkoutBody = route.request().postDataJSON() as Record<string, unknown>; return route.fulfill({ json: launch() }); });
  await page.route('**/api/payments/razorpay/fail', route => { paymentStatus = 'FAILED'; return route.fulfill({ json: { orderId, status: 'FAILED' } }); });
  await page.route(`**/api/orders/${orderId}/retry-payment`, route => { retryCount++; return route.fulfill({ json: launch('-retry') }); });
  await page.route('**/api/payments/razorpay/verify', route => { paymentStatus = 'PAID'; return route.fulfill({ json: { orderId, status: 'PAID' } }); });
  await page.route(`**/api/orders/${orderId}`, route => route.fulfill({ json: order(paymentStatus, 'DIRECT') }));
  await page.goto(`/checkout?mode=direct&variantId=${otherVariantId}&quantity=2`);
  await page.getByRole('button', { name: 'Proceed to Payment' }).click();
  await expect(page.getByRole('heading', { name: 'Payment Unsuccessful' })).toBeVisible();
  expect(checkoutBody).toMatchObject({ mode: 'DIRECT', variantId: otherVariantId, quantity: 2 });
  expect(checkoutBody).not.toHaveProperty('couponCode');
  await page.getByRole('button', { name: 'Retry Payment' }).click();
  await expect(page.getByRole('heading', { name: 'Payment Successful' })).toBeVisible();
  expect(retryCount).toBe(1);
  await page.route('**/api/orders', route => route.fulfill({ json: [order('PAID', 'DIRECT')] }));
  await page.goto('/account/orders');
  await expect(page.getByRole('heading', { name: 'My Orders' })).toBeVisible();
  await expect(page.getByText('HLTEST123')).toBeVisible();
  await page.getByRole('link', { name: 'View Details' }).click();
  await expect(page).toHaveURL(new RegExp(`/account/orders/${orderId}`), { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Pieces in this order' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: /Cancel Order/i })).toHaveCount(0);
});

test('My Orders redirects guests to login and shows a clean empty state for new customers', async ({ page }) => {
  await routes(page, false);
  await page.goto('/account/orders');
  await expect(page).toHaveURL(/\/login\?returnTo=%2Faccount%2Forders/);
  await routes(page, true);
  await page.route('**/api/orders', route => route.fulfill({ json: [] }));
  await page.goto('/account/orders');
  await expect(page.getByRole('heading', { name: 'No orders yet.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Shop All' }).last()).toBeVisible();
});
