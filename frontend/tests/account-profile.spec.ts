import { expect, test, type Page } from '@playwright/test';

const customer = { id: '44444444-4444-4444-8444-444444444444', name: 'Asha Rao', email: 'asha@example.test', role: 'CUSTOMER' };

async function mockAccount(page: Page) {
  let name = customer.name;
  await page.route('**/api/auth/refresh', route => route.fulfill({ json: { user: { ...customer, name }, accessToken: 'test-token', expiresIn: 900 } }));
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ...customer, name } }));
  await page.route('**/api/account/photo/config', route => route.fulfill({ json: { maxBytes: 5242880 } }));
  await page.route('**/api/account/profile', route => { name = (route.request().postDataJSON() as { name: string }).name; return route.fulfill({ json: { ...customer, name } }); });
}

for (const width of [1280, 375]) {
  test(`account overview and profile save at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await mockAccount(page);
    await page.goto('/account');
    await expect(page.getByRole('heading', { name: 'My Account' })).toBeVisible();
    await expect(page.getByText(customer.email)).toBeVisible();
    for (const label of ['Profile Details', 'My Orders', 'Manage Addresses']) await expect(page.getByRole('navigation', { name: 'Account sections' }).getByRole('link', { name: new RegExp(label) })).toBeVisible();
    await expect(page.getByLabel('Full name')).toHaveCount(0);
    await page.getByRole('navigation', { name: 'Account sections' }).getByRole('link', { name: /Profile Details/ }).click();
    await expect(page).toHaveURL(/\/account\/profile$/);
    await page.getByLabel('Full name').fill('Asha Sharma');
    await page.getByRole('button', { name: 'Save name' }).click();
    await expect(page.getByRole('status', { name: '' }).filter({ hasText: 'Name saved.' })).toBeVisible();
    await expect(page.getByText('Asha Sharma', { exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

for (const route of ['/login', '/register'] as const) for (const width of [1280, 375]) {
  test(`${route} keeps spinner beside submit label at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.route('**/api/auth/refresh', request => request.fulfill({ status: 401, json: { error: { message: 'No session.' } } }));
    await page.route(`**/api/auth/${route === '/login' ? 'login' : 'register'}`, async request => { await new Promise(resolve => setTimeout(resolve, 800)); await request.fulfill({ status: 400, json: { message: 'Please try again.' } }); });
    await page.goto(route);
    if (route === '/register') { await page.getByLabel('Full name').fill('Asha Rao'); await page.locator('#confirm').fill('password123'); }
    await page.getByLabel('Email address').fill('asha@example.test');
    await page.locator('#password').fill('password123');
    await page.locator('button[type="submit"]').last().click();
    const button = page.locator('.auth-submit-button');
    const icon = button.locator('svg');
    await expect(icon).toBeVisible();
    const bounds = await button.evaluate(element => {
      const icon = element.querySelector('svg')!;
      const buttonRect = element.getBoundingClientRect();
      const iconRect = icon.getBoundingClientRect();
      return { display: getComputedStyle(element).display, buttonCenter: buttonRect.top + buttonRect.height / 2, iconCenter: iconRect.top + iconRect.height / 2, iconLeft: iconRect.left, textLeft: element.getBoundingClientRect().left + element.clientWidth / 2 };
    });
    expect(['flex', 'inline-flex']).toContain(bounds.display);
    expect(Math.abs(bounds.iconCenter - bounds.buttonCenter)).toBeLessThan(2);
    expect(bounds.iconLeft).toBeLessThan(bounds.textLeft);
  });
}
