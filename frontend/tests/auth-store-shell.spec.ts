import { test, expect } from '@playwright/test';

for (const route of ['/login', '/register'] as const) {
  test(`${route} shows customer navigation and footer without changing the auth form`, async ({ page }) => {
    await page.route('**/api/auth/refresh', request => request.fulfill({ status: 401, json: { error: { code: 'REFRESH_INVALID', message: 'No session.' } } }));
    await page.goto(route);
    await expect(page.locator('.store-header')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Shop' }).getByRole('link', { name: 'Shop All' })).toBeVisible();
    await expect(page.locator('.store-footer')).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('.store-header-actions .store-login')).toHaveText(route === '/login' ? 'Sign up' : 'Login');
    await expect(page.locator('.store-header-actions .store-login')).toHaveAttribute('href', route === '/login' ? '/register' : '/login');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.store-header')).toBeVisible();
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('navigation', { name: 'Mobile shop' }).getByRole('link', { name: 'Shop All' })).toBeVisible();
    await expect(page.locator('.store-footer')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}
