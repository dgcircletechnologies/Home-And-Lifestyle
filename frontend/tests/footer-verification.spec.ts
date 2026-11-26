import { expect, test } from '@playwright/test';

const sampleCategory = {
  id: 'c1',
  name: 'Home Décor',
  slug: 'home-decor',
  parentId: null,
  image: { url: '/images/auth-interior.png', altText: 'Category Scene' },
};

const sampleProduct = {
  id: 'p1',
  name: 'Ceramic Urn',
  slug: 'ceramic-urn',
  description: 'Handcrafted urn.',
  story: null,
  image: { url: '/images/auth-interior.png', altText: 'Product Scene' },
  minPricePaise: 150000,
  maxPricePaise: 150000,
  compareAtPricePaise: null,
  variantCount: 1,
  available: true,
  isFeatured: true,
  giftWrapEligible: false,
  categories: [sampleCategory],
  variants: [
    {
      id: 'v1',
      sku: 'URN-1',
      pricePaise: 150000,
      effectivePricePaise: 150000,
      compareAtPricePaise: null,
      stockQuantity: 4,
      attributes: [],
      dimensions: null,
      optionCombinationKey: '[]',
      available: true,
    },
  ],
};

const homeData = {
  categories: [sampleCategory],
  featured: [sampleProduct],
  latest: [sampleProduct],
  giftable: [sampleProduct],
  collections: [],
  categoryRows: [{ slug: sampleCategory.slug, products: [sampleProduct] }],
  offers: [],
  videoProducts: [],
};

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

