import { expect, test } from '@playwright/test';

const admin = { id: '11111111-1111-4111-8111-111111111111', name: 'Admin', email: 'admin@example.test', role: 'ADMIN' };
const image = { name: 'scene.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9xK3sAAAAASUVORK5CYII=', 'base64') };
const video = { name: 'scene.webm', mimeType: 'video/webm', buffer: Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00]) };

test('category and product create forms require primary media and accept an optional second image', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 844 });
  await page.route('**/api/auth/refresh', route => route.fulfill({ json: { user: admin, accessToken: 'test-token', expiresIn: 900 } }));
  let categoryFiles = 0, productFiles = 0, videoUploads = 0, featured = false, heroFeatured = false, productTags = false;
  await page.route('**/api/admin/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/categories/parents')) return route.fulfill({ json: [] });
    if (url.pathname.endsWith('/categories/storefront-navigation')) return route.fulfill({ json: { version: 0, items: [] } });
    if (url.pathname.endsWith('/categories/storefront-navigation/options')) return route.fulfill({ json: { items: [], page: 1, pageSize: 10, total: 0 } });
    if (url.pathname.endsWith('/categories') && route.request().method() === 'GET') return route.fulfill({ json: { items: [], page: 1, pageSize: 20, total: 0 } });
    if (url.pathname.endsWith('/categories/with-images')) { categoryFiles = (route.request().postDataBuffer()?.toString('latin1').match(/name="images"/g) ?? []).length; return route.fulfill({ json: { id: 'c1', name: 'Decor', slug: 'decor', image: { url: '/images/auth-interior.png' } } }); }
    if (url.pathname.endsWith('/products/categories/options')) return route.fulfill({ json: [] });
    if (url.pathname.endsWith('/settings/gifting')) return route.fulfill({ json: { giftWrapDefaultEligible: false } });
    if (url.pathname.endsWith('/products/with-images')) { const body = route.request().postDataBuffer()?.toString('latin1') ?? ''; productFiles = (body.match(/name="images"/g) ?? []).length; heroFeatured = body.includes('"showInHeroCarousel":true'); productTags = body.includes('"tags":["Handcrafted"]'); return route.fulfill({ json: { id: 'p1', status: 'DRAFT', showInHomeVideoShowcase: false, showInHeroCarousel: heroFeatured } }); }
    if (url.pathname.endsWith('/products/p1/video')) { videoUploads++; return route.fulfill({ json: { url: 'https://example.test/video.webm', publicId: 'products/test' } }); }
    if (url.pathname.endsWith('/products/p1') && route.request().method() === 'PATCH') { featured = Boolean((route.request().postDataJSON() as { showInHomeVideoShowcase?: boolean }).showInHomeVideoShowcase); return route.fulfill({ json: { id: 'p1', status: 'DRAFT', showInHomeVideoShowcase: featured } }); }
    return route.fulfill({ json: {} });
  });
  await page.goto('/admin/categories');
  await page.getByRole('button', { name: 'New category' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill('Decor');
  await page.getByRole('dialog').getByLabel('Slug').fill('decor');
  await page.getByRole('button', { name: 'Create category' }).click();
  await expect(page.getByText('A primary image is required.')).toBeVisible();
  await page.getByLabel('Choose primary image').setInputFiles(image);
  await page.getByLabel('Choose secondary image').setInputFiles(image);
  await page.getByRole('button', { name: 'Create category' }).click();
  await expect.poll(() => categoryFiles).toBe(2);
  await page.goto('/admin/products/new');
  await page.getByLabel('Product name').fill('Media Vase');
  await page.getByLabel('Description').fill('A media vase.');
  await page.getByLabel('Product tags').fill('Handcrafted');
  await page.getByLabel('Product tags').press('Enter');
  await page.getByLabel('SKU *').fill('MEDIA-1');
  await page.getByLabel('Price (₹) *').fill('999');
  await page.getByRole('button', { name: 'Create product' }).last().click();
  await expect(page.getByText('A primary image is required.')).toBeVisible();
  await page.locator('input[type=file][accept="image/jpeg,image/png,image/webp"]').first().setInputFiles(image);
  await page.locator('input[type=file][accept="image/jpeg,image/png,image/webp"]').last().setInputFiles(image);
  await page.getByLabel('Upload video').setInputFiles(video);
  await expect(page.getByLabel('Feature in Homepage Video Section')).toBeEnabled();
  await page.getByLabel('Feature in Homepage Video Section').check();
  await page.getByLabel('Feature in Homepage Hero Carousel').check();
  await page.getByRole('button', { name: 'Create product' }).last().click();
  await expect.poll(() => productFiles).toBe(2);
  await expect.poll(() => videoUploads).toBe(1);
  await expect.poll(() => featured).toBe(true);
  expect(heroFeatured).toBe(true);
  expect(productTags).toBe(true);
});

test('edit product pre-fills and persists homepage hero selection and tags', async ({ page }) => {
  await page.route('**/api/auth/refresh', route => route.fulfill({ json: { user: admin, accessToken: 'test-token', expiresIn: 900 } }));
  let savedHero = true;
  let savedTags = ['Handcrafted', 'Limited Edition'];
  await page.route('**/api/admin/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/products/categories/options')) return route.fulfill({ json: [] });
    if (url.pathname.endsWith('/products/p1') && route.request().method() === 'GET') return route.fulfill({ json: { id: 'p1', name: 'Media Vase', slug: 'media-vase', description: 'A media vase.', status: 'DRAFT', showInHeroCarousel: savedHero, showInHomeVideoShowcase: false, giftWrapEligible: false, newArrival: false, tags: savedTags, categories: [], images: [{ id: 'image-1', url: '/images/auth-interior.png', altText: null, position: 0 }], variants: [{ id: 'variant-1', sku: 'MEDIA-1', pricePaise: 99900, stockQuantity: 2, attributes: [] }] } });
    if (url.pathname.endsWith('/products/p1') && route.request().method() === 'PATCH') { const body = route.request().postDataJSON() as { showInHeroCarousel: boolean; tags: string[] }; savedHero = body.showInHeroCarousel; savedTags = body.tags; return route.fulfill({ json: { id: 'p1', status: 'DRAFT', showInHeroCarousel: savedHero, showInHomeVideoShowcase: false, tags: savedTags } }); }
    return route.fulfill({ json: {} });
  });
  await page.goto('/admin/products/p1/edit');
  const toggle = page.getByLabel('Feature in Homepage Hero Carousel');
  await expect(toggle).toBeChecked();
  await expect(page.locator('[aria-label="Selected tags"] > span')).toContainText(['Handcrafted', 'Limited Edition']);
  await page.getByRole('button', { name: 'Remove Limited Edition tag' }).click();
  await page.getByLabel('Product tags').fill('Bestseller');
  await page.getByLabel('Product tags').press('Enter');
  await toggle.uncheck();
  await page.getByRole('button', { name: 'Save changes' }).first().click();
  await expect.poll(() => savedHero).toBe(false);
  expect(savedTags).toEqual(['Handcrafted', 'Bestseller']);
  await page.goto('/admin/products/p1/edit');
  await expect(toggle).not.toBeChecked();
  await expect(page.locator('[aria-label="Selected tags"] > span')).toContainText(['Handcrafted', 'Bestseller']);
});
