const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes, createHash } = require('node:crypto');
process.env.JWT_SECRET ||= randomBytes(32).toString('hex');
const { readEnvironment } = require('../dist/src/environment');
const { authConfig } = require('../dist/src/auth/config');
const { hashPassword, verifyPassword } = require('../dist/src/auth/password');
const { PasswordPolicy } = require('../dist/src/auth/password-policy');
const { registerSchema } = require('../dist/src/auth/contracts');

test('configuration fails safely for invalid database, origins and signing key', () => {
  const original = { ...process.env };
  try {
    process.env.DATABASE_URL = 'secret-invalid'; assert.throws(readEnvironment, /PostgreSQL URL/);
    process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
    process.env.CORS_ORIGINS = '*'; assert.throws(readEnvironment, /explicit origins/);
    process.env.JWT_SECRET = ''; assert.throws(authConfig, /JWT_SECRET/);
  } finally { process.env = original; }
});
test('Argon2id hashing preserves spaces and Unicode; compromised password range checks fail closed', async () => {
  const password = '  long phrase with 日本語 and spaces  ';
  const hash = await hashPassword(password);
  assert.ok(hash.startsWith('$argon2id$v=19$m=65536,t=3,p=1$'));
  assert.ok(await verifyPassword(password, hash)); assert.equal(await verifyPassword(password.trim(), hash), false);
  const original = global.fetch; const digest = createHash('sha1').update(password).digest('hex').toUpperCase();
  try {
    global.fetch = async (url, options) => { assert.ok(url.endsWith(digest.slice(0, 5))); assert.equal(options.headers['Add-Padding'], 'true'); return new Response(digest.slice(5) + ':5\r\n'); };
    await assert.rejects(new PasswordPolicy().assertAllowed(password), error => error.getResponse().code === 'PASSWORD_COMPROMISED');
    global.fetch = async () => { throw Error('offline'); };
    await assert.rejects(new PasswordPolicy().assertAllowed(password), error => error.getStatus() === 503);
  } finally { global.fetch = original; }
});

test('registration accepts eight-character passwords and rejects shorter passwords', () => {
  const input = { name: 'Eight Character', email: 'eight@example.test' };
  assert.equal(registerSchema.safeParse({ ...input, password: 'abcdefgh' }).success, true);
  const result = registerSchema.safeParse({ ...input, password: 'abcdefg' });
  assert.equal(result.success, false);
  if (!result.success) assert.match(result.error.issues[0].message, /8–128/);
});

