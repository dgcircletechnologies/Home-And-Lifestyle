import { test, expect } from '@playwright/test';

const variants = [
  { id: 'large', sku: 'VASE-L', pricePaise: 120000, effectivePricePaise: 100000, compareAtPricePaise: 120000, stockQuantity: 3, available: true, attributes: [{ title: 'Size', value: 'Large' }, { title: 'Color', value: 'Terracotta' }] },
  { id: 'small', sku: 'VASE-S', pricePaise: 70000, effectivePricePaise: 60000, compareAtPricePaise: 70000, stockQuantity: 0, available: false, attributes: [] },
];
const product = { id: 'vase', name: 'Ceramic vase', slug: 'ceramic-vase', description: 'A vase.', story: null, isFeatured: false, giftWrapEligible: false, image: null, images: [], categories: [{ name: 'Decor', slug: 'decor' }], variantCount: 2, minPricePaise: 60000, maxPricePaise: 100000, compareAtPricePaise: 70000, available: true, variants };

test('cards distinguish single and multiple variants; PDP selects an in-stock SKU and updates features', async ({ page }) => {
  await page.route('**/api/storefront/shop?*', route => route.fulfill({ json: { items: [product, { ...product, id: 'single', name: 'Single vase', variantCount: 1, variants: [variants[0]], minPricePaise: 100000, compareAtPricePaise: 120000 }], total: 2, totalPages: 1, page: 1, pageSize: 20, filters: {}, onSale: true } }));
  await page.route('**/api/storefront/products/ceramic-vase', route => route.fulfill({ json: product }));
  await page.goto('/shop');
  await expect(page.locator('.store-product-card').first().locator('.store-price')).toContainText('Starts from ₹600');
  await expect(page.locator('.store-product-card').nth(1).locator('.store-price')).not.toContainText('Starts from');
  await page.goto('/products/ceramic-vase');
  await expect(page.getByText('SKU VASE-L')).toBeVisible();
  await expect(page.getByText('Terracotta', { exact: true })).toBeVisible();
  await expect(page.locator('.store-pdp-price')).toContainText('₹1,000');
  await page.getByRole('button', { name: /₹600/ }).click();
  await expect(page.getByText('SKU VASE-S')).toBeVisible();
  await expect(page.locator('.store-pdp-price')).toContainText('₹600');
  await expect(page.getByText('Terracotta')).toHaveCount(0);
  await expect(page.locator('.store-pdp-stock')).toHaveText('Out of stock');
  await expect(page.getByLabel('Check delivery PIN')).toHaveCount(0);
});
