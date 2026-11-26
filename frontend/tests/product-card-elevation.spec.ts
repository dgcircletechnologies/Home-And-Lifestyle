import { expect, test } from '@playwright/test';

const primary = { url: '/images/auth-interior.png', altText: 'Primary product scene' };
const secondary = { url: '/images/home-hero-placeholder.png', altText: 'Secondary hover scene' };
const productWithAlt = {
  id: 'prod-1',
  name: 'Artisan Terracotta Urn',
  slug: 'artisan-terracotta-urn',
  description: 'An artisanal urn.',
  story: null,
  image: primary,
  primaryImage: primary,
  secondaryImage: secondary,
  images: [primary, secondary],
  videoUrl: 'https://example.test/urn.webm',
  minPricePaise: 249900,
  maxPricePaise: 249900,
  compareAtPricePaise: 299900,
  variantCount: 1,
  available: true,
  isFeatured: true,
  giftWrapEligible: true,
  categories: [{ name: 'Home Décor', slug: 'home-decor' }],
  variants: [
    {
      id: 'var-1',
      sku: 'URN-01',
      pricePaise: 249900,
      effectivePricePaise: 249900,
      compareAtPricePaise: 299900,
      stockQuantity: 5,
      attributes: [],
      dimensions: null,
      optionCombinationKey: '[]',
      available: true,
    },
  ],
};

const category = { id: 'cat-1', name: 'Home Décor', slug: 'home-decor', parentId: null, image: primary, primaryImage: primary };
const homeData = {
  categories: [category],
  featured: [productWithAlt],
  latest: [productWithAlt],
  giftable: [],
  collections: [],
  categoryRows: [{ slug: category.slug, products: [productWithAlt, { ...productWithAlt, id: 'prod-2', slug: 'urn-2' }] }],
  offers: [],
  videoProducts: [productWithAlt],
};

