import { expect, test } from '@playwright/test';

const primary = { url: '/images/auth-interior.png', altText: 'Category Scene' };
const secondary = { url: '/images/home-hero-placeholder.png', altText: 'Category Hover Scene' };

const category1 = { id: 'c1', name: 'Home Décor', slug: 'home-decor', parentId: null, image: primary, primaryImage: primary, secondaryImage: secondary };
const category2 = { id: 'c2', name: 'Kitchen & Dining', slug: 'kitchen-dining', parentId: null, image: primary, primaryImage: primary };
const category3 = { id: 'c3', name: 'Lighting', slug: 'lighting', parentId: null, image: primary, primaryImage: primary };

const sampleProduct = {
  id: 'p1',
  name: 'Ceramic Urn',
  slug: 'ceramic-urn',
  description: 'Handcrafted urn.',
  story: null,
  image: primary,
  minPricePaise: 150000,
  maxPricePaise: 150000,
  compareAtPricePaise: null,
  variantCount: 1,
  available: true,
  isFeatured: true,
  giftWrapEligible: false,
  categories: [category1],
  variants: [{ id: 'v1', sku: 'URN-1', pricePaise: 150000, effectivePricePaise: 150000, compareAtPricePaise: null, stockQuantity: 4, attributes: [], dimensions: null, optionCombinationKey: '[]', available: true }],
};

const homeData = {
  categories: [category1, category2, category3],
  featured: [sampleProduct],
  latest: [sampleProduct],
  giftable: [],
  collections: [],
  categoryRows: [{ slug: category1.slug, products: [sampleProduct] }],
  offers: [{ id: 'off-1', title: 'Decor Sale', discountType: 'PERCENTAGE', discountValue: 15, targetType: 'CATEGORY', targetId: 'c1', targetName: 'Home Décor', targetSlug: 'home-decor' }],
  videoProducts: [],
};

test.describe('Category cards editorial redesign and Footer spacing', () => {
  test('category cards render full-bleed with gradient scrim, white title, explore cue, and 3-column desktop layout', async ({ page }) => {
    await page.route('**/api/storefront/home', route => route.fulfill({ json: homeData }));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const categoryCard = page.locator('.store-categories .store-category-tile').first();
    await expect(categoryCard).toBeVisible();

    // Verify 3 columns on desktop (visibly wider than 4-column product grid)
    const gridCols = await page.locator('.store-categories .store-category-grid').evaluate(el => {
      const cs = getComputedStyle(el);
      return cs.gridTemplateColumns.split(' ').length;
    });
    expect(gridCols).toBe(3);

    // Verify full-bleed editorial card styles
    const scrim = categoryCard.locator('.store-category-scrim');
    await expect(scrim).toBeVisible();

    const title = categoryCard.locator('.store-category-name');
    await expect(title).toHaveText('Home Décor');
    const titleColor = await title.evaluate(el => getComputedStyle(el).color);
    expect(titleColor).toBe('rgb(255, 255, 255)');

    const actionCue = categoryCard.locator('.store-category-action');
    await expect(actionCue).toContainText('Explore');

    // Verify offer badge positioning in top-right
    const badge = categoryCard.locator('.store-category-offer-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('15% OFF');
    const badgeTop = await badge.evaluate(el => parseFloat(getComputedStyle(el).top));
    expect(badgeTop).toBeLessThanOrEqual(20);

    // Verify secondary hover image crossfade
    const altImg = categoryCard.locator('.store-category-alt');
    await expect(altImg).toHaveCSS('opacity', '0');
    await categoryCard.hover();
    await expect(altImg).toHaveCSS('opacity', '1');

    // Verify "Shop by category" heading and "Explore all categories" button stay in the same row
    const headingBox = await page.locator('#categories-title').boundingBox();
    const ctaBox = await page.locator('.store-categories .store-home-cta').boundingBox();
    expect(headingBox).not.toBeNull();
    expect(ctaBox).not.toBeNull();
    // They should overlap vertically (same row)
    expect(Math.abs(headingBox!.y - ctaBox!.y)).toBeLessThan(35);
  });

  test('mobile category cards scroll horizontally with peek and zero page overflow', async ({ page }) => {
    await page.route('**/api/storefront/home', route => route.fulfill({ json: homeData }));
    await page.setViewportSize({ width: 375, height: 844 });
    await page.goto('/');

    const categoryGrid = page.locator('.store-categories .store-category-grid');
    await expect(categoryGrid).toBeVisible();

    const isScrollable = await categoryGrid.evaluate(el => el.scrollWidth > el.clientWidth);
    expect(isScrollable).toBe(true);

    // Cards should be wider than product cards (at least 70vw)
    const cardWidth = await page.locator('.store-categories .store-category-tile').first().evaluate(el => el.clientWidth);
    expect(cardWidth).toBeGreaterThanOrEqual(260);

    // Check zero horizontal page overflow
    const hasNoOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(hasNoOverflow).toBe(true);
  });

  test('footer has clean column spacing on desktop and compact top padding on mobile', async ({ page }) => {
    await page.route('**/api/storefront/home', route => route.fulfill({ json: homeData }));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const footer = page.locator('footer.store-footer');
    await expect(footer).toBeVisible();

    // Desktop footer grid columns: 4 columns
    const desktopCols = await footer.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(desktopCols).toBe(4);

    // Consistent link gap in nav columns
    const navGap = await footer.locator('nav').first().evaluate(el => getComputedStyle(el).gap);
    expect(navGap).toBe('8px');

    // Check mobile (~375px) top padding is compact (32px / pt-8) with no excessive space
    await page.setViewportSize({ width: 375, height: 844 });
    const mobilePaddingTop = await footer.evaluate(el => parseFloat(getComputedStyle(el).paddingTop));
    expect(mobilePaddingTop).toBeLessThanOrEqual(36);
    expect(mobilePaddingTop).toBeGreaterThanOrEqual(28);

    // Footer intro spans full width on mobile
    const introGridCol = await footer.locator('.store-footer-intro').evaluate(el => getComputedStyle(el).gridColumn);
    expect(introGridCol).toContain('1 / -1');

    // Bottom legal copyright bar has border-top
    const bottomBorder = await footer.locator('.store-footer-bottom').evaluate(el => getComputedStyle(el).borderTopWidth);
    expect(parseFloat(bottomBorder)).toBeGreaterThan(0);
  });
});
