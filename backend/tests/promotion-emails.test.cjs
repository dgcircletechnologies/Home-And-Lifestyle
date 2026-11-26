const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setTimeout: sleep } = require('node:timers/promises');
const {
  categoryPromotionEmail,
  productPromotionEmail,
  toAbsoluteUrl,
} = require('../dist/src/promotions/promotion-email-templates.js');
const { PromotionMailService } = require('../dist/src/promotions/promotion-mail.service.js');
const { AdminPromotionsService } = require('../dist/src/promotions/admin-promotions.service.js');

test('toAbsoluteUrl handles absolute and relative URLs properly', () => {
  assert.equal(toAbsoluteUrl('https://cdn.example.com/img.jpg', 'https://example.com'), 'https://cdn.example.com/img.jpg');
  assert.equal(toAbsoluteUrl('/images/hero.jpg', 'https://example.com'), 'https://example.com/images/hero.jpg');
  assert.equal(toAbsoluteUrl('products/vase', 'https://example.com/'), 'https://example.com/products/vase');
  assert.equal(toAbsoluteUrl('', 'https://example.com'), '');
  assert.equal(toAbsoluteUrl(null, 'https://example.com'), '');
});

test('categoryPromotionEmail produces high-converting editorial template with zero horizontal scroll safeguards', () => {
  const email = categoryPromotionEmail({
    storeName: 'Home & <Lifestyle>',
    supportEmail: 'care@homeandlifestyle.in',
    supportPhone: '+91 98765 43210',
    frontendUrl: 'https://homeandlifestyle.in',
    customerName: '<Priya> Sharma',
    promotionName: 'Festive Wall Art Sale',
    discountBadge: '20% OFF',
    savingsLabel: 'Save 20%',
    startsAt: new Date('2026-11-20T00:00:00Z'),
    endsAt: new Date('2026-11-30T18:30:00Z'),
    category: {
      name: 'Wall Art & Décor',
      slug: 'wall-art-decor',
      imageUrl: '/images/categories/wall-art.jpg',
      description: 'Handcrafted prints, brass hangings, and artisanal mirrors.',
    },
    products: [
      {
        name: 'Brass Mandala Wall Hanging',
        slug: 'brass-mandala-wall-hanging',
        imageUrl: '/images/products/mandala.jpg',
        originalPricePaise: 350000,
        discountedPricePaise: 280000,
      },
      {
        name: 'Ceramic Wall Plate Trio',
        slug: 'ceramic-wall-plate-trio',
        imageUrl: null,
        originalPricePaise: 240000,
        discountedPricePaise: 192000,
      },
    ],
  });

  // Subject line
  assert.equal(email.subject, '20% OFF on Wall Art & Décor | Home & <Lifestyle>');

  // HTML content checks
  assert.match(email.html, /Home &amp; &lt;Lifestyle&gt;/);
  assert.match(email.html, /20% OFF on Wall Art &amp; Décor/);
  assert.match(email.html, /Handcrafted prints, brass hangings, and artisanal mirrors\./);
  assert.match(email.html, /Brass Mandala Wall Hanging/);
  assert.match(email.html, /₹2,800/);
  assert.match(email.html, /₹3,500/);
  assert.match(email.html, /Save ₹700/);
  assert.match(email.html, /Shop Now &rarr;/);
  assert.match(email.html, /https:\/\/homeandlifestyle\.in\/categories\/wall-art-decor/);
  assert.match(email.html, /https:\/\/homeandlifestyle\.in\/products\/brass-mandala-wall-hanging/);

  // Safeguards against raw unescaped injection
  assert.doesNotMatch(email.html, /<Lifestyle>/);

  // Viewport and mobile responsiveness checks (zero horizontal overflow)
  assert.match(email.html, /<meta name="viewport" content="width=device-width, initial-scale=1\.0">/);
  assert.match(email.html, /<meta name="x-apple-disable-message-reformatting">/);
  assert.match(email.html, /max-width:\s*600px/);
  assert.match(email.html, /box-sizing:\s*border-box/);
  assert.match(email.html, /word-break:\s*break-word/);

  // Plain-text fallback checks
  assert.match(email.text, /Special Offer: 20% OFF on Wall Art & Décor/);
  assert.match(email.text, /https:\/\/homeandlifestyle\.in\/categories\/wall-art-decor/);
  assert.match(email.text, /Brass Mandala Wall Hanging: Now ₹2,800 \(Was ₹3,500\)/);
  assert.match(email.text, /care@homeandlifestyle\.in/);
});

