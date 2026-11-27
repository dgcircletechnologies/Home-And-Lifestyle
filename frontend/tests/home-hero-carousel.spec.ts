import { expect, test } from '@playwright/test';

const image = (url: string) => ({ url, altText: 'Styled product' });
const products = [
  { id: 'vase', name: 'Terracotta Statement Vase', slug: 'terracotta-vase', description: 'A sculptural accent for the living room.', tags: ['Handcrafted', 'Limited Edition', 'Giftable'], primaryImage: image('/images/auth-interior.png'), secondaryImage: image('/images/home-hero-placeholder.png'), minPricePaise: 149900, compareAtPricePaise: 199900, variantCount: 2 },
  { id: 'lamp', name: 'Warm Table Lamp', slug: 'warm-lamp', description: 'A soft glow for slower evenings.', primaryImage: image('/images/home-hero-placeholder.png'), secondaryImage: image('/images/auth-interior.png'), minPricePaise: 249900, compareAtPricePaise: null, variantCount: 1 },
];
const home = { heroProducts: products, categories: [], featured: [], latest: [], giftable: [], collections: [], categoryRows: [], offers: [] };

test('hero crossfades images, slides forward through wrap, and keeps a compact stacked mobile layout', async ({ page }) => {
  await page.route('**/api/storefront/home', route => route.fulfill({ json: home }));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const hero = page.locator('.store-hero-carousel');
  const panels = hero.locator('.store-hero-panel');
  const track = hero.locator('.store-hero-track');
  await track.evaluate(element => element.addEventListener('transitionrun', event => { if (!(event instanceof TransitionEvent) || event.propertyName !== 'transform') return; if (element.getAttribute('style')?.includes('translateX(-200%)')) element.setAttribute('data-forward-slid', 'true'); if (element.getAttribute('style')?.includes('translateX(-300%)')) element.setAttribute('data-wrap-slid', 'true'); }));
  expect(Math.round((await hero.boundingBox())?.width ?? 0)).toBe(1280);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(hero.getByRole('heading', { name: products[0].name })).toBeVisible();
  await expect(hero.locator('.store-hero-panel[aria-hidden="false"] .store-hero-tags .store-hero-new')).toHaveText(['Handcrafted', 'Limited Edition']);
  await expect(hero.getByRole('button', { name: /previous|next featured product/i })).toHaveCount(0);
  await expect(hero.locator('.store-hero-dots button')).toHaveCount(2);
  await expect(hero.locator('.store-hero-panel[aria-hidden="false"]').getByText('Starts from ₹1,499')).toBeVisible();
  await expect(hero.locator('.store-hero-panel[aria-hidden="false"] del')).toHaveText('₹1,999');
  await expect(hero.locator('.store-hero-panel[aria-hidden="false"] .store-hero-price span')).toHaveCSS('color', 'rgb(185, 237, 192)');
  await expect(hero.locator('.store-hero-panel[aria-hidden="false"] del')).toHaveCSS('color', 'rgb(255, 176, 168)');
  await expect(hero.locator('.store-hero-panel[aria-hidden="false"] del')).toHaveCSS('text-decoration-line', 'line-through');
  await expect(hero.getByRole('link', { name: 'Shop Now' })).toHaveAttribute('href', '/products/terracotta-vase');
  await expect(panels.nth(1).locator('.store-hero-primary')).toHaveCSS('object-position', '0% 50%');
  const desktop = await panels.nth(1).evaluate(element => ({ imageWidth: element.querySelector('.store-hero-photo')!.getBoundingClientRect().width, copyLeft: element.querySelector('.store-hero-carousel-copy')!.getBoundingClientRect().left, gradient: getComputedStyle(element, '::after').backgroundImage }));
  expect(Math.round(desktop.imageWidth)).toBe(1280);
  expect(desktop.copyLeft).toBeLessThan(1280 / 2);
  expect(desktop.gradient).toContain('linear-gradient');
  await expect.poll(async () => panels.nth(1).locator('.store-hero-secondary').getAttribute('class'), { timeout: 4500 }).toContain('is-visible');
  await expect(track).toHaveAttribute('data-forward-slid', 'true', { timeout: 4500 });
  await expect.poll(async () => track.evaluate(element => Math.round(new DOMMatrix(getComputedStyle(element).transform).m41)), { timeout: 2500 }).toBe(-2560);
  await expect(hero.getByRole('heading', { name: products[1].name })).toBeVisible();
  await expect(hero.locator('.store-hero-panel[aria-hidden="false"] .store-hero-tags')).toHaveText('NEW');
  await expect(hero.locator('.store-hero-panel[aria-hidden="false"] .store-hero-price span')).toHaveCSS('color', 'rgb(185, 237, 192)');
  await expect(hero.locator('.store-hero-panel[aria-hidden="false"] del')).toHaveCount(0);
  await expect.poll(async () => panels.nth(2).locator('.store-hero-secondary').getAttribute('class'), { timeout: 4500 }).toContain('is-visible');
  await expect(track).toHaveAttribute('data-wrap-slid', 'true', { timeout: 4500 });
  await expect.poll(async () => track.getAttribute('style'), { timeout: 2000 }).toContain('translateX(-100%)');
  await expect(hero.getByRole('heading', { name: products[0].name })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);

  await hero.getByRole('button', { name: `Show ${products[0].name}` }).click();
  await hero.hover();
  await page.waitForTimeout(2800);
  await expect(panels.nth(1).locator('.store-hero-secondary')).not.toHaveClass(/is-visible/);
  await hero.getByRole('button', { name: `Show ${products[0].name}` }).focus();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(2800);
  await expect(panels.nth(1).locator('.store-hero-secondary')).not.toHaveClass(/is-visible/);

  await page.setViewportSize({ width: 375, height: 844 });
  expect(Math.round((await hero.boundingBox())?.width ?? 0)).toBe(375);
  await expect(hero.locator('.store-hero-panel[aria-hidden="false"] .store-hero-tags .store-hero-new')).toHaveText(['Handcrafted', 'Limited Edition']);
  await expect(panels.nth(1).locator('.store-hero-primary')).toHaveCSS('object-position', '50% 0%');
  await expect(hero.locator('.store-hero-panel[aria-hidden="false"] .store-hero-price span')).toHaveCSS('color', 'rgb(40, 97, 58)');
  await expect(hero.locator('.store-hero-panel[aria-hidden="false"] del')).toHaveCSS('color', 'rgb(185, 28, 28)');
  const mobile = await panels.nth(1).evaluate(element => {
    const image = element.querySelector('.store-hero-photo')!.getBoundingClientRect();
    const copy = element.querySelector('.store-hero-carousel-copy')!.getBoundingClientRect();
    const hero = element.closest('.store-hero-carousel')!.getBoundingClientRect();
    return { heroTop: hero.top, heroBottom: hero.bottom, imageTop: image.top, imageBottom: image.bottom, imageWidth: image.width, imageHeight: image.height, copyTop: copy.top, copyBottom: copy.bottom, copyBackground: getComputedStyle(element.querySelector('.store-hero-carousel-copy')!).backgroundColor };
  });
  expect(mobile.heroTop).toBe(65);
  expect(mobile.heroBottom).toBeLessThan(844);
  expect(mobile.imageTop).toBe(mobile.copyBottom);
  expect(mobile.imageBottom).toBe(mobile.heroBottom);
  expect(mobile.copyTop).toBe(mobile.heroTop);
  expect(mobile.imageWidth).toBe(375);
  expect(mobile.imageHeight).toBeCloseTo(375 * 10 / 16, 0);
  expect(mobile.copyBackground).toBe('rgb(255, 253, 248)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await hero.evaluate(element => {
    const start = new Touch({ identifier: 1, target: element, clientX: 310, clientY: 300 });
    const end = new Touch({ identifier: 1, target: element, clientX: 90, clientY: 300 });
    element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [start] }));
    element.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [end] }));
  });
  await expect(hero.getByRole('heading', { name: products[1].name })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await hero.getByRole('button', { name: `Show ${products[0].name}` }).click();
  expect(await track.evaluate(element => parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThan(0.001);
  await page.waitForTimeout(2800);
  await expect(hero.getByRole('heading', { name: products[0].name })).toBeVisible();
});

test('empty catalogue keeps the editorial hero and shop link', async ({ page }) => {
  await page.route('**/api/storefront/home', route => route.fulfill({ json: { ...home, heroProducts: [] } }));
  await page.goto('/');
  await expect(page.locator('.store-hero-fallback')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A little more you in every room.');
  await expect(page.locator('.store-hero-fallback').getByRole('link', { name: 'Shop Now' })).toHaveAttribute('href', '/shop');
});
