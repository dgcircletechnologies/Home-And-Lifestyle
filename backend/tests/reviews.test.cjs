const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const { Writable } = require('node:stream');
const { readFileSync } = require('node:fs');
const { v2: cloudinary } = require('cloudinary');
const { AdminReviewsService } = require('../dist/src/reviews/admin-reviews.service');
const { ProfilePhotoService } = require('../dist/src/users/profile-photo.service');
const { CategoryImageService } = require('../dist/src/categories/category-image.service');

function fixture() {
  const row = { id: 'review', productId: 'product', customerId: 'customer', rating: 1, title: null, body: 'A review', moderationStatus: 'PENDING', moderationVersion: 0, moderationReason: null, trashedAt: null, storeReply: null, repliedAt: null, repliedById: null, createdAt: new Date(), updatedAt: new Date('2026-11-18T00:00:00.000Z'), customer: { name: 'Customer B', user: { id: 'author', name: 'Customer B', avatarUrl: 'https://cdn.test/b.jpg', deletedAt: null } }, product: { id: 'product', name: 'Vase', images: [{ url: 'https://cdn.test/product.jpg' }] }, history: [] };
  const events = [];
  const db = { review: { findUnique: async () => ({ ...row, updatedAt: new Date(row.updatedAt), customer: { ...row.customer, user: { ...row.customer.user } }, product: { ...row.product, images: [...row.product.images] } }), updateMany: async ({ where, data }) => { if (row.moderationVersion !== where.moderationVersion) return { count: 0 }; Object.assign(row, data, { moderationVersion: row.moderationVersion + 1, updatedAt: new Date(row.updatedAt.getTime() + 1) }); return { count: 1 }; } }, reviewModerationHistory: { create: async ({ data }) => { events.push(data); return data; } }, $transaction: async callback => callback(db) };
  const service = new AdminReviewsService(db); service.detail = async () => ({ moderationStatus: row.moderationStatus, updatedAt: row.updatedAt, customer: { avatarUrl: row.customer.user.avatarUrl }, product: { thumbnailUrl: row.product.images[0].url } });
  return { row, events, service, db };
}

test('moderation keeps author avatar and product thumbnail separate, records one event, and rejects stale decisions', async () => {
  const { row, events, service } = fixture(); const version = row.moderationVersion;
  const result = await service.moderate(row.id, 'admin', { action: 'approve', expectedVersion: version });
  assert.equal(result.moderationStatus, 'APPROVED'); assert.equal(result.customer.avatarUrl, 'https://cdn.test/b.jpg'); assert.equal(result.product.thumbnailUrl, 'https://cdn.test/product.jpg');
  await assert.rejects(service.moderate(row.id, 'admin', { action: 'approve', expectedVersion: version }), error => error.getStatus() === 409);
  assert.equal(events.length, 1); assert.equal(events[0].previousStatus, 'PENDING'); assert.equal(events[0].status, 'APPROVED');
});

test('rejection requires an internal reason and cannot silently publish the review', async () => {
  const { row, events, service } = fixture(); await assert.rejects(service.moderate(row.id, 'admin', { action: 'reject', expectedVersion: row.moderationVersion }), error => error.getStatus() === 400);
  assert.equal(row.moderationStatus, 'PENDING'); assert.equal(events.length, 0);
});

test('verified purchase uses the same customer, a completed order, and the product snapshot', async () => {
  const { row, db } = fixture(); let purchased = false;
  db.order = { findFirst: async ({ where }) => { assert.equal(where.customerId, 'customer'); assert.deepEqual(where.status.in, ['DELIVERED', 'COMPLETED']); assert.equal(where.lines.some.productIdSnapshot, 'product'); return purchased ? { id: 'order' } : null; } };
  const service = new AdminReviewsService(db); service.ratingSummary = async () => ({ publishedReviews: 0, ratingCount: 0, averageRating: null });
  assert.equal((await service.detail(row.id)).verifiedPurchase, false);
  purchased = true; assert.equal((await service.detail(row.id)).verifiedPurchase, true);
  row.customerId = null; assert.equal((await service.detail(row.id)).verifiedPurchase, false);
});