test('productPromotionEmail generates price-led spotlight deal template with accurate variant handling', () => {
  const email = productPromotionEmail({
    storeName: 'Home & Lifestyle',
    supportEmail: 'care@homeandlifestyle.in',
    supportPhone: '+91 98765 43210',
    frontendUrl: 'https://homeandlifestyle.in',
    customerName: 'Kavita Verma',
    promotionName: 'Terracotta Lamp Flash Sale',
    discountBadge: 'FLAT ₹500 OFF',
    savingsLabel: 'Save ₹500',
    startsAt: new Date('2026-11-20T00:00:00Z'),
    endsAt: new Date('2026-11-28T18:30:00Z'),
    product: {
      name: 'Fluted Ceramic Table Lamp',
      slug: 'fluted-ceramic-table-lamp',
      imageUrl: '/images/products/fluted-lamp.jpg',
      description: 'Earthy textured ceramic base with warm neutral fabric shade.',
      isMultiVariant: true,
      minOriginalPricePaise: 499900,
      minDiscountedPricePaise: 449900,
    },
  });

  // Subject line
  assert.equal(email.subject, 'FLAT ₹500 OFF on Fluted Ceramic Table Lamp | Home & Lifestyle');

  // HTML content checks
  assert.match(email.html, /Spotlight Deal/);
  assert.match(email.html, /Fluted Ceramic Table Lamp/);
  assert.match(email.html, /Starts from/);
  assert.match(email.html, /₹4,499/);
  assert.match(email.html, /₹4,999/);
  assert.match(email.html, /Save ₹500/);
  assert.match(email.html, /FLAT ₹500 OFF/);
  assert.match(email.html, /Shop This Deal &rarr;/);
  assert.match(email.html, /https:\/\/homeandlifestyle\.in\/products\/fluted-ceramic-table-lamp/);

  // Responsive mobile safeguards
  assert.match(email.html, /<meta name="viewport" content="width=device-width, initial-scale=1\.0">/);
  assert.match(email.html, /max-width:\s*600px/);

  // Plain text fallback
  assert.match(email.text, /Price: Starts from ₹4,499 \(Was ₹4,999\)/);
  assert.match(email.text, /https:\/\/homeandlifestyle\.in\/products\/fluted-ceramic-table-lamp/);
});

test('PromotionMailService filters verified customers correctly and isolates delivery errors', async () => {
  const fakeDb = {
    user: {
      count: async (args) => {
        assert.equal(args.where.role, 'CUSTOMER');
        assert.deepEqual(args.where.emailVerifiedAt, { not: null });
        assert.equal(args.where.disabledAt, null);
        assert.equal(args.where.deletedAt, null);
        return 42;
      },
      findMany: async () => [
        { id: 'u1', email: 'verified@example.com', name: 'Verified Customer' },
        { id: 'u2', email: 'invalid-email', name: 'Invalid Email User' },
        { id: 'u3', email: 'another@example.com', name: null },
      ],
    },
    promotion: {
      findUnique: async () => null,
    },
    storeSettings: {
      findUnique: async () => ({ storeName: 'Home & Lifestyle', supportEmail: 'care@test.com' }),
    },
  };

  const mailService = new PromotionMailService(fakeDb);
  const count = await mailService.countVerifiedCustomers();
  assert.equal(count, 42);

  const customers = await mailService.getVerifiedCustomers();
  assert.equal(customers.length, 2);
  assert.equal(customers[0].email, 'verified@example.com');
  assert.equal(customers[1].email, 'another@example.com');

  // When promotion is not found, does not throw and returns zero counts
  const res = await mailService.sendPromotionCampaign('non-existent-id');
  assert.deepEqual(res, { targetedCount: 0, sentCount: 0, failedCount: 0 });
});

test('AdminPromotionsService share triggers campaign asynchronously and validates eligible statuses', async () => {
  let campaignStartedWithId = null;
  const mockMailService = {
    countVerifiedCustomers: async () => 15,
    sendPromotionCampaign: async (id) => {
      campaignStartedWithId = id;
      return { targetedCount: 15, sentCount: 15, failedCount: 0 };
    },
  };

  const mockDb = {
    promotion: {
      findUnique: async ({ where }) => {
        if (where.id === 'promo-active') {
          return {
            id: 'promo-active',
            name: 'Active Lamp Discount',
            lifecycle: 'PUBLISHED',
            enabled: true,
            productId: 'prod-1',
            categoryId: null,
            startsAt: new Date(Date.now() - 3600000),
            endsAt: new Date(Date.now() + 86400000),
          };
        }
        if (where.id === 'promo-ended') {
          return {
            id: 'promo-ended',
            name: 'Ended Lamp Discount',
            lifecycle: 'ENDED',
            enabled: false,
            productId: 'prod-1',
            categoryId: null,
          };
        }
        return null;
      },
    },
  };

  const service = new AdminPromotionsService(mockDb, mockMailService);

  // Count endpoint
  const countRes = await service.verifiedCustomersCount();
  assert.deepEqual(countRes, { count: 15 });

  // Share active promotion
  const shareRes = await service.share('promo-active');
  assert.equal(shareRes.targetedCount, 15);
  assert.equal(shareRes.queued, true);

  // Allow async fire-and-forget to execute
  await sleep(10);
  assert.equal(campaignStartedWithId, 'promo-active');

  // Attempting to share an ended promotion throws bad request
  await assert.rejects(
    async () => {
      await service.share('promo-ended');
    },
    /Cannot share an offer with status ENDED/,
  );
});
