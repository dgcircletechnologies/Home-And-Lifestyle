const { test } = require('node:test');
const assert = require('node:assert/strict');
const { categoryVisibility, branchIds } = require('../dist/src/categories/category-visibility');

const rows = [
  { id: 'root', parentId: null, status: 'ACTIVE', deletedAt: null },
  { id: 'child', parentId: 'root', status: 'ACTIVE', deletedAt: null },
  { id: 'grandchild', parentId: 'child', status: 'ACTIVE', deletedAt: null },
  { id: 'inactive', parentId: 'root', status: 'INACTIVE', deletedAt: null },
  { id: 'hidden-child', parentId: 'inactive', status: 'ACTIVE', deletedAt: null },
];

test('published product in an active descendant makes the root eligible and belongs to its listing', async () => {
  const db = { category: { findMany: async () => rows }, productCategory: { groupBy: async () => [{ categoryId: 'grandchild', _count: { productId: 1 } }] } };
  const tree = await categoryVisibility(db);
  assert.equal(tree.hasProducts('root'), true);
  assert.equal(tree.hasProducts('child'), true);
  assert.deepEqual(branchIds(tree, 'root'), ['root', 'child', 'grandchild', 'inactive'].filter(id => id !== 'inactive'));
});

test('inactive ancestors and empty branches do not qualify for public navigation', async () => {
  const db = { category: { findMany: async () => rows }, productCategory: { groupBy: async () => [{ categoryId: 'hidden-child', _count: { productId: 1 } }] } };
  const tree = await categoryVisibility(db);
  assert.equal(tree.hasProducts('root'), false);
  assert.equal(tree.isActive('hidden-child'), false);
  assert.deepEqual(branchIds(tree, 'inactive'), []);
});