test('avatar replacement leaves the old image when upload fails or the database save fails', async () => {
  const user = { id: 'author', email: 'a@example.test', emailOriginal: null, name: 'Customer A', role: 'CUSTOMER', emailVerifiedAt: new Date(), avatarUrl: 'https://cdn.test/old.jpg', avatarPublicId: 'old' };
  const cleaned = []; let failSave = false;
  const db = { user: { findUnique: async () => ({ ...user }), count: async ({ where }) => Number(user.avatarPublicId === where.avatarPublicId), update: async ({ data }) => { if (failSave) throw Error('database unavailable'); Object.assign(user, data); return { ...user }; } } };
  const images = { upload: async () => { throw Error('provider unavailable'); }, remove: async id => cleaned.push(id) };
  const service = new ProfilePhotoService(db, images);
  await assert.rejects(service.upload(user.id, { buffer: Buffer.from('x'), size: 1 })); assert.equal(user.avatarPublicId, 'old');
  images.upload = async () => ({ url: 'https://cdn.test/new.jpg', publicId: 'new' }); failSave = true;
  await assert.rejects(service.upload(user.id, { buffer: Buffer.from('x'), size: 1 })); assert.equal(user.avatarPublicId, 'old'); assert.deepEqual(cleaned, ['new']);
  failSave = false; const saved = await service.upload(user.id, { buffer: Buffer.from('x'), size: 1 }); assert.equal(saved.avatarUrl, 'https://cdn.test/new.jpg'); assert.deepEqual(cleaned, ['new', 'old']);
});

test('profile photos reject unsupported content and invalid source dimensions before Cloudinary', async () => {
  const old = { name: process.env.CLOUDINARY_CLOUD_NAME, key: process.env.CLOUDINARY_API_KEY, secret: process.env.CLOUDINARY_API_SECRET };
  try {
    Object.assign(process.env, { CLOUDINARY_CLOUD_NAME: 'test', CLOUDINARY_API_KEY: 'key', CLOUDINARY_API_SECRET: 'secret' });
    const service = new CategoryImageService();
    await assert.rejects(service.upload({ buffer: Buffer.from('not an image'), size: 12 }, 'avatar'), error => error.getResponse().code === 'IMAGE_INVALID');
    const png = Buffer.alloc(24); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png); png.writeUInt32BE(16, 16); png.writeUInt32BE(16, 20);
    await assert.rejects(service.upload({ buffer: png, size: png.length }, 'avatar'), error => error.getResponse().code === 'IMAGE_INVALID_DIMENSIONS');
  } finally { if (old.name === undefined) delete process.env.CLOUDINARY_CLOUD_NAME; else process.env.CLOUDINARY_CLOUD_NAME = old.name; if (old.key === undefined) delete process.env.CLOUDINARY_API_KEY; else process.env.CLOUDINARY_API_KEY = old.key; if (old.secret === undefined) delete process.env.CLOUDINARY_API_SECRET; else process.env.CLOUDINARY_API_SECRET = old.secret; }
});

test('valid avatar uses the shared Cloudinary upload with a square delivery image', async () => {
  const original = cloudinary.uploader.upload_stream;
  const old = { name: process.env.CLOUDINARY_CLOUD_NAME, key: process.env.CLOUDINARY_API_KEY, secret: process.env.CLOUDINARY_API_SECRET };
  try {
    Object.assign(process.env, { CLOUDINARY_CLOUD_NAME: 'test', CLOUDINARY_API_KEY: 'key', CLOUDINARY_API_SECRET: 'secret' });
    let options;
    cloudinary.uploader.upload_stream = (input, done) => { options = input; return new Writable({ write(_chunk, _encoding, callback) { done(undefined, { secure_url: 'https://cdn.test/avatar.png', public_id: 'avatars/new', format: 'png', width: 256, height: 256, resource_type: 'image' }); callback(); } }); };
    const bytes = readFileSync('../frontend/public/images/auth-interior.png');
    const image = await new CategoryImageService().upload({ buffer: bytes, size: bytes.length }, 'avatar');
    assert.equal(image.url, 'https://cdn.test/avatar.png'); assert.match(options.folder, /avatars$/); assert.deepEqual(options.transformation, [{ width: 256, height: 256, crop: 'fill', gravity: 'auto' }]);
  } finally { cloudinary.uploader.upload_stream = original; if (old.name === undefined) delete process.env.CLOUDINARY_CLOUD_NAME; else process.env.CLOUDINARY_CLOUD_NAME = old.name; if (old.key === undefined) delete process.env.CLOUDINARY_API_KEY; else process.env.CLOUDINARY_API_KEY = old.key; if (old.secret === undefined) delete process.env.CLOUDINARY_API_SECRET; else process.env.CLOUDINARY_API_SECRET = old.secret; }
});
