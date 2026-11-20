const { test } = require('node:test');
const assert = require('node:assert/strict');
const { StorefrontService } = require('../dist/src/storefront/storefront.service.js');

const now = new Date('2026-11-20T12:00:00.000Z');
const category = (id, status = 'ACTIVE', parentId = null) => ({ id, name: id, slug: id, status, parentId, deletedAt: null });
const product = (id, status, categoryId, variants = [{ id: `${id}-variant` }]) => ({ id, name: id, slug: id, status, categories: [{ categoryId }], variants });
const rule = (id, target, changes = {}) => ({
  id, name: `Offer ${id}`, kind: 'FIXED', amountPaise: 20000, percentBasisPoints: null,
  productId: target?.product?.id ?? null, categoryId: target?.category?.id ?? null,
  product: target?.product ?? null, category: target?.category ?? null,
  lifecycle: 'PUBLISHED', enabled: true, startsAt: null, endsAt: null, ...changes,
});

test('public offers include only live rules with visible product or category targets', async () => {
  const visibleProduct = product('blue-vase', 'PUBLISHED', 'child');
  const hiddenProduct = product('draft-vase', 'DRAFT', 'child');
  const inactiveProduct = product('hidden-vase', 'PUBLISHED', 'inactive');
  const rules = [
    rule('product', { product: visibleProduct }, { kind: 'PERCENTAGE', amountPaise: null, percentBasisPoints: 1500 }),
    rule('category', { category: { id: 'root', name: 'Home Décor', slug: 'home-decor' } }),
    rule('draft-product', { product: hiddenProduct }),
    rule('inactive-product', { product: inactiveProduct }),
    rule('inactive-category', { category: { id: 'inactive', name: 'Hidden', slug: 'hidden' } }),
    rule('upcoming', { product: visibleProduct }, { startsAt: new Date('2026-11-21T00:00:00.000Z') }),
    rule('expired', { product: visibleProduct }, { endsAt: now }),
    rule('paused', { product: visibleProduct }, { lifecycle: 'PAUSED', enabled: false }),
  ];
  const db = {
    category: { findMany: async () => [category('root'), category('child', 'ACTIVE', 'root'), category('inactive', 'INACTIVE')] },
    productCategory: { groupBy: async () => [{ categoryId: 'child', _count: { productId: 1 } }] },
    promotion: { findMany: async ({ where }) => {
      assert.equal(where.lifecycle, 'PUBLISHED');
      assert.equal(where.enabled, true);
      return rules.filter(item => item.lifecycle === where.lifecycle && item.enabled === where.enabled && (!item.startsAt || item.startsAt <= now) && (!item.endsAt || item.endsAt > now));
    } },
  };
  const offers = await new StorefrontService(db, {}).offers(now);
  assert.deepEqual(offers.map(offer => offer.id), ['product', 'category']);
  assert.deepEqual(offers.map(offer => offer.targetType), ['PRODUCT', 'CATEGORY']);
  assert.equal(offers[0].discountValue, 15);
  assert.equal(offers[1].discountValue, 200);
  assert.equal(offers[0].targetSlug, 'blue-vase');
  assert.equal(offers[1].targetSlug, 'home-decor');
  assert.equal('lifecycle' in offers[0], false);
});
