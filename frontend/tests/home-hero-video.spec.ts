import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const video = readFileSync('tests/fixtures/long-hero.webm');
const photo = (url: string) => ({ url, altText: 'Styled product' });
const videoProduct = { id: 'video', name: 'Motion Vase', slug: 'motion-vase', description: 'A piece in motion.', videoUrl: 'http://localhost:3100/test-long-hero.webm', primaryImage: photo('/images/auth-interior.png'), secondaryImage: photo('/images/home-hero-placeholder.png'), minPricePaise: 149900, compareAtPricePaise: null, variantCount: 1 };
const imageProduct = { id: 'photo', name: 'Still Vase', slug: 'still-vase', description: 'A quiet accent.', videoUrl: null, primaryImage: photo('/images/home-hero-placeholder.png'), secondaryImage: photo('/images/auth-interior.png'), minPricePaise: 99900, compareAtPricePaise: null, variantCount: 1 };
const home = { heroProducts: [videoProduct, imageProduct], categories: [], featured: [], latest: [], giftable: [], collections: [], categoryRows: [], offers: [] };

test.beforeEach(async ({ page }) => {
  await page.route('**/test-long-hero.webm', route => route.fulfill({ body: video, contentType: 'video/webm' }));
  await page.route('**/api/storefront/home', route => route.fulfill({ json: home }));
});

test('a 20-second video plays only in its five-second desktop hero slot', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const hero = page.locator('.store-hero-carousel');
  const activeVideo = hero.locator('video');
  await expect(activeVideo).toBeVisible();
  await expect(activeVideo).toHaveAttribute('autoplay', '');
  await expect(activeVideo).toHaveAttribute('loop', '');
  await expect(activeVideo).toHaveAttribute('playsinline', '');
  await expect(activeVideo).toHaveAttribute('preload', 'metadata');
  await expect(activeVideo).toHaveAttribute('poster', videoProduct.primaryImage.url);
  await expect(activeVideo).toHaveCSS('object-position', '0% 50%');
  await expect.poll(() => activeVideo.evaluate(element => (element as HTMLVideoElement).duration)).toBeGreaterThan(15);
  await expect.poll(() => activeVideo.evaluate(element => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(0.2);
  const startedAt = Date.now();
  await expect(hero.getByRole('heading', { name: imageProduct.name })).toBeVisible({ timeout: 6500 });
  expect(Date.now() - startedAt).toBeLessThan(6500);
  await expect(activeVideo).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
});

test('mobile video fills the photo slot, pauses on hover, and resumes the remaining time', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 844 });
  await page.goto('/');
  const hero = page.locator('.store-hero-carousel');
  const activeVideo = hero.locator('video');
  await expect(activeVideo).toBeVisible();
  await expect(activeVideo).toHaveCSS('object-position', '50% 0%');
  const photoBounds = await hero.locator('.store-hero-panel[aria-hidden="false"] .store-hero-photo').boundingBox();
  expect(Math.round(photoBounds?.width ?? 0)).toBe(375);
  expect(Math.round(photoBounds?.height ?? 0)).toBe(234);
  await expect.poll(() => activeVideo.evaluate(element => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(2);
  await hero.hover();
  await expect.poll(() => activeVideo.evaluate(element => (element as HTMLVideoElement).paused)).toBe(true);
  await page.waitForTimeout(5200);
  await expect(hero.getByRole('heading', { name: videoProduct.name })).toBeVisible();
  await page.mouse.move(0, 0);
  await expect.poll(() => activeVideo.evaluate(element => (element as HTMLVideoElement).paused)).toBe(false);
  await expect(hero.getByRole('heading', { name: imageProduct.name })).toBeVisible({ timeout: 4000 });
  await expect(activeVideo).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('reduced motion shows the primary poster and keeps manual navigation', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const hero = page.locator('.store-hero-carousel');
  await expect(hero.locator('video')).toHaveCount(0);
  await expect(hero.locator('.store-hero-panel[aria-hidden="false"] .store-hero-primary')).toBeVisible();
  await page.waitForTimeout(5200);
  await expect(hero.getByRole('heading', { name: videoProduct.name })).toBeVisible();
  await hero.getByRole('button', { name: `Show ${imageProduct.name}` }).click();
  await expect(hero.getByRole('heading', { name: imageProduct.name })).toBeVisible();
  await hero.getByRole('button', { name: `Show ${videoProduct.name}` }).click();
  await expect(hero.locator('video')).toHaveCount(0);
});
