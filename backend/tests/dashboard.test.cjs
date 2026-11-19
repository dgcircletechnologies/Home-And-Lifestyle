const { test } = require('node:test');
const assert = require('node:assert/strict');
const { period } = require('../dist/src/dashboard/period.js');
test('local calendar boundaries include final day and compare elapsed time', () => {
 const now = new Date('2026-11-19T07:00:00Z');
 const p = period({ preset: 'custom', start: '2026-11-01', end: '2026-11-19' }, now);
 assert.equal(p.from.toISOString(), '2026-10-31T18:30:00.000Z');
 assert.equal(p.to.toISOString(), '2026-11-19T18:30:00.000Z');
 assert.equal(p.previousFrom.toISOString(), '2026-10-12T18:30:00.000Z');
 assert.equal(p.previousTo.toISOString(), '2026-10-31T07:00:00.000Z');
});
test('invalid, reversed, future and excessive ranges fail', () => {
 for (const [start,end] of [['2026-02-30','2026-03-01'],['2026-11-20','2026-11-19'],['2026-11-01','2026-11-20'],['2025-01-01','2026-11-19']]) assert.throws(() => period({ preset:'custom', start,end }, new Date('2026-11-19T07:00:00Z')));
});
