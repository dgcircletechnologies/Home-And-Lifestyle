import { test, expect } from '@playwright/test';

const image = { url: '/images/auth-interior.png', altText: 'A styled living room' };
const product = (index: number, category: string) => ({
  id: `piece-${index}`, name: `${category} piece ${index}`, slug: `piece-${index}`,
  image, images: [image], minPricePaise: 100000 + index * 10000,
  maxPricePaise: 100000 + index * 10000, compareAtPricePaise: null, available: true,
  categories: [{ name: category, slug: category.toLowerCase() }],
});
const lighting = Array.from({ length: 4 }, (_, index) => product(index + 1, 'Lighting'));
const kitchen = Array.from({ length: 4 }, (_, index) => product(index + 5, 'Kitchen'));
const planters = Array.from({ length: 4 }, (_, index) => product(index + 9, 'Planters & Greenery'));
const home = {
  categories: [
    { id: 'lighting', name: 'Lighting', slug: 'lighting', parentId: null, image },
    { id: 'kitchen', name: 'Kitchen', slug: 'kitchen', parentId: null, image },
    { id: 'planters', name: 'Planters & Greenery', slug: 'planters', parentId: null, image },
  ],
  featured: lighting, latest: kitchen, giftable: [kitchen[0]],
  collections: [{ name: 'The Sunday Edit', slug: 'sunday-edit', description: 'A few pieces for home.', products: [lighting[0]] }],
  categoryRows: [{ slug: 'lighting', products: lighting }, { slug: 'kitchen', products: kitchen }, { slug: 'planters', products: planters }],
  offers: [],
};

