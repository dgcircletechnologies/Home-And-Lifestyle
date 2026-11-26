import { expect, test } from '@playwright/test';

const storeConfig = {
  storeName: 'Home & Lifestyle',
  supportEmail: 'care@homeandlifestyle.in',
  supportPhone: '+91 98765 43210',
  publicAddress: 'Studio 12, Indiranagar, Bengaluru 560038',
  market: 'India',
  currency: 'INR',
  language: 'English',
  timezone: 'Asia/Kolkata',
  gifting: { giftMessagesAvailable: true, giftReceiptsAvailable: false, giftWrapFeePaise: 15000 },
};

const navigationData = {
  categories: [
    { id: 'c1', name: 'Home Décor', slug: 'home-decor', parentId: null, image: null },
    { id: 'c2', name: 'Kitchen', slug: 'kitchen', parentId: null, image: null },
  ],
  collections: [],
};

const customerUser = {
  id: 'u1',
  name: 'Priya Patel',
  email: 'priya@example.com',
  role: 'CUSTOMER',
  avatarUrl: null,
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
};

test.describe('Mobile Sidebar Drawer & Top Navbar Auth Consolidation', () => {
  const viewports = [
    { name: '360px', width: 360, height: 740 },
    { name: '375px', width: 375, height: 844 },
  ];

  for (const vp of viewports) {
    test.describe(`Viewport ${vp.name}`, () => {
      test('logged-out guest: mobile drawer shows only search and navbar links; top bar has login', async ({ page }) => {
        await page.route('**/api/store/config', route => route.fulfill({ json: storeConfig }));
        await page.route('**/api/storefront/navigation', route => route.fulfill({ json: navigationData }));
        await page.route('**/api/storefront/home', route => route.fulfill({ json: { categories: navigationData.categories, featured: [], latest: [], giftable: [], collections: [], offers: [] } }));
        await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: { message: 'Unauthorized' } }));

        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto('/');

        // 1. Top bar has the login link for guest
        const topLogin = page.locator('.store-header-actions .store-login');
        await expect(topLogin).toBeVisible();
        await expect(topLogin).toHaveAttribute('href', /^\/login/);

        // 2. Open mobile drawer via hamburger button
        const hamburger = page.locator('.store-hamburger');
        await expect(hamburger).toBeVisible();
        await hamburger.click();

        const drawer = page.locator('#store-drawer');
        await expect(drawer).toBeVisible();

        // 3. Drawer contains Search
        const searchInput = drawer.locator('#mobile-shop-search');
        await expect(searchInput).toBeVisible();

        // 4. Drawer contains main navigation links
        const nav = drawer.locator('nav[aria-label="Mobile shop"]');
        await expect(nav).toBeVisible();
        await expect(nav.getByRole('link', { name: 'Home' })).toBeVisible();
        await expect(nav.getByRole('link', { name: 'Shop All' })).toBeVisible();
        await expect(nav.getByRole('link', { name: 'New Arrivals' })).toBeVisible();
        await expect(nav.getByRole('link', { name: 'About' })).toBeVisible();

        // 5. Drawer strictly contains NO auth / login / sign up / account links
        await expect(drawer.locator('.store-drawer-account')).toHaveCount(0);
        await expect(drawer.locator('.store-drawer-login')).toHaveCount(0);
        await expect(drawer.locator('a[href^="/login"]')).toHaveCount(0);
        await expect(drawer.locator('a[href^="/register"]')).toHaveCount(0);
        await expect(drawer.locator('a[href^="/account"]')).toHaveCount(0);
        await expect(drawer.locator('.store-drawer-secondary')).toHaveCount(0);

        // 6. Close drawer
        await drawer.locator('[data-close]').click();
        await expect(drawer).not.toHaveClass(/is-open/);
      });

      test('logged-in customer: mobile drawer shows only search and navbar links; top bar profile dropdown functions', async ({ page }) => {
        await page.route('**/api/store/config', route => route.fulfill({ json: storeConfig }));
        await page.route('**/api/storefront/navigation', route => route.fulfill({ json: navigationData }));
        await page.route('**/api/storefront/home', route => route.fulfill({ json: { categories: navigationData.categories, featured: [], latest: [], giftable: [], collections: [], offers: [] } }));
        await page.route('**/api/auth/me', route => route.fulfill({ status: 200, json: customerUser }));

        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto('/');

        // 1. Top bar has the customer avatar account button
        const accountButton = page.locator('.store-header-actions .store-account-button');
        await expect(accountButton).toBeVisible();

        // Click to open popover
        await accountButton.click();
        const popover = page.locator('.store-account-popover');
        await expect(popover).toBeVisible();
        await expect(popover.getByRole('menuitem', { name: 'My Account' })).toHaveAttribute('href', '/account');
        await expect(popover.getByRole('menuitem', { name: 'Profile Details' })).toHaveAttribute('href', '/account/profile');
        await expect(popover.getByRole('menuitem', { name: 'My Orders' })).toHaveAttribute('href', '/account/orders');
        await expect(popover.getByRole('menuitem', { name: 'Manage Addresses' })).toHaveAttribute('href', '/account/addresses');
        await expect(popover.getByRole('menuitem', { name: 'Logout' })).toBeVisible();

        // Close account popover by clicking outside or pressing Escape
        await page.keyboard.press('Escape');
        await expect(popover).not.toBeVisible();

        // 2. Open mobile drawer via hamburger button
        const hamburger = page.locator('.store-hamburger');
        await expect(hamburger).toBeVisible();
        await hamburger.click();

        const drawer = page.locator('#store-drawer');
        await expect(drawer).toBeVisible();

        // 3. Drawer contains Search and Navbar links only
        await expect(drawer.locator('#mobile-shop-search')).toBeVisible();
        const nav = drawer.locator('nav[aria-label="Mobile shop"]');
        await expect(nav).toBeVisible();
        await expect(nav.getByRole('link', { name: 'Home' })).toBeVisible();
        await expect(nav.getByRole('link', { name: 'Shop All' })).toBeVisible();

        // 4. Confirm strictly NO Profile / Account / Logout in drawer
        await expect(drawer.locator('.store-drawer-account')).toHaveCount(0);
        await expect(drawer.locator('.store-drawer-identity')).toHaveCount(0);
        await expect(drawer.locator('a[href^="/account"]')).toHaveCount(0);
        await expect(drawer.getByRole('button', { name: 'Logout' })).toHaveCount(0);
        await expect(drawer.getByRole('button', { name: 'Signing out…' })).toHaveCount(0);
        await expect(drawer.locator('.store-drawer-secondary')).toHaveCount(0);
      });
    });
  }
});