test.describe('Footer content and bounds verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/store/config', route => route.fulfill({ json: storeConfig }));
    await page.route('**/api/storefront/navigation', route => route.fulfill({ json: { categories: [sampleCategory], collections: [] } }));
    await page.route('**/api/storefront/home', route => route.fulfill({ json: homeData }));
    await page.route('**/api/storefront/products/ceramic-urn', route => route.fulfill({ json: sampleProduct }));
    await page.route('**/api/storefront/products?**', route => route.fulfill({ json: { products: [sampleProduct], total: 1, page: 1, pages: 1 } }));
    await page.route('**/api/storefront/products/ceramic-urn/reviews**', route => route.fulfill({ json: { reviews: [], total: 0, page: 1, pages: 0, averagePaise: 0 } }));
    await page.route('**/api/auth/me', route => route.fulfill({
      status: 200,
      json: { id: 'u1', name: 'Aarav Sharma', email: 'aarav@example.com', role: 'CUSTOMER', avatarUrl: null, emailVerifiedAt: '2026-01-01T00:00:00.000Z' }
    }));
  });

  const viewports = [
    { name: 'mobile-360', width: 360, height: 740 },
    { name: 'mobile-375', width: 375, height: 844 },
    { name: 'mobile-390', width: 390, height: 844 },
    { name: 'desktop', width: 1280, height: 900 },
  ];

  const pagesToTest = [
    { name: 'Home Page', path: '/' },
    { name: 'Shop All', path: '/shop' },
    { name: 'PDP', path: '/products/ceramic-urn' },
    { name: 'Account', path: '/account' },
  ];

  for (const vp of viewports) {
    test.describe(`Viewport ${vp.name} (${vp.width}x${vp.height})`, () => {
      for (const p of pagesToTest) {
        test(`${p.name} footer layout, strictly no elements below footer, no horizontal overflow`, async ({ page }) => {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.goto(p.path);

          const footer = page.locator('footer.store-footer');
          await expect(footer).toBeVisible();

          // 1. Confirm Footer contains ONLY brand info, Support, Policies, and copyright bar (no Shop nav)
          const navHeadings = await footer.locator('nav strong').allTextContents();
          expect(navHeadings).toEqual(['Support', 'Policies']);

          // Ensure no Shop link / Store catalogue nav
          const shopNav = footer.locator('nav[aria-label="Store catalogue"]');
          await expect(shopNav).toHaveCount(0);

          // Support links check
          const supportNav = footer.locator('nav[aria-label="Support links"]');
          const supportLinks = supportNav.locator('a');
          const supportHrefs = await supportLinks.evaluateAll(els => els.map(a => a.getAttribute('href')));
          expect(supportHrefs).toEqual(['/contact', '/faq', '/account/orders', '/about']);

          // Policies links check
          const policyNav = footer.locator('nav[aria-label="Policy links"]');
          const policyLinks = policyNav.locator('a');
          const policyHrefs = await policyLinks.evaluateAll(els => els.map(a => a.getAttribute('href')));
          expect(policyHrefs).toEqual(['/shipping-policy', '/cancellation-and-returns', '/privacy-policy', '/terms-and-conditions']);

          // Verify Support & Policies links and headings are left-aligned in their respective columns
          for (const nav of [supportNav, policyNav]) {
            const alignItems = await nav.evaluate(el => getComputedStyle(el).alignItems);
            expect(['flex-start', 'start', 'flow-start']).toContain(alignItems);
            const navLeft = await nav.evaluate(el => el.getBoundingClientRect().left);
            const linksLeft = await nav.locator('a').evaluateAll(els => els.map(el => Math.round(el.getBoundingClientRect().left)));
            for (const left of linksLeft) {
              expect(Math.abs(left - Math.round(navLeft))).toBeLessThanOrEqual(1);
            }
          }

          // Copyright bar
          const copyright = footer.locator('.store-footer-bottom');
          await expect(copyright).toBeVisible();
          await expect(copyright).toContainText('Prices in INR');

          // 2. Zero horizontal overflow
          const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
          expect(horizontalOverflow).toBe(false);

          // 3. Zero elements render below the Footer
          const boundsCheck = await page.evaluate(() => {
            const footerEl = document.querySelector('footer.store-footer');
            if (!footerEl) return { found: false, spills: [] };
            const footerRect = footerEl.getBoundingClientRect();
            const footerBottom = footerRect.bottom;

            // Find any element whose bounding rect extends significantly below footer bottom
            const elements = Array.from(document.body.querySelectorAll('*'));
            const spills = elements
              .filter(el => {
                // Ignore fixed/sticky modals or dialog backdrops or script/style
                const style = window.getComputedStyle(el);
                if (style.position === 'fixed' || style.display === 'none' || style.visibility === 'hidden') return false;
                const rect = el.getBoundingClientRect();
                return rect.bottom > footerBottom + 2 && rect.height > 0 && rect.width > 0;
              })
              .map(el => ({
                tag: el.tagName,
                class: el.className,
                bottom: el.getBoundingClientRect().bottom,
                footerBottom,
              }));

            return { found: true, spills };
          });

          expect(boundsCheck.found).toBe(true);
          expect(boundsCheck.spills).toEqual([]);

          // 4. On Home Page, verify giftable pieces product names are comfortably above the footer
          if (p.name === 'Home Page') {
            const giftingSection = page.locator('.store-gifting');
            await expect(giftingSection).toBeVisible();
            const productName = giftingSection.locator('.store-gifting-pieces span').first();
            await expect(productName).toBeVisible();
            const nameBottom = await productName.evaluate(el => el.getBoundingClientRect().bottom);
            const footerTop = await footer.evaluate(el => el.getBoundingClientRect().top);
            expect(footerTop - nameBottom).toBeGreaterThanOrEqual(40);
          }

          // 5. Check padding and layout
          if (vp.width <= 700) {
            const paddingTop = await footer.evaluate(el => parseFloat(getComputedStyle(el).paddingTop));
            const paddingBottom = await footer.evaluate(el => parseFloat(getComputedStyle(el).paddingBottom));
            expect(paddingTop).toBe(32);
            expect(paddingBottom).toBe(32);

            // Intro spans full width
            const introCol = await footer.locator('.store-footer-intro').evaluate(el => getComputedStyle(el).gridColumn);
            expect(introCol).toContain('1 / -1');
          } else {
            const desktopCols = await footer.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
            expect(desktopCols).toBe(3);
          }
        });
      }
    });
  }
});