test('homepage keeps editorial sections and shows shared category cards in desktop and mobile layouts', async ({ page }) => {
  await page.route('**/api/storefront/home', route => route.fulfill({ json: home }));
  await page.route('**/api/storefront/serviceability/110001', route => route.fulfill({ json: { pinCode: '110001', available: true, message: 'Delivery is available for this PIN.' } }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'A little more you in every room.' })).toBeVisible();
  await expect.poll(() => page.locator('.store-hero-art img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole('link', { name: 'Explore all categories' })).toHaveCSS('border-bottom-width', '0px');
  await expect(page.locator('.store-edit')).toBeVisible();
  await expect(page.locator('.store-home-category-row')).toHaveCount(3);
  await expect(page.locator('.store-home-category-row').first().locator('.store-product-card')).toHaveCount(4);
  await expect(page.locator('.store-home-category-row').first().locator('.store-price').first()).toContainText('₹1,100');
  const order = await page.locator('.store-edit, .store-home-category-row, .store-gifting').evaluateAll(elements => elements.map(element => element.classList.contains('store-edit') ? 'edit' : element.classList.contains('store-gifting') ? 'gifting' : 'row'));
  expect(order).toEqual(['edit', 'row', 'row', 'row', 'gifting']);
  await expect(page.locator('.store-home-category-row .store-product-grid').first()).toHaveCSS('display', 'grid');
  const ctas = page.locator('.store-home-cta');
  await expect(ctas).toHaveCount(9);
  const styles = await ctas.evaluateAll(elements => elements.map(element => ({ background: getComputedStyle(element).backgroundColor, image: getComputedStyle(element).backgroundImage, text: getComputedStyle(element).color, border: getComputedStyle(element).borderBottomWidth, radius: getComputedStyle(element).borderRadius })));
  expect(new Set(styles.map(style => style.background)).size).toBe(1);
  expect(styles.every(style => style.background === 'rgb(77, 41, 70)' && style.image === 'none' && style.text === 'rgb(255, 253, 248)' && style.border === '0px' && style.radius === '999px')).toBe(true);
  await expect(page.locator('.store-home-category-row').first().getByRole('link', { name: 'Shop all' })).toHaveAttribute('href', '/categories/lighting');
  await expect(page.getByRole('link', { name: 'Explore the collections' })).toHaveAttribute('href', '/collections/sunday-edit');
  const categoryCta = page.getByRole('link', { name: 'Explore all categories' });
  await categoryCta.focus();
  await expect(categoryCta).toHaveCSS('outline-width', '3px');
  await categoryCta.hover();
  await expect.poll(() => categoryCta.evaluate(button => getComputedStyle(button).backgroundColor)).not.toBe('rgb(77, 41, 70)');

  for (const width of [390, 375, 360]) {
    await page.setViewportSize({ width, height: 844 });
    for (const header of await page.locator('.store-categories .store-section-heading, .store-home-category-row .store-section-heading').all()) {
      const placement = await header.evaluate(element => {
        const heading = element.querySelector('h2')!.getBoundingClientRect(), button = element.querySelector('.store-home-cta')!.getBoundingClientRect();
        return { direction: getComputedStyle(element).flexDirection, headingRight: heading.right, buttonLeft: button.left, buttonRight: button.right, width: innerWidth };
      });
      expect(placement.direction).toBe('row');
      expect(placement.headingRight).toBeLessThan(placement.buttonLeft);
      expect(placement.buttonRight).toBeLessThanOrEqual(placement.width);
    }
    for (const selector of ['.store-category-grid', '.store-arrivals .store-product-grid', '.store-home-category-row .store-product-grid']) {
      for (const strip of await page.locator(selector).all()) {
        const dimensions = await strip.evaluate(element => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }));
        expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
        await strip.evaluate(element => element.scrollTo({ left: 180, behavior: 'instant' }));
        await expect.poll(() => strip.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await page.getByLabel('Indian PIN code').fill('110001');
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.getByText('Delivery is available for this PIN.')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.locator('.store-home-category-row .store-product-photo img').first().evaluate(image => parseFloat(getComputedStyle(image).transitionDuration))).toBeLessThan(0.001);
  expect(await categoryCta.evaluate(button => parseFloat(getComputedStyle(button).transitionDuration))).toBeLessThan(0.001);
});

test('live product and category offers animate, route correctly, and badge only the targeted category', async ({ page }) => {
  const offers = [
    { id: 'product-offer', title: 'Lamp special', discountType: 'PERCENTAGE', discountValue: 20, targetType: 'PRODUCT', targetId: lighting[0].id, targetName: lighting[0].name, targetSlug: lighting[0].slug },
    { id: 'category-offer', title: 'Planter special', discountType: 'FIXED', discountValue: 200, targetType: 'CATEGORY', targetId: 'planters', targetName: 'Planters & Greenery', targetSlug: 'planters' },
  ];
  await page.route('**/api/storefront/home', route => route.fulfill({ json: { ...home, offers } }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const strip = page.locator('.store-offers');
  await expect(strip.getByRole('heading', { name: 'Offers live now', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  expect(await strip.evaluate(element => Boolean(element.compareDocumentPosition(document.querySelector('.store-categories')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  const tracks = strip.locator('.store-offers-track');
  await expect(tracks).toHaveCount(2);
  const widths = await tracks.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().width));
  expect(widths[0]).toBeGreaterThan(1440);
  expect(Math.abs(widths[0] - widths[1])).toBeLessThan(1);
  const motion = strip.locator('.store-offers-motion');
  const firstX = await motion.evaluate(element => new DOMMatrix(getComputedStyle(element).transform).m41);
  await page.waitForTimeout(250);
  const secondX = await motion.evaluate(element => new DOMMatrix(getComputedStyle(element).transform).m41);
  expect(secondX).toBeLessThan(firstX);
  await strip.locator('.store-offers-window').hover();
  await expect(motion).toHaveCSS('animation-play-state', 'paused');
  await page.mouse.move(0, 0);
  await strip.getByRole('link', { name: '20% off on Lighting piece 1' }).focus();
  await expect(motion).toHaveCSS('animation-play-state', 'paused');
  await expect(strip.getByRole('link', { name: '₹200 off on Planters & Greenery' })).toHaveAttribute('href', '/categories/planters');
  await expect(page.locator('.store-categories .store-category-tile').nth(2).locator('.store-category-offer-badge')).toHaveText('₹200 OFF');
  await expect(page.locator('.store-categories .store-category-tile').first().locator('.store-category-offer-badge')).toHaveCount(0);
  await expect(page.locator('.store-home-category-row').nth(2).locator('.store-category-offer-badge')).toHaveText('₹200 OFF');
  await expect(page.locator('.store-home-category-row').first().locator('.store-category-offer-badge')).toHaveCount(0);
  await page.setViewportSize({ width: 375, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  const rowHeader = page.locator('.store-home-category-row').nth(2).locator('.store-section-heading');
  expect(await rowHeader.evaluate(element => { const title = element.querySelector('.store-home-category-title')!.getBoundingClientRect(), button = element.querySelector('.store-home-cta')!.getBoundingClientRect(); return title.right < button.left && button.right <= innerWidth; })).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(motion).toHaveCSS('animation-name', 'none');
  await expect(strip.locator('.store-offers-window')).toHaveCSS('overflow-x', 'auto');
  await expect(strip.locator('.store-offer-item[aria-hidden=true]').first()).toBeHidden();
  await strip.getByRole('link', { name: '20% off on Lighting piece 1' }).click();
  await expect(page).toHaveURL(/\/products\/piece-1/);
  await page.goto('/');
  await strip.getByRole('link', { name: '₹200 off on Planters & Greenery' }).click();
  await expect(page).toHaveURL(/\/categories\/planters/);
});

test('homepage omits the offers strip and badges when no offer is active', async ({ page }) => {
  await page.route('**/api/storefront/home', route => route.fulfill({ json: home }));
  await page.goto('/');
  await expect(page.locator('.store-categories')).toBeVisible();
  await expect(page.locator('.store-offers')).toHaveCount(0);
  await expect(page.locator('.store-category-offer-badge')).toHaveCount(0);
});

test('a single active offer still fills both seamless ticker tracks', async ({ page }) => {
  const offer = { id: 'single', title: 'Lamp special', discountType: 'PERCENTAGE', discountValue: 10, targetType: 'PRODUCT', targetId: lighting[0].id, targetName: lighting[0].name, targetSlug: lighting[0].slug };
  await page.route('**/api/storefront/home', route => route.fulfill({ json: { ...home, offers: [offer] } }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const tracks = page.locator('.store-offers-track');
  await expect(tracks).toHaveCount(2);
  const widths = await tracks.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().width));
  expect(widths[0]).toBeGreaterThan(1440);
  expect(Math.abs(widths[0] - widths[1])).toBeLessThan(1);
  await expect(page.getByRole('link', { name: '10% off on Lighting piece 1' })).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
});
