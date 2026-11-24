import { expect, test } from '@playwright/test';

const primary = { url: '/images/auth-interior.png', altText: 'Primary scene' };
const secondary = { url: '/images/home-hero-placeholder.png', altText: 'Secondary scene' };
const product = { id: 'p1', name: 'Motion Vase', slug: 'motion-vase', description: 'A vase.', story: null, image: primary, primaryImage: primary, secondaryImage: secondary, images: [primary, secondary], videoUrl: 'https://example.test/video.webm', minPricePaise: 99000, maxPricePaise: 99000, compareAtPricePaise: null, variantCount: 1, available: true, isFeatured: true, giftWrapEligible: false, categories: [{ name: 'Decor', slug: 'decor' }], variants: [{ id: 'v1', sku: 'VASE-1', pricePaise: 99000, effectivePricePaise: 99000, compareAtPricePaise: null, stockQuantity: 3, attributes: [], dimensions: null, optionCombinationKey: '[]', available: true }] };
const category = { id: 'c1', name: 'Decor', slug: 'decor', parentId: null, image: primary, primaryImage: primary, secondaryImage: secondary };
const home = { categories: [category], featured: [product], latest: [product], giftable: [], collections: [], categoryRows: [], offers: [], videoProducts: Array.from({ length: 4 }, (_, index) => ({ ...product, id: `p${index}`, slug: `motion-vase-${index}` })) };

test('homepage media section, card hover, and PDP gallery work on desktop and mobile', async ({ page }) => {
  await page.route('**/api/storefront/home', route => route.fulfill({ json: home }));
  await page.route('**/api/storefront/products/motion-vase', route => route.fulfill({ json: product }));
  await page.route('**/api/storefront/products/motion-vase/reviews?page=1', route => route.fulfill({ json: { summary: { averageRating: null, reviewCount: 0 }, items: [], page: 1, pageSize: 10 } }));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const motion = page.locator('.store-motion');
  await expect(motion.getByRole('heading', { name: 'Shop in Motion' })).toBeVisible();
  expect(await page.locator('.store-categories, .store-motion, .store-arrivals').evaluateAll(elements => elements.map(item => item.className.split(' ').at(-1)))).toEqual(['store-categories', 'store-motion', 'store-arrivals']);
  await expect(motion.locator('video')).toHaveCount(4);
  expect(await motion.locator('video').first().evaluate(node => (node as HTMLVideoElement).muted)).toBe(true);
  const categoryAlt = page.locator('.store-category-alt').first();
  await page.locator('.store-category-tile').first().hover();
  await expect(categoryAlt).toHaveCSS('opacity', '1');
  const productAlt = page.locator('.store-arrivals .store-product-alt').first();
  await page.locator('.store-arrivals .store-product-photo').first().hover();
  await expect(productAlt).toHaveCSS('opacity', '1');
  await page.setViewportSize({ width: 375, height: 844 });
  const strip = motion.locator('.store-product-grid');
  expect(await strip.evaluate(item => item.scrollWidth > item.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(motion.locator('video').first()).toHaveCSS('display', 'none');
  await page.goto('/products/motion-vase');
  await expect(page.getByRole('button', { name: 'Show image 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show image 2' })).toBeVisible();
  await page.getByRole('button', { name: 'Show product video' }).click();
  await expect(page.getByRole('region', { name: 'Motion Vase gallery' }).locator('video')).toBeVisible();
});

test('homepage omits the motion section when no product is selected', async ({ page }) => {
  await page.route('**/api/storefront/home', route => route.fulfill({ json: { ...home, videoProducts: [] } }));
  await page.goto('/');
  await expect(page.locator('.store-motion')).toHaveCount(0);
});