test('isolated HTTP activation and JWT integration', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.match(url.pathname, /^\/foundation_test/); assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL; process.env.CORS_ORIGINS = 'http://localhost:3100'; process.env.FRONTEND_URL = 'http://localhost:3100'; process.env.AUTH_IP_LIMIT = '1000';
  const { createApp } = require('../dist/src/bootstrap');
  const { PrismaService } = require('../dist/src/prisma.service');
  const { MailService } = require('../dist/src/auth/mail.service');
  const { tokenHash } = require('../dist/src/auth/auth.service');
  const jwt = require('jsonwebtoken');
  const app = await createApp(); await app.listen(0, '127.0.0.1');
  const db = app.get(PrismaService); const base = await app.getUrl(); const mail = [];
  app.get(PasswordPolicy).assertAllowed = async () => {};
  app.get(MailService).activation = async (email, name, token) => { mail.push({ email, name, token }); return 'accepted'; };
  const call = (path, method = 'GET', body, auth = {}, origin = 'http://localhost:3100', csrf = '1') => fetch(base + '/api/' + path, { method, headers: { Origin: origin, 'X-CSRF-Protection': csrf, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(auth.cookie ? { Cookie: auth.cookie } : {}), ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const register = async () => {
    const email = `Test+${randomUUID()}@example.test`; const password = randomBytes(24).toString('base64url');
    const response = await call('auth/register', 'POST', { email, password, name: '<Customer & Name>' });
    assert.equal(response.status, 202); const token = mail.find(m => m.email === email).token;
    const user = await db.user.findUniqueOrThrow({ where: { email: email.toLowerCase() } });
    return { email, password, token, user };
  };
  const signIn = async (account) => {
    await db.authThrottle.deleteMany({ where: { key: tokenHash(`login:${account.email.toLowerCase()}`) } });
    const response = await call('auth/login', 'POST', { email: account.email, password: account.password });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('set-cookie'), /HttpOnly/); assert.match(response.headers.get('set-cookie'), /Path=\/api\/auth/);
    const body = await response.json(); assert.equal(body.user.passwordHash, undefined);
    return { ...body, cookie: response.headers.get('set-cookie').split(';')[0] };
  };
  try {
    const account = await register();
    await t.test('signup is unverified CUSTOMER, hashed, with no session or secret response; strict roles', async () => {
      assert.equal(account.user.role, 'CUSTOMER'); assert.equal(account.user.emailVerifiedAt, null);
      assert.equal(account.user.emailOriginal, account.email); assert.ok(await verifyPassword(account.password, account.user.passwordHash));
      assert.equal(await db.session.count({ where: { userId: account.user.id } }), 0);
      assert.equal((await call('auth/register', 'POST', { email: account.email, password: account.password, name: 'X', role: 'ADMIN' })).status, 400);
      assert.equal((await call('auth/register', 'POST', { email: account.email, password: account.password, name: 'X', emailVerifiedAt: new Date() })).status, 400);
      const row = await db.emailVerification.findFirstOrThrow({ where: { userId: account.user.id } }); assert.equal(row.tokenHash, tokenHash(account.token));
      const response = await call('auth/register', 'POST', { email: account.email, password: account.password, name: 'X' });
      assert.equal(response.status, 409); assert.equal(response.headers.get('set-cookie'), null); assert.equal((await response.json()).error.code, 'EMAIL_ALREADY_REGISTERED');
    });
    await t.test('parallel duplicate registration creates one account and never overwrites or invalidates link', async () => {
      const email = `duplicate-${randomUUID()}@example.test`; const input = { email, name: 'Original', password: account.password };
      const responses = await Promise.all([call('auth/register', 'POST', input), call('auth/register', 'POST', input)]);
      assert.deepEqual(responses.map(r => r.status).sort(), [202, 409]);
      assert.equal(await db.user.count({ where: { email } }), 1);
      await call('auth/register', 'POST', { email: account.email.toUpperCase(), name: 'Changed', password: 'another valid password' });
      const original = await db.user.findUniqueOrThrow({ where: { id: account.user.id } });
      assert.equal(original.passwordHash, account.user.passwordHash); assert.equal(original.name, account.user.name);
      assert.equal(await db.emailVerification.count({ where: { userId: original.id } }), 1);
    });
    await t.test('password precedes eligibility and verification; registration/activation never logs in', async () => {
      let response = await call('auth/login', 'POST', { email: account.email, password: 'wrong' }); assert.equal(response.status, 401); assert.equal((await response.json()).error.code, 'INVALID_CREDENTIALS');
      response = await call('auth/login', 'POST', { email: account.email, password: account.password }); assert.equal(response.status, 403); assert.equal((await response.json()).error.code, 'EMAIL_NOT_VERIFIED'); assert.equal(response.headers.get('set-cookie'), null);
      assert.equal((await call('auth/verify-email')).status, 404); assert.equal((await db.user.findUniqueOrThrow({ where: { id: account.user.id } })).emailVerifiedAt, null);
      const results = await Promise.all([call('auth/verify-email', 'POST', { token: account.token }), call('auth/verify-email', 'POST', { token: account.token })]);
      assert.deepEqual(results.map(r => r.status).sort(), [200, 400]); results.forEach(r => assert.equal(r.headers.get('set-cookie'), null));
      assert.equal(await db.session.count({ where: { userId: account.user.id } }), 0);
      assert.equal((await call('auth/verify-email', 'POST', { token: account.token })).status, 400);
    });
    await t.test('expired, revoked, malformed, changed-email and disabled-account tokens cannot activate', async () => {
      assert.equal((await call('auth/verify-email', 'POST', { token: 'bad' })).status, 400);
      for (const condition of ['expired', 'revoked', 'changed', 'disabled', 'deleted']) {
        const pending = await register();
        if (condition === 'expired') await db.emailVerification.updateMany({ where: { userId: pending.user.id }, data: { expiresAt: new Date(0) } });
        if (condition === 'revoked') await db.emailVerification.updateMany({ where: { userId: pending.user.id }, data: { revokedAt: new Date() } });
        if (condition === 'changed') await db.user.update({ where: { id: pending.user.id }, data: { email: `changed-${randomUUID()}@example.test` } });
        if (condition === 'disabled' || condition === 'deleted') await db.user.update({ where: { id: pending.user.id }, data: condition === 'disabled' ? { disabledAt: new Date() } : { deletedAt: new Date() } });
        assert.equal((await call('auth/verify-email', 'POST', { token: pending.token })).status, 400);
        assert.equal((await db.user.findUniqueOrThrow({ where: { id: pending.user.id } })).emailVerifiedAt, null);
        if (condition === 'disabled' || condition === 'deleted') { const before = mail.length; assert.equal((await call('auth/resend-activation', 'POST', { email: pending.email })).status, 202); assert.equal(mail.length, before); }
      }
    });
    await t.test('resend cooldown, hourly limit, concurrent requests and generic responses', async () => {
      const pending = await register(); const start = mail.length;
      await call('auth/resend-activation', 'POST', { email: pending.email }); assert.equal(mail.length, start);
      await db.emailVerification.updateMany({ where: { userId: pending.user.id }, data: { createdAt: new Date(Date.now() - 61000), deliveryAcceptedAt: new Date(Date.now() - 61000) } });
      await Promise.all([call('auth/resend-activation', 'POST', { email: pending.email }), call('auth/resend-activation', 'POST', { email: pending.email })]);
      assert.equal(mail.length, start + 1);
      assert.equal((await call('auth/verify-email', 'POST', { token: pending.token })).status, 400);
      const latest = mail[mail.length - 1].token;
      await db.emailVerification.createMany({ data: Array.from({ length: 3 }, () => ({ userId: pending.user.id, email: pending.user.email, tokenHash: tokenHash(randomUUID()), expiresAt: new Date(Date.now() + 60000), createdAt: new Date(Date.now() - 61000), revokedAt: new Date() })) });
      await db.emailVerification.updateMany({ where: { userId: pending.user.id }, data: { createdAt: new Date(Date.now() - 61000), deliveryAcceptedAt: new Date(Date.now() - 61000) } });
      const limited = await call('auth/resend-activation', 'POST', { email: pending.email }); const unknown = await call('auth/resend-activation', 'POST', { email: `${randomUUID()}@example.test` });
      assert.deepEqual(await limited.json(), await unknown.json()); assert.equal(mail.length, start + 1);
      assert.equal((await call('auth/verify-email', 'POST', { token: latest })).status, 200);
    });
    let session = await signIn(account);
    await t.test('JWT claims, role checks, protected ownership and token substitution', async () => {
      const payload = jwt.decode(session.accessToken); assert.equal(payload.purpose, 'access'); assert.equal(payload.sub, account.user.id); assert.ok(payload.sid && payload.jti && payload.iss && payload.aud); assert.equal(payload.exp - payload.iat, 900); assert.equal(payload.email, undefined);
      assert.equal((await call('account', 'GET', undefined, session)).status, 200); assert.equal((await call('admin', 'GET', undefined, session)).status, 403);
      assert.equal((await call('account/' + randomUUID(), 'GET', undefined, session)).status, 404);
      for (const token of [account.token, session.cookie.split('=')[1], session.accessToken.slice(0, -8) + 'tampered', jwt.sign({ ...payload, exp: 1 }, authConfig().secret), jwt.sign(payload, '', { algorithm: 'none' }), jwt.sign({ ...payload, purpose: 'verification' }, authConfig().secret, { header: { typ: 'at+jwt' } }), jwt.sign({ ...payload, aud: 'wrong' }, authConfig().secret), jwt.sign({ ...payload, iss: 'wrong' }, authConfig().secret), jwt.sign(payload, authConfig().secret, { algorithm: 'HS384' })]) {
        assert.equal((await call('account', 'GET', undefined, { accessToken: token })).status, 401);
      }
      assert.equal((await call('auth/verify-email', 'POST', { token: session.accessToken })).status, 400);
    });
    await t.test('refresh rotation preserves absolute expiry; concurrent overlap returns conflict; reuse revokes', async () => {
      const previous = await db.session.findUniqueOrThrow({ where: { id: jwt.decode(session.accessToken).sid } });
      const results = await Promise.all([call('auth/refresh', 'POST', undefined, session), call('auth/refresh', 'POST', undefined, session)]);
      assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
      const success = results.find(r => r.status === 200); const body = await success.json();
      const nextCookie = success.headers.get('set-cookie').split(';')[0]; assert.ok(nextCookie !== session.cookie);
      assert.equal((await db.session.findUniqueOrThrow({ where: { id: previous.id } })).expiresAt.getTime(), previous.expiresAt.getTime());
      await db.refreshCredential.updateMany({ where: { tokenHash: tokenHash(session.cookie.split('=')[1]) }, data: { consumedAt: new Date(Date.now() - 6000) } });
      assert.equal((await call('auth/refresh', 'POST', undefined, session)).status, 401);
      assert.equal((await call('account', 'GET', undefined, { accessToken: body.accessToken })).status, 401);
      assert.equal((await call('auth/refresh', 'POST', undefined, { cookie: nextCookie })).status, 401);
    });
    await t.test('live status and role changes, absolute expiry, and immediate logout revocation', async () => {
      session = await signIn(account);
      await db.user.update({ where: { id: account.user.id }, data: { role: 'ADMIN' } });
      assert.equal((await call('admin', 'GET', undefined, session)).status, 200); assert.equal((await call('account', 'GET', undefined, session)).status, 403);
      await db.user.update({ where: { id: account.user.id }, data: { disabledAt: new Date() } });
      assert.equal((await call('admin', 'GET', undefined, session)).status, 401);
      const denied = await call('auth/login', 'POST', { email: account.email, password: account.password }); assert.equal((await denied.json()).error.code, 'ACCOUNT_UNAVAILABLE');
      await db.user.update({ where: { id: account.user.id }, data: { disabledAt: null, deletedAt: new Date() } }); assert.equal((await call('admin', 'GET', undefined, session)).status, 401);
      await db.user.update({ where: { id: account.user.id }, data: { deletedAt: null, role: 'CUSTOMER' } });
      await db.session.update({ where: { id: jwt.decode(session.accessToken).sid }, data: { expiresAt: new Date(0) } }); assert.equal((await call('auth/refresh', 'POST', undefined, session)).status, 401);
      session = await signIn(account);
      const secondDevice = await signIn(account);
      assert.equal((await call('auth/logout', 'POST', undefined, session)).status, 204);
      assert.equal((await call('auth/logout', 'POST', undefined, session)).status, 204);
      assert.equal((await call('account', 'GET', undefined, session)).status, 401); assert.equal((await call('auth/refresh', 'POST', undefined, session)).status, 401);
      assert.equal((await call('account', 'GET', undefined, secondDevice)).status, 200);
      assert.equal((await call('auth/logout', 'POST', undefined, { accessToken: secondDevice.accessToken })).status, 204);
      assert.equal((await call('account', 'GET', undefined, secondDevice)).status, 401);
    });
    await t.test('CORS, CSRF, account throttling and no-store', async () => {
      assert.equal((await call('health/live', 'GET', undefined, {}, 'https://evil.test')).status, 403);
      assert.equal((await call('auth/login', 'POST', {}, {}, 'http://localhost:3100', '')).status, 403);
      assert.equal((await call('auth/logout', 'POST', undefined, session, '')).status, 403);
      const preflight = await call('auth/refresh', 'OPTIONS'); assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:3100');
      assert.equal((await call('auth/me', 'GET', undefined, session)).headers.get('cache-control'), 'no-store');
      process.env.LOGIN_ACCOUNT_LIMIT = '1';
      const email = `${randomUUID()}@example.test`;
      await call('auth/login', 'POST', { email, password: 'wrong' }); assert.equal((await call('auth/login', 'POST', { email, password: 'wrong' })).status, 429);
    });
    await t.test('per-IP auth mutation limit is enforced by HTTP middleware', async () => {
      const previous = process.env.AUTH_IP_LIMIT; process.env.AUTH_IP_LIMIT = '1';
      const limitedApp = await createApp(); await limitedApp.listen(0, '127.0.0.1');
      try {
        const endpoint = (await limitedApp.getUrl()) + '/api/auth/logout';
        const options = { method: 'POST', headers: { Origin: 'http://localhost:3100', 'X-CSRF-Protection': '1' } };
        assert.equal((await fetch(endpoint, options)).status, 204);
        assert.equal((await fetch(endpoint, options)).status, 429);
      } finally { await limitedApp.close(); process.env.AUTH_IP_LIMIT = previous; }
    });
    await t.test('failed send leaves a pending account and immediate resend recovers without duplicate account', async () => {
      const originalSend = app.get(MailService).activation;
      app.get(MailService).activation = async () => 'failed';
      const email = `failure-${randomUUID()}@example.test`;
      const response = await call('auth/register', 'POST', { email, name: 'Pending', password: randomBytes(24).toString('hex') });
      assert.equal(response.status, 202); assert.equal((await response.json()).delivery, 'failed');
      const pending = await db.user.findUniqueOrThrow({ where: { email } });
      assert.equal(pending.emailVerifiedAt, null); assert.equal(await db.session.count({ where: { userId: pending.id } }), 0);
      assert.equal((await db.emailVerification.findFirstOrThrow({ where: { userId: pending.id } })).deliveryFailedAt instanceof Date, true);
      app.get(MailService).activation = originalSend;
      const resend = await call('auth/resend-activation', 'POST', { email });
      assert.equal(resend.status, 202); assert.equal((await resend.json()).delivery, 'requested');
      assert.equal(await db.user.count({ where: { email } }), 1);
      assert.equal(mail.filter(item => item.email === email).length, 1);
    });
  } finally { await app.close(); }
});
