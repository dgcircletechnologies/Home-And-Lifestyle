import { expect, test } from '@playwright/test';

const routes = ['/shipping-policy', '/cancellation-and-returns', '/privacy-policy', '/terms-and-conditions', '/faq', '/contact'];
const store = { storeName: 'Home & Lifestyle', supportEmail: 'live@example.in', supportPhone: '+91 98765 43210', publicAddress: 'Live studio, Jaipur', businessHours: 'Monday–Saturday, 10 AM–6 PM IST', market: 'India', currency: 'INR', language: 'English', timezone: 'Asia/Kolkata', gifting: { giftMessagesAvailable: false, giftReceiptsAvailable: false, giftWrapFeePaise: 0 } };

test.beforeEach(async ({ page }) => {
  await page.route('**/api/store/config', route => route.fulfill({ json: store }));
  await page.route('**/api/storefront/navigation', route => route.fulfill({ json: { categories: [], collections: [] } }));
});

test('policy and support pages render at desktop and mobile with live details and working footer links', async ({ page }) => {
  test.setTimeout(120_000);
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of routes) {
      const response = await page.goto(route);
      expect(response?.status(), route).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.locator('.store-footer')).toBeVisible();
      expect(await page.locator('.store-footer a[href="#"]').count()).toBe(0);
      const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, elements: [...document.querySelectorAll('*')].filter(el => el.getBoundingClientRect().right > window.innerWidth + 2).slice(0, 8).map(el => [el.tagName, el.className, Math.round(el.getBoundingClientRect().right)]) }));
      expect(overflow.width, `${route} at ${width}px: ${JSON.stringify(overflow.elements)}`).toBeLessThanOrEqual(width);
    }
    await page.goto('/contact');
    await expect(page.locator('#main').getByRole('link', { name: store.supportEmail })).toHaveAttribute('href', `mailto:${store.supportEmail}`);
    await expect(page.locator('#main').getByRole('link', { name: store.supportPhone })).toHaveAttribute('href', 'tel:+919876543210');
    await expect(page.locator('#main').getByText(store.publicAddress)).toBeVisible();
    await expect(page.locator('#main').getByText(store.businessHours)).toBeVisible();
    const footerLinks = await page.locator('.store-footer a[href^="/"]').evaluateAll(links => [...new Set(links.map(link => link.getAttribute('href')!))]);
    for (const href of footerLinks) {
      const response = await page.goto(href);
      expect(response?.status(), href).toBe(200);
    }
  }
  await page.goto('/shipping-policy');
  await expect(page.locator('#main').getByRole('link', { name: store.supportEmail })).toHaveAttribute('href', `mailto:${store.supportEmail}`);
});

test('FAQ accordion opens by keyboard and closes by click', async ({ page }) => {
  await page.goto('/faq');
  const first = page.locator('.store-faq-list details').first();
  await first.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(first).toHaveAttribute('open', '');
  await first.locator('summary').click();
  await expect(first).not.toHaveAttribute('open', '');
});
