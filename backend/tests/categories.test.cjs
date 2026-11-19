const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const { Buffer } = require('node:buffer');
const { v2: cloudinary } = require('cloudinary');
const { CategoryImageService } = require('../dist/src/categories/category-image.service');
const { AdminCategoriesService } = require('../dist/src/categories/admin-categories.service');

const category = { id: '11111111-1111-4111-8111-111111111111', name: 'Lighting', slug: 'lighting', description: null, status: 'ACTIVE', parentId: null, imageUrl: 'https://old.test/image.jpg', imagePublicId: 'old-image', imageFormat: 'jpg', imageWidth: 10, imageHeight: 10, imageResourceType: 'image', createdAt: new Date(), updatedAt: new Date(), parent: null, _count: { children: 0, products: 0 } };
test('category image validates content, uses Cloudinary result, and reports upload failures safely', async () => {
  const previous = { ...process.env }; const original = cloudinary.uploader.upload_stream;
  try {
    Object.assign(process.env, { CLOUDINARY_CLOUD_NAME: 'test', CLOUDINARY_API_KEY: 'key', CLOUDINARY_API_SECRET: 'secret', CATEGORY_IMAGE_MAX_BYTES: '5242880' });
    const service = new CategoryImageService();
    await assert.rejects(service.upload({ buffer: Buffer.from('not-an-image'), size: 12 }), error => error.getResponse().code === 'IMAGE_INVALID');
    cloudinary.uploader.upload_stream = (_options, done) => new Writable({ write(_chunk, _encoding, callback) { done(undefined, { secure_url: 'https://cdn.test/image.webp', public_id: 'category/new', format: 'webp', width: 100, height: 80, resource_type: 'image' }); callback(); } });
    const uploaded = await service.upload({ buffer: Buffer.concat([Buffer.from('RIFFxxxxWEBP'), Buffer.alloc(4)]), size: 16 });
    assert.deepEqual(uploaded, { url: 'https://cdn.test/image.webp', publicId: 'category/new', format: 'webp', width: 100, height: 80, resourceType: 'image' });
    cloudinary.uploader.upload_stream = (_options, done) => new Writable({ write(_chunk, _encoding, callback) { done(Error('offline')); callback(); } });
    await assert.rejects(service.upload({ buffer: Buffer.concat([Buffer.from('RIFFxxxxWEBP'), Buffer.alloc(4)]), size: 16 }), error => error.getResponse().code === 'IMAGE_UPLOAD_FAILED');
  } finally { cloudinary.uploader.upload_stream = original; process.env = previous; }
});

test('category image replacement keeps the old reference when persistence fails and cleans up the new asset', async () => {
  const cleaned = []; const images = { upload: async () => ({ url: 'https://cdn.test/new.webp', publicId: 'new-image', format: 'webp', width: 10, height: 10, resourceType: 'image' }), remove: async id => cleaned.push(id) };
  const db = { category: { findFirst: async () => category, update: async () => { throw Error('database unavailable'); } } };
  const service = new AdminCategoriesService(db, images);
  await assert.rejects(service.replaceImage(category.id, { buffer: Buffer.alloc(12), size: 12 }));
  assert.deepEqual(cleaned, ['new-image']);
});

test('category deletion is blocked while child categories or product assignments remain', async () => {
  const db = { category: { findFirst: async () => ({ ...category, _count: { children: 1, products: 0 } }), update: async () => null } };
  const service = new AdminCategoriesService(db, { upload: async () => null, remove: async () => undefined });
  await assert.rejects(service.remove(category.id), error => error.getStatus() === 409 && /child categories/.test(error.getResponse().message));
});

test('the initial unfiltered category list accepts all statuses and optional image and parent values', async () => {
  const row = { ...category, imageUrl: null, imagePublicId: null, imageFormat: null, imageWidth: null, imageHeight: null, imageResourceType: null, parent: null, _count: { children: 0, products: 0 } };
  const db = { category: { count: async () => 1, findMany: async () => [row] }, productCategory: { groupBy: async () => [] }, $transaction: async operations => Promise.all(operations) };
  const service = new AdminCategoriesService(db, {});
  const result = await service.list({ page: 1, pageSize: 20, status: 'all', sort: 'name' });
  assert.deepEqual(result, { items: [{ ...row, navVisibility: 'Not selected', image: null, imageUrl: undefined, imagePublicId: undefined, imageFormat: undefined, imageWidth: undefined, imageHeight: undefined, imageResourceType: undefined }], page: 1, pageSize: 20, total: 1 });
});