test.describe('Product card elevated 3D design and hover lift', () => {
  test('product cards have unified elevated card surface, 3D shadow, and rounded geometry', async ({ page }) => {
    await page.route('**/api/storefront/home', route => route.fulfill({ json: homeData }));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const card = page.locator('.store-product-card').first();
    await expect(card).toBeVisible();

    // Verify unified card elevated surface & rounded corners
    const styles = await card.evaluate(el => {
      const cs = getComputedStyle(el);
      return {
        borderRadius: cs.borderRadius,
        backgroundColor: cs.backgroundColor,
        boxShadow: cs.boxShadow,
        display: cs.display,
        flexDirection: cs.flexDirection,
      };
    });

    expect(styles.borderRadius).toBe('16px');
    expect(styles.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(styles.boxShadow).not.toBe('none');
    expect(styles.boxShadow.length).toBeGreaterThan(10);
    expect(styles.display).toBe('flex');
    expect(styles.flexDirection).toBe('column');

    // Verify copy container has balanced inner padding and tabular-nums
    const copyPadding = await card.locator('.store-product-copy').evaluate(el => getComputedStyle(el).padding);
    expect(copyPadding).toBe('14px 16px 16px');

    const priceFontVariant = await card.locator('.store-price').evaluate(el => getComputedStyle(el).fontVariantNumeric);
    expect(priceFontVariant).toContain('tabular-nums');

    // Verify green price color on product card
    const priceColor = await card.locator('.store-price').evaluate(el => getComputedStyle(el).color);
    expect(priceColor).toBe('rgb(40, 97, 58)');

    // Verify muted gray struck-through price when discounted
    const delColor = await card.locator('.store-price del').evaluate(el => getComputedStyle(el).color);
    expect(delColor).toBe('rgb(118, 110, 101)');

    // Verify tight gap between title and price (margin-top <= 8px)
    const priceMarginTop = await card.locator('.store-price').evaluate(el => parseFloat(getComputedStyle(el).marginTop));
    expect(priceMarginTop).toBeLessThanOrEqual(8);

    // Verify product name has 1-line truncation and title attribute
    const titleEl = card.locator('.store-product-name');
    await expect(titleEl).toHaveAttribute('title', productWithAlt.name);
    const titleStyles = await titleEl.evaluate(el => {
      const cs = getComputedStyle(el);
      return {
        whiteSpace: cs.whiteSpace,
        overflow: cs.overflow,
        textOverflow: cs.textOverflow,
      };
    });
    expect(titleStyles.whiteSpace).toBe('nowrap');
    expect(titleStyles.overflow).toBe('hidden');
    expect(titleStyles.textOverflow).toBe('ellipsis');

    // Verify photo top rounded corners seamlessly match card
    const photoRadius = await card.locator('.store-product-photo').evaluate(el => {
      const cs = getComputedStyle(el);
      return `${cs.borderTopLeftRadius} ${cs.borderTopRightRadius} ${cs.borderBottomRightRadius} ${cs.borderBottomLeftRadius}`;
    });
    expect(photoRadius).toBe('15px 15px 0px 0px');
  });

  test('hovering card elevates whole card without image-only scale, while secondary image crossfades', async ({ page }) => {
    await page.route('**/api/storefront/home', route => route.fulfill({ json: homeData }));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const arrivalsCard = page.locator('.store-arrivals .store-product-card').first();
    await expect(arrivalsCard).toBeVisible();

    // Verify secondary hover image exists
    const altImage = arrivalsCard.locator('.store-product-alt');
    await expect(altImage).toHaveCount(1);
    await expect(altImage).toHaveCSS('opacity', '0');

    // Hover over the card
    await arrivalsCard.hover();

    // Whole card lifts (-4px, scale 1.018)
    const cardTransform = await arrivalsCard.evaluate(el => getComputedStyle(el).transform);
    expect(cardTransform).not.toBe('none');

    // Product photo image does NOT zoom independently
    const imgTransform = await arrivalsCard.locator('.store-product-photo img').first().evaluate(el => getComputedStyle(el).transform);
    expect(imgTransform).toBe('none');

    // Secondary image crossfades to opacity 1
    await expect(altImage).toHaveCSS('opacity', '1');
  });

  test('Shop in Motion video card fits seamless elevated card with top rounded corners', async ({ page }) => {
    await page.route('**/api/storefront/home', route => route.fulfill({ json: homeData }));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const motionCard = page.locator('.store-motion .store-product-card').first();
    await expect(motionCard).toBeVisible();

    const videoPhotoRadius = await motionCard.locator('.store-product-photo').evaluate(el => {
      const cs = getComputedStyle(el);
      return `${cs.borderTopLeftRadius} ${cs.borderTopRightRadius}`;
    });
    expect(videoPhotoRadius).toBe('15px 15px');

    const motionPriceColor = await motionCard.locator('.store-price').evaluate(el => getComputedStyle(el).color);
    expect(motionPriceColor).toBe('rgb(40, 97, 58)');
  });

  test('Shop All cards use the same unified elevated card surface', async ({ page }) => {
    await page.route('**/api/storefront/shop?*', route => route.fulfill({ json: {
      items: [productWithAlt],
      total: 1,
      totalPages: 1,
      page: 1,
      pageSize: 20,
      filters: {},
    }}));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/shop');

    const shopCard = page.locator('.store-product-card').first();
    await expect(shopCard).toBeVisible();

    const styles = await shopCard.evaluate(el => {
      const cs = getComputedStyle(el);
      return {
        borderRadius: cs.borderRadius,
        backgroundColor: cs.backgroundColor,
        boxShadow: cs.boxShadow,
      };
    });

    expect(styles.borderRadius).toBe('16px');
    expect(styles.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(styles.boxShadow).not.toBe('none');

    const shopPriceColor = await shopCard.locator('.store-price').evaluate(el => getComputedStyle(el).color);
    expect(shopPriceColor).toBe('rgb(40, 97, 58)');
  });

  test('mobile horizontal scroll strips have clearance for 3D shadows with zero horizontal page overflow', async ({ page }) => {
    await page.route('**/api/storefront/home', route => route.fulfill({ json: homeData }));
    await page.setViewportSize({ width: 375, height: 844 });
    await page.goto('/');

    const categoryRowGrid = page.locator('.store-home-category-row .store-product-grid').first();
    await expect(categoryRowGrid).toBeVisible();

    const gridPadding = await categoryRowGrid.evaluate(el => {
      const cs = getComputedStyle(el);
      return {
        paddingTop: parseFloat(cs.paddingTop),
        paddingBottom: parseFloat(cs.paddingBottom),
        overflowX: cs.overflowX,
      };
    });

    expect(gridPadding.paddingTop).toBeGreaterThanOrEqual(10);
    expect(gridPadding.paddingBottom).toBeGreaterThanOrEqual(20);
    expect(gridPadding.overflowX).toBe('auto');

    // Page must have zero horizontal overflow
    const hasNoPageOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(hasNoPageOverflow).toBe(true);
  });

  test('reduced motion disables card hover transform', async ({ page }) => {
    await page.route('**/api/storefront/home', route => route.fulfill({ json: homeData }));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const card = page.locator('.store-product-card').first();
    const transition = await card.evaluate(el => getComputedStyle(el).transitionDuration);
    expect(parseFloat(transition)).toBe(0);
  });
});
