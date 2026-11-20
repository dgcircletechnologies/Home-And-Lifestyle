const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ShopService } = require('../dist/src/storefront/shop.service.js');
const category = { id: 'cat', name: 'Vases', slug: 'vases', parentId: null, status: 'ACTIVE', deletedAt: null };
const makeVariant = (id, price, stock, colour, size) => ({ id, pricePaise: price, stockQuantity: stock, images: [], selections: [
  { value: { label: colour, option: { key: 'colour' } } }, { value: { label: size, option: { key: 'size' } } },
] });
const makeProduct = (n, variants = [makeVariant(`v${n}`, 10000 + n * 100, 1, 'Blue', 'Small')]) => ({
  id: String(n).padStart(3, '0'), name: `Vase ${String(n).padStart(2, '0')}`, slug: `vase-${n}`, createdAt: new Date(2026, 0, n), isFeatured: false, giftWrapEligible: false,
  materials: ['Ceramic'], images: [], attributes: [], categories: [{ categoryId: 'cat', category: { name: 'Vases', slug: 'vases' } }], tags: [], collections: [], variants,
});
const db = products => ({
  category: { findMany: async () => [category] }, productCategory: { groupBy: async () => [{ categoryId: 'cat', _count: { productId: products.length } }] },
  product: { findMany: async () => products }, promotion: { findMany: async () => [] },
});
const query = (changes = {}) => ({ sort: 'newest', page: 1, pageSize: 20, ...changes });
test('Shop All paginates one card per product with stable totals and boundary recovery', async () => {
  const shop = new ShopService(db(Array.from({length:26},(_,i)=>makeProduct(i+1))));
  const first = await shop.list(query()); const second = await shop.list(query({page:2})); const stale = await shop.list(query({page:10}));
  assert.equal(first.items.length,20); assert.equal(second.items.length,6); assert.equal(second.total,26); assert.equal(second.page,2); assert.equal(stale.page,2);
  assert.equal(new Set([...first.items,...second.items].map(item=>item.id)).size,26);
});
test('variant filters, stock, effective card price and price sort use the same SKU', async () => {
  const first = makeProduct(1,[makeVariant('small-blue',80000,0,'Blue','Small'),makeVariant('large-red',120000,1,'Red','Large')]);
  const second = makeProduct(2,[makeVariant('large-blue',100000,1,'Blue','Large')]);
  const shop = new ShopService(db([first,second]));
  assert.equal((await shop.list(query({colour:'blue',size:'large'}))).total,1);
  assert.equal((await shop.list(query({colour:'blue',stock:'true'}))).total,1);
  assert.equal((await shop.list(query({colour:'blue',sort:'price-asc'}))).items[0].id,first.id);
  assert.equal((await shop.list(query({colour:'blue',stock:'true'}))).items[0].minPricePaise,100000);
});
test('active automatic offer controls card price and sale comparison', async () => {
  const product = makeProduct(1,[makeVariant('blue',120000,1,'Blue','Large')]);
  const mocked = db([product]); mocked.promotion.findMany = async () => [{id:'offer',productId:product.id,categoryId:null,kind:'FIXED',amountPaise:20000,percentBasisPoints:null}];
  const result = await new ShopService(mocked).list(query({min:1000,max:1000,sale:'true'}));
  assert.equal(result.total,1); assert.equal(result.onSale,true); assert.equal(result.items[0].minPricePaise,100000); assert.equal(result.items[0].compareAtPricePaise,120000);
});
test('all five orders sort the full 26-product set before pagination with stable ties', async () => {
  const products = Array.from({ length: 26 }, (_, i) => makeProduct(i + 1));
  products[0].name = 'Aardvark Vase';
  products[0].variants[0].pricePaise = 50;
  products[1].name = 'zulu Vase';
  products[2].name = 'Zulu Vase';
  products[1].variants[0].pricePaise = 900000;
  products[2].variants[0].pricePaise = 900000;
  const shop = new ShopService(db(products));
  const newest = await shop.list(query({ sort: 'newest' }));
  const low = await shop.list(query({ sort: 'price-asc' }));
  const high = await shop.list(query({ sort: 'price-desc' }));
  const az = await shop.list(query({ sort: 'name-asc' }));
  const za = await shop.list(query({ sort: 'name-desc' }));
  assert.equal(newest.items[0].id, products[25].id);
  assert.equal(low.items[0].id, products[0].id); // The cheapest product starts on newest page 2.
  assert.deepEqual(high.items.slice(0, 2).map(item => item.id), [products[1].id, products[2].id]);
  assert.equal(az.items[0].id, products[0].id);
  assert.deepEqual(za.items.slice(0, 2).map(item => item.id), [products[1].id, products[2].id]);
  assert.equal((await shop.list(query({ sort: 'newest', page: 2 }))).items.some(item => item.id === products[0].id), true);
  assert.equal((await shop.list(query({ sort: 'price-asc', page: 2 }))).items.length, 6);
});
