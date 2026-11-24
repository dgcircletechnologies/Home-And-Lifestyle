import { test, expect } from '@playwright/test';

const admin = { id: '11111111-1111-4111-8111-111111111111', name: 'Admin', email: 'admin@example.test', role: 'ADMIN' };
const first = { id: '22222222-2222-4222-8222-222222222222', sku: 'VASE-S', pricePaise: 50000, stockQuantity: 2, attributes: [{ title: 'Size', value: 'Small' }] };
const second = { id: '33333333-3333-4333-8333-333333333333', sku: 'VASE-L', pricePaise: 80000, stockQuantity: 1, attributes: [{ title: 'Size', value: 'Large' }, { title: 'Color', value: 'Terracotta' }] };
const image = { name: 'scene.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9xK3sAAAAASUVORK5CYII=', 'base64') };
const product = { id: '44444444-4444-4444-8444-444444444444', name: 'Ceramic Vase', slug: 'ceramic-vase', description: 'A ceramic vase.', status: 'DRAFT', giftWrapEligible: false, newArrival: false, categories: [], images: [{ id: 'image-1', url: '/images/auth-interior.png', altText: null, position: 0 }], variants: [first, second] };

test('admin product editor builds and preserves multiple SKU attributes', async ({ page }) => {
  type SentVariant = { id?: string; sku: string; pricePaise: number; stockQuantity: number; attributes: { title: string; value: string }[] };
  type SentProduct = { variants: SentVariant[] };
  let created: SentProduct | undefined, updated: SentProduct | undefined;
  await page.route('**/api/auth/refresh', route => route.fulfill({ json: { user: admin, accessToken: 'test-token', expiresIn: 900 } }));
  await page.route('**/api/admin/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/products/categories/options')) return route.fulfill({ json: [] });
    if (url.pathname.endsWith('/settings/gifting')) return route.fulfill({ json: { giftWrapDefaultEligible: false } });
    if (url.pathname.endsWith(`/products/${product.id}`) && route.request().method() === 'GET') return route.fulfill({ json: product });
    if (url.pathname.endsWith('/products/with-images') && route.request().method() === 'POST') { const raw = route.request().postData() ?? ''; created = JSON.parse(raw.match(/name="payload"\r\n\r\n([^\r]+)/)?.[1] ?? '{}') as SentProduct; return route.fulfill({ json: { ...product, id: 'created-id', variants: created.variants } }); }
    if (url.pathname.endsWith(`/products/${product.id}`) && route.request().method() === 'PATCH') { updated = route.request().postDataJSON() as SentProduct; return route.fulfill({ json: { ...product, ...updated } }); }
    return route.fulfill({ json: {} });
  });
  await page.goto('/admin/products/new');
  await expect(page.getByRole('heading', { name: 'Variants (SKUs)' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove Variant' })).toHaveCount(0);
  await page.getByRole('button', { name: '+ Add Variant' }).click();
  await expect(page.getByRole('button', { name: 'Remove Variant' })).toHaveCount(2);
  await page.getByLabel('Product name').fill('Test Vase');
  await page.getByLabel('Description').fill('A test vase.');
  await page.getByLabel('SKU *').nth(0).fill('TEST-S');
  await page.getByLabel('SKU *').nth(1).fill('TEST-L');
  await page.getByLabel('Price (₹) *').nth(0).fill('500');
  await page.getByLabel('Price (₹) *').nth(1).fill('800');
  await page.getByLabel('Stock *').nth(0).fill('2');
  await page.getByLabel('Stock *').nth(1).fill('1');
  await page.getByRole('button', { name: '+ Add Attribute' }).first().click();
  await page.getByLabel('Title').fill('Size');
  await page.getByLabel('Value').fill('Small');
  await page.locator('input[type=file][accept="image/jpeg,image/png,image/webp"]').first().setInputFiles(image);
  await page.getByRole('button', { name: 'Create product' }).last().click();
  await expect.poll(() => created?.variants?.length).toBe(2);
  expect(created!.variants[0].attributes).toEqual([{ title: 'Size', value: 'Small' }]);
  await page.goto(`/admin/products/${product.id}/edit`);
  await expect(page.getByLabel('SKU *')).toHaveCount(2);
  await expect(page.getByLabel('Title')).toHaveCount(3);
  await expect(page.getByLabel('Value').nth(2)).toHaveValue('Terracotta');
  await page.getByRole('button', { name: 'Remove Variant' }).first().click();
  await page.getByRole('button', { name: '+ Add Variant' }).click();
  await page.getByLabel('SKU *').nth(1).fill('VASE-XL');
  await page.getByLabel('Price (₹) *').nth(1).fill('1000');
  await page.getByLabel('Stock *').nth(1).fill('0');
  await page.getByRole('button', { name: 'Save changes' }).last().click();
  await expect.poll(() => updated?.variants?.length).toBe(2);
  expect(updated!.variants[0].id).toBe(second.id);
  expect(updated!.variants[0].attributes).toEqual(second.attributes);
  expect(updated!.variants[1].id).toBeUndefined();
});
