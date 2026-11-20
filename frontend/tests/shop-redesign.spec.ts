import { test, expect } from '@playwright/test';

const products = Array.from({ length: 26 }, (_, index) => ({
  id: `fixture-${String(index).padStart(2, '0')}`, name: `Fixture piece ${String(index + 1).padStart(2, '0')}`,
  slug: 'demo-lilac-taper-candle', image: null, images: [], minPricePaise: 10000 + index * 100,
  maxPricePaise: 10000 + index * 100, compareAtPricePaise: null, available: true,
  categories: [{ name: 'Lighting', slug: 'demo-lighting' }],
}));

test('Shop All drawer and sort remain legible; URL restores filtered page two', async ({ page }) => {
  await page.route('**/api/storefront/shop?*', route => {
    const url = new URL(route.request().url()), sort = url.searchParams.get('sort') ?? 'newest', currentPage = Number(url.searchParams.get('page') ?? 1);
    const ordered = [...products].sort((a, b) => sort === 'price-asc' ? a.minPricePaise - b.minPricePaise : sort === 'price-desc' ? b.minPricePaise - a.minPricePaise : sort === 'name-asc' ? a.name.localeCompare(b.name) : sort === 'name-desc' ? b.name.localeCompare(a.name) : b.id.localeCompare(a.id));
    return route.fulfill({ json: { items: ordered.slice((currentPage - 1) * 20, currentPage * 20), total: 26, totalPages: 2, page: currentPage, pageSize: 20, filters: { category: [{ value: 'demo-lighting', label: 'Lighting' }] }, onSale: false } });
  });
  await page.goto('/shop');
  await expect(page.getByText('Showing 1–20 of 26 products')).toBeVisible();
  await expect(page.locator('.shop-toolbar')).toHaveCSS('border-top-width', '0px');
  await expect(page.locator('.shop-toolbar')).toHaveCSS('border-bottom-width', '0px');
  await page.getByRole('button', { name: /Filters/ }).first().click();
  await expect(page.locator('.shop-filter-backdrop')).toHaveCSS('background-color', 'rgba(18, 20, 17, 0.32)');
  await page.getByRole('checkbox', { name: 'Lighting' }).check();
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page).toHaveURL(/category=demo-lighting/);
  const appliedUrl = page.url();
  await page.getByRole('button', { name: 'Edit Category: Lighting' }).click();
  await expect(page.getByRole('checkbox', { name: 'Lighting' })).toBeChecked();
  await expect(page).toHaveURL(appliedUrl);
  await page.getByRole('checkbox', { name: 'Lighting' }).uncheck();
  await page.getByRole('button', { name: 'Close filters' }).click();
  await expect(page.getByRole('dialog', { name: 'Filters' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit Category: Lighting' }).click();
  await expect(page.getByRole('checkbox', { name: 'Lighting' })).toBeChecked();
  await page.getByRole('button', { name: 'Close filters' }).click();
  await expect(page.getByRole('dialog', { name: 'Filters' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Clear all filters' })).toBeVisible();
  await page.getByRole('button', { name: /Sort by:/ }).click();
  await expect(page.getByRole('option')).toHaveCount(5);
  for (const option of await page.getByRole('option').all()) await expect(option).toHaveCSS('color', 'rgb(32, 34, 30)');
  await page.getByRole('option', { name: 'Price: Low to high' }).click();
  await expect(page).toHaveURL(/sort=price-asc/);
  await expect(page.locator('.store-product-card')).toHaveCount(20);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Showing 21–26 of 26 products')).toBeVisible();
  await expect(page.locator('.store-product-card')).toHaveCount(6);
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByText('Showing 21–26 of 26 products')).toBeVisible();
  await expect(page.getByRole('button', { name: /Sort by:/ })).toContainText('Price: Low to high');
});

test('discounted cards show a red pulsing corner ribbon; regular cards do not', async ({ page }) => {
  await page.route('**/api/storefront/shop?*', route => route.fulfill({ json: {
    items: [
      { ...products[0], id: 'offer', minPricePaise: 16000, maxPricePaise: 16000, compareAtPricePaise: 20000, available: false },
      { ...products[1], id: 'regular' },
    ],
    total: 2, totalPages: 1, page: 1, pageSize: 20, filters: {}, onSale: true,
  } }));
  await page.goto('/shop');
  const offered = page.locator('.store-product-card').first(), regular = page.locator('.store-product-card').nth(1);
  await expect(offered.locator('.store-offer-ribbon')).toHaveText('₹40 OFF');
  await expect(offered.locator('.store-stock-overlay')).toHaveText('Out of stock');
  await expect(offered.locator('.store-stock-overlay')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.56)');
  await expect(offered.locator('.store-stock-overlay')).toHaveCSS('color', 'rgb(255, 119, 126)');
  await expect(offered.locator('.store-price')).toHaveCSS('color', 'rgb(40, 97, 58)');
  await expect(offered.locator('.store-price del')).toHaveCSS('color', 'rgb(173, 48, 56)');
  await expect(offered.locator('.store-offer-ribbon-surface')).toHaveCSS('background-color', 'rgb(169, 31, 40)');
  await expect(offered.locator('.store-offer-ribbon-surface')).toHaveCSS('animation-name', 'store-offer-pulse');
  await expect(regular.locator('.store-offer-ribbon')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(offered.locator('.store-offer-ribbon-surface')).toHaveCSS('animation-name', 'none');
  await offered.locator('.store-product-photo').click();
  await expect(page).toHaveURL(/\/products\/demo-lilac-taper-candle/);
});
