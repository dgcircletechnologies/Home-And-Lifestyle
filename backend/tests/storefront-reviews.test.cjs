const { test } = require('node:test');
const assert = require('node:assert/strict');
const { StorefrontReviewsService } = require('../dist/src/reviews/storefront-reviews.service.js');

const category = { id: 'cat', name: 'Decor', slug: 'decor', parentId: null, status: 'ACTIVE', deletedAt: null };
const row = { id: 'review-1', productId: 'product-1', customerId: 'customer-1', rating: 5, title: 'Lovely', body: 'A lovely piece.', createdAt: new Date('2026-11-20T00:00:00Z'), storeReply: null, repliedAt: null, customer: { name: 'Old name', user: { name: 'Anika', avatarUrl: '/avatar.png', deletedAt: null } } };
function database() {
  const db = {
    category: { findMany: async () => [category] },
    productCategory: { groupBy: async () => [{ categoryId: 'cat', _count: { productId: 1 } }] },
    product: { findFirst: async () => ({ id: 'product-1' }) },
    review: { aggregate: async () => ({ _count: { rating: 1 }, _avg: { rating: 5 } }), findMany: async () => [row] },
    order: { findMany: async () => [{ customerId: 'customer-1' }] },
  };
  return db;
}

test('public reviews use only approved, untrashed records and resolve current avatar plus verified order', async () => {
  const db = database();
  db.review.aggregate = async ({ where }) => { assert.deepEqual(where, { productId: 'product-1', moderationStatus: 'APPROVED', trashedAt: null }); return { _count: { rating: 1 }, _avg: { rating: 5 } }; };
  db.review.findMany = async ({ where }) => { assert.equal(where.moderationStatus, 'APPROVED'); assert.equal(where.trashedAt, null); return [row]; };
  const result = await new StorefrontReviewsService(db).list('ceramic-vase');
  assert.equal(result.summary.reviewCount, 1);
  assert.equal(result.items[0].reviewerName, 'Anika');
  assert.equal(result.items[0].avatarUrl, '/avatar.png');
  assert.equal(result.items[0].verifiedPurchase, true);
});

test('customer review submission starts pending and rejects a duplicate', async () => {
  const db = database();
  let customerId = null;
  db.$transaction = async work => work({
    $queryRaw: async () => [],
    user: { findUnique: async () => ({ id: 'user-1', name: 'Anika', customerId }), update: async ({ data }) => { customerId = data.customerId; } },
    customer: { create: async () => ({ id: 'customer-1' }) },
    review: { findFirst: async () => null, create: async ({ data }) => { assert.equal(data.customerId, 'customer-1'); assert.equal(data.moderationStatus, 'PENDING'); return { id: 'new-review', moderationStatus: data.moderationStatus }; } },
  });
  const service = new StorefrontReviewsService(db);
  const saved = await service.create('ceramic-vase', 'user-1', { rating: 5, body: 'A lovely piece.' });
  assert.equal(saved.moderationStatus, 'PENDING');
  db.$transaction = async work => work({ $queryRaw: async () => [], user: { findUnique: async () => ({ id: 'user-1', name: 'Anika', customerId: 'customer-1' }) }, review: { findFirst: async () => ({ id: 'old-review' }) } });
  await assert.rejects(() => service.create('ceramic-vase', 'user-1', { rating: 5, body: 'A lovely piece.' }), error => error.getStatus() === 409);
});
