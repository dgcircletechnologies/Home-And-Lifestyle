import { test, expect } from '@playwright/test';

const imageA = { url: '/images/auth-interior.png', altText: 'A styled living room' };
const imageB = { url: '/images/home-hero-placeholder.png', altText: 'A sculptural lamp and ceramic vase' };
const product = { id: '11111111-1111-4111-8111-111111111111', name: 'Ceramic vase', slug: 'ceramic-vase', description: 'A sculptural vase for your table.', story: 'Made with care.', materials: ['Ceramic'], careInstructions: 'Wipe with a soft cloth.', dimensions: { height: '24 cm' }, attributes: [], tags: ['Handmade'], collections: ['Sunday Edit'], isFeatured: false, giftWrapEligible: false, image: imageA, images: [imageA, imageB], categories: [{ name: 'Decor', slug: 'decor' }], variantCount: 2, minPricePaise: 60000, maxPricePaise: 100000, compareAtPricePaise: 70000, available: true, variants: [
  { id: 'large', sku: 'VASE-L', pricePaise: 120000, effectivePricePaise: 100000, compareAtPricePaise: 120000, stockQuantity: 8, available: true, attributes: [{ title: 'Size', value: 'Large' }], optionCombinationKey: 'large' },
  { id: 'small', sku: 'VASE-S', pricePaise: 70000, effectivePricePaise: 60000, compareAtPricePaise: 70000, stockQuantity: 0, available: false, attributes: [{ title: 'Size', value: 'Small' }], optionCombinationKey: 'small' },
] };
const reviews = { summary: { averageRating: 4.5, reviewCount: 2 }, page: 1, pageSize: 10, items: [
  { id: 'r1', rating: 5, title: 'Lovely vase', body: 'Beautiful on my table.', createdAt: '2026-11-20T10:00:00.000Z', reviewerName: 'Anika Sharma', avatarUrl: null, verifiedPurchase: true, storeReply: null },
  { id: 'r2', rating: 4, title: null, body: 'Nice finish.', createdAt: '2026-11-21T10:00:00.000Z', reviewerName: 'Ravi', avatarUrl: null, verifiedPurchase: false, storeReply: null },
] };
const adminlessCustomer = { id: '22222222-2222-4222-8222-222222222222', name: 'Customer', email: 'customer@example.test', role: 'CUSTOMER' };

async function routes(page: import('@playwright/test').Page, signedIn = false, productImages = product.images) {
  await page.route('**/api/auth/refresh', route => route.fulfill(signedIn ? { json: { user: adminlessCustomer, accessToken: 'test-token', expiresIn: 900 } } : { status: 401, json: { error: { code: 'ACCESS_INVALID', message: 'Sign in.' } } }));
  await page.route('**/api/storefront/products/ceramic-vase', route => route.fulfill({ json: { ...product, images: productImages } }));
  await page.route('**/api/storefront/products/ceramic-vase/reviews?page=1', route => route.fulfill({ json: reviews }));
}

test('gallery, variant stock, tabs, and logged-out review prompt work on desktop and mobile', async ({ page }) => {
  await routes(page);
  await page.goto('/products/ceramic-vase');
  await expect(page.getByRole('heading', { name: 'Ceramic vase', level: 1 })).toBeVisible();
  const rating = page.locator('.store-pdp-rating');
  await expect(rating).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(rating.locator('strong, small')).toHaveCount(0);
  expect(await rating.locator('.store-pdp-stars-fill').evaluate(element => Math.round(element.getBoundingClientRect().width / element.parentElement!.getBoundingClientRect().width * 100))).toBe(90);
  await expect(page.locator('.store-pdp-main img')).toHaveAttribute('alt', imageA.altText);
  await page.getByRole('button', { name: 'Next image' }).click();
  await expect(page.locator('.store-pdp-main img')).toHaveAttribute('alt', imageB.altText);
  await page.getByRole('button', { name: 'Show image 1' }).click();
  await expect(page.locator('.store-pdp-main img')).toHaveAttribute('alt', imageA.altText);
  await expect(page.getByRole('tab', { name: 'About' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Wipe with a soft cloth.')).toBeVisible();
  await page.getByRole('button', { name: /^VASE-S,/ }).click();
  await expect(page.locator('.store-pdp-price')).toContainText('₹600');
  await expect(page.getByText('Small', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to Cart' })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Order Now/ })).toBeDisabled();
  await page.getByRole('button', { name: /^VASE-L,/ }).click();
  await page.getByRole('button', { name: 'Add to Cart' }).click();
  await expect(page.getByRole('status')).toContainText('Cart coming soon for VASE-L.');
  await page.getByRole('button', { name: /Order Now/ }).click();
  await expect(page.getByRole('status')).toContainText('Checkout coming soon for VASE-L.');
  await page.getByRole('button', { name: /Rated 4.5 out of 5/ }).click();
  await expect(page.getByRole('tab', { name: 'Reviews (2)' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Lovely vase')).toBeVisible();
  await expect(page.getByText('Verified purchase')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Log in to write a review' })).toHaveAttribute('href', '/login?returnTo=%2Fproducts%2Fceramic-vase');
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole('tab', { name: 'Reviews (2)' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('single image hides gallery controls; signed-in customer submits a pending review', async ({ page }) => {
  await routes(page, true, [imageA]);
  let submitted: { rating: number; title: string; body: string } | undefined;
  await page.route('**/api/customer/products/ceramic-vase/reviews', route => { submitted = route.request().postDataJSON(); return route.fulfill({ json: { id: 'pending-review', moderationStatus: 'PENDING', message: 'Thank you. Your review was submitted for approval.' } }); });
  await page.goto('/products/ceramic-vase');
  await expect(page.getByRole('button', { name: 'Next image' })).toHaveCount(0);
  await expect(page.locator('.store-pdp-thumbnails')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Reviews (2)' }).click();
  await expect(page.getByRole('heading', { name: 'Write a review' })).toBeVisible();
  await page.locator('#product-rating-5').check();
  await page.getByLabel('Title (optional)').fill('Wonderful');
  await page.getByLabel('Your review *').fill('The finish is lovely and feels sturdy.');
  await page.getByRole('button', { name: 'Submit review' }).click();
  await expect.poll(() => submitted?.rating).toBe(5);
  expect(submitted?.title).toBe('Wonderful');
  await expect(page.getByText('Thank you. Your review was submitted for approval.')).toBeVisible();
});
