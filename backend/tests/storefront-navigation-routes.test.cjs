require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { AdminStorefrontNavigationController } = require('../dist/src/categories/admin-storefront-navigation.controller');
const { AdminCategoriesController } = require('../dist/src/categories/admin-categories.controller');
const { AdminCategoriesService } = require('../dist/src/categories/admin-categories.service');

test('literal storefront navigation route loads without parameters and saves a complete ordered selection', async () => {
  const lighting = '11111111-1111-4111-8111-111111111111';
  const wall = '22222222-2222-4222-8222-222222222222';
  let version = 0;
  let ids = [lighting];
  const names = { [lighting]: 'Lighting', [wall]: 'Wall Décor' };
  const service = {
    navigation: async () => ({ version, items: ids.map((id, position) => ({ id, name: names[id], position, visible: true })) }),
    navigationOptions: async query => ({ items: Object.entries(names).map(([id, name]) => ({ id, name })), total: 2, page: query.page, pageSize: query.pageSize }),
    saveNavigation: async (next, expected) => { if (expected !== version) throw Error('stale'); ids = next; version++; return service.navigation(); },
    detail: async id => ({ id, name: names[id] ?? 'Unknown' }),
  };
  class RoutingModule {}
  Module({ controllers: [AdminStorefrontNavigationController, AdminCategoriesController], providers: [{ provide: AdminCategoriesService, useValue: service }] })(RoutingModule);
  const app = await NestFactory.create(RoutingModule, { logger: false });
  app.setGlobalPrefix('api'); await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const call = (path, method = 'GET', body) => fetch(`${base}/api/admin/categories/${path}`, { method, headers: body === undefined ? {} : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  try {
    let response = await call('storefront-navigation'); assert.equal(response.status, 200); assert.deepEqual((await response.json()).items.map(item => item.id), [lighting]);
    response = await call(lighting); assert.equal(response.status, 200); assert.equal((await response.json()).name, 'Lighting');
    response = await call('storefront-navigation', 'PUT', { categoryIds: [wall, lighting], version: 0 }); assert.equal(response.status, 200); assert.deepEqual((await response.json()).items.map(item => item.id), [wall, lighting]);
    response = await call('storefront-navigation'); assert.deepEqual((await response.json()).items.map(item => item.id), [wall, lighting]);
    response = await call('storefront-navigation', 'PUT', { categoryIds: [], version: 1 }); assert.equal(response.status, 200); assert.deepEqual((await response.json()).items, []);
    response = await call('storefront-navigation', 'PUT', { version: 2 }); assert.equal(response.status, 400); assert.deepEqual(ids, []);
  } finally { await app.close(); }
});
