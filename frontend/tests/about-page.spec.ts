import { expect, test } from '@playwright/test';

const store = (publicAddress: string | null) => ({
  storeName: 'Home & Lifestyle', supportEmail: 'hello@example.in', supportPhone: '+91 98765 43210', publicAddress,
  market: 'India', currency: 'INR', language: 'English', timezone: 'Asia/Kolkata',
  gifting: { giftMessagesAvailable: false, giftReceiptsAvailable: false, giftWrapFeePaise: 0 },
});

test('About is reachable from desktop and mobile navigation and shows live public store details', async ({ page }) => {
  let address = 'Studio 4, Market Road\nJaipur, Rajasthan 302001';
  await page.route('**/api/store/config', route => route.fulfill({ json: store(address) }));
  await page.route('**/api/storefront/navigation', route => route.fulfill({ json: { categories: [
    { id: 'lighting', name: 'Lighting', slug: 'lighting', parentId: null },
    { id: 'kitchen', name: 'Kitchen & Dining', slug: 'kitchen-dining', parentId: null },
  ], collections: [] } }));
  await page.route('**/api/storefront/home', route => route.fulfill({ json: { categories: [], featured: [], latest: [], giftable: [], collections: [], categoryRows: [], offers: [] } }));

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.store-desktop-nav > a').last()).toHaveText('About');
  await page.locator('.store-desktop-nav').getByRole('link', { name: 'About' }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.locator('.store-desktop-nav').getByRole('link', { name: 'About' })).toHaveAttribute('aria-current','page');
  await expect(page.locator('.store-footer').getByRole('link', { name: 'About' })).toHaveAttribute('href','/about');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.locator('#main').getByRole('link', { name: 'hello@example.in' })).toHaveAttribute('href','mailto:hello@example.in');
  await expect(page.locator('#main').getByRole('link', { name: '+91 98765 43210' })).toHaveAttribute('href','tel:+919876543210');
  await expect(page.locator('#main').getByText('Studio 4, Market Road')).toBeVisible();
  await expect.poll(() => page.locator('.store-about-hero-image img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
  const desktopSections = await page.locator('.store-about > section').evaluateAll(sections => sections.map(section => ({ width: section.getBoundingClientRect().width, left: section.getBoundingClientRect().left })));
  expect(desktopSections[0].width).toBe(1440);
  expect(desktopSections[2].width).toBe(1440);
  expect(desktopSections[1].width).toBeGreaterThan(1200);

  address = 'Updated studio address\nPune, Maharashtra';
  await page.reload();
  await expect(page.locator('#main').getByText('Updated studio address')).toBeVisible();
  await expect(page.locator('#main').getByText('Studio 4, Market Road')).toHaveCount(0);

  for (const width of [390, 375, 360]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Open navigation' }).click();
    const mobileAbout = page.getByRole('dialog', { name: 'Shop navigation' }).getByRole('link', { name: 'About' });
    await expect(page.locator('.store-drawer nav > a').last()).toHaveText('About');
    await mobileAbout.click();
    await expect(page).toHaveURL(/\/about$/);
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('dialog', { name: 'Shop navigation' }).getByRole('link', { name: 'About' })).toHaveAttribute('aria-current','page');
    await page.getByRole('button', { name: 'Close menu' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.locator('.store-about-section').evaluate(section => section.getBoundingClientRect().left)).toBeGreaterThanOrEqual(24);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test('About omits missing contact fields and presents a clean fallback', async ({ page }) => {
  await page.route('**/api/store/config', route => route.fulfill({ json: { ...store(null), supportEmail: null, supportPhone: null } }));
  await page.goto('/about');
  await expect(page.getByText('Our contact details are being updated.')).toBeVisible();
  await expect(page.locator('.store-about-contact-item')).toHaveCount(0);
});
