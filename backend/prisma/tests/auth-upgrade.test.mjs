import { URL } from 'node:url';
import process from 'node:process';
import console from 'node:console';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import pg from 'pg';
const url = new URL(process.env.TEST_DATABASE_URL ?? '');
assert.match(url.pathname, /^\/auth_upgrade_test_/);
assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
try {
  const tables = await client.query("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'");
  assert.equal(tables.rows[0].count, 0, 'Only a new empty disposable database is allowed.');
  for (const migration of ['20261116000000_init_catalogue', '20261116010000_complete_business_schema', '20261117000000_auth_foundation']) {
    await client.query(await readFile(new URL(`../migrations/${migration}/migration.sql`, import.meta.url), 'utf8'));
  }
  await client.query(`INSERT INTO "User" (id,email,name,"passwordHash",role,"updatedAt") VALUES ('legacy','Mixed+Tag@Example.test','Legacy','preserved-hash','CUSTOMER',now()), ('conflict','mixed+tag@example.test','Conflict','other-hash','CUSTOMER',now())`);
  await client.query(`INSERT INTO "Session" (id,"tokenHash","userId","expiresAt") VALUES ('legacy-session','preserved-digest','legacy',now()+interval '1 day')`);
  const upgrade = await readFile(new URL('../migrations/20261117010000_email_activation_jwt/migration.sql', import.meta.url), 'utf8');
  await assert.rejects(client.query(upgrade), /Canonical email conflicts/);
  await client.query('ROLLBACK');
  assert.equal((await client.query('SELECT count(*)::int AS count FROM "User"')).rows[0].count, 2);
  // Explicit fixture-only conflict resolution in this isolated test, never application behavior.
  await client.query(`DELETE FROM "User" WHERE id='conflict'`);
  await client.query(upgrade);
  const user = (await client.query(`SELECT * FROM "User" WHERE id='legacy'`)).rows[0];
  assert.equal(user.email, 'mixed+tag@example.test'); assert.equal(user.emailOriginal, 'Mixed+Tag@Example.test');
  assert.equal(user.passwordHash, 'preserved-hash'); assert.equal(user.emailVerifiedAt, null); assert.equal(user.role, 'CUSTOMER');
  const session = (await client.query(`SELECT * FROM "Session" WHERE id='legacy-session'`)).rows[0];
  assert.equal(session.tokenHash, 'preserved-digest'); assert.ok(session.revokedAt);
  console.log('PASS: canonical conflicts refuse migration; legacy data/password preserved; no auto-verification; legacy session revoked.');
} finally { await client.end(); }
