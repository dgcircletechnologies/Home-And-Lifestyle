import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { api, ApiError, apiBase } from '../src/lib/api';
import { safeReturn } from '../src/features/auth/service';
const mailCapture = process.env.TEST_MAIL_CAPTURE_URL;
async function activationLink(email: string) {
  if (!mailCapture) throw Error('TEST_MAIL_CAPTURE_URL is required for inbox integration.');
  let link = '';
  await expect.poll(async () => {
    const listing = await (await fetch(`${mailCapture}/api/v1/messages`)).json();
    const entry = listing.messages.find((message: { To: { Address: string }[] }) => message.To.some(to => to.Address === email));
    if (!entry) return false;
    const detail = await (await fetch(`${mailCapture}/api/v1/message/${entry.ID}`)).json();
    link = detail.Text.match(/http:\/\/localhost:3100\/activate#token=[A-Za-z0-9_-]{43}/)?.[0] ?? '';
    return !!link;
  }, { timeout: 30000 }).toBe(true);
  return link;
}
async function login(page: Page, email: string, password: string) {
  await page.goto('/login'); await page.getByLabel('Email address').fill(email); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
test('shared API handles URLs, safe returns, empty, non-JSON, multipart, cancellation and field errors', async () => {
  expect(apiBase('http://localhost:3101/api/')).toBe('http://localhost:3101/api'); expect(() => apiBase('http://localhost:3101/api/api')).toThrow();
  expect(safeReturn('https://evil.test', { id: '1', name: 'Test', email: 'test@example.test', role: 'CUSTOMER' })).toBe('/account');
  const original = global.fetch;
  try {
    global.fetch = async () => new Response(null, { status: 204 }); expect(await api('auth/logout', { method: 'POST' })).toBeUndefined();
    global.fetch = async () => new Response('bad upstream', { status: 502 }); await expect(api('auth/me')).rejects.toMatchObject({ status: 502 });
    global.fetch = async () => new Response(JSON.stringify({ error: { message: 'Invalid input', fields: { email: ['Invalid email'] } } }), { status: 400 }); await expect(api('auth/register')).rejects.toMatchObject({ fields: { email: ['Invalid email'] } });
    global.fetch = async (_url, options) => { expect(new Headers(options?.headers).has('Content-Type')).toBe(false); return new Response('{}'); }; await api('upload', { method: 'POST', body: new FormData() });
    global.fetch = async () => { throw Error('network'); }; await expect(api('auth/me')).rejects.toBeInstanceOf(ApiError); await expect(api('auth/me', { signal: AbortSignal.abort() })).rejects.toMatchObject({ message: 'Request cancelled.' });
  } finally { global.fetch = original; }
});
test('initialization holds protected content and missing session redirects once', async ({ page }) => {
  await page.route('**/api/auth/refresh', async route => { await new Promise(resolve => setTimeout(resolve, 500)); await route.fulfill({ status: 401, json: { error: { code: 'REFRESH_INVALID', message: 'Please sign in again.' } } }); });
  await page.goto('/account'); await expect(page.getByText('Loading your session…')).toBeVisible(); await expect(page.getByRole('heading', { name: 'My Profile' })).toHaveCount(0); await expect(page).toHaveURL(/\/login/);
});
test('password confirmation and invalid link are accessible; no activation GET mutation', async ({ page }) => {
  await page.goto('/register'); await page.getByLabel('Full name').fill('Test'); await page.getByLabel('Email address').fill('test@example.test'); await page.getByLabel('Password', { exact: true }).fill('a long password phrase'); await page.getByLabel('Confirm password').fill('a different password'); await page.getByRole('button', { name: 'Create account', exact: true }).click(); await expect(page.getByText('Passwords must match.')).toBeVisible();
  await page.getByRole('button', { name: 'Show password' }).click(); await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  const response = await page.goto('/activate#token=invalid'); expect(response?.headers()['referrer-policy']).toBe('no-referrer'); await expect(page).toHaveURL('/activate'); await expect(page.getByText('This link is invalid, expired, or already used. Request a new email.')).toBeVisible();
});
test('real SMTP signup → unverified login → explicit activation → login → reload → RBAC → multi-tab refresh/logout', async ({ page, context, browser }) => {
  test.skip(!mailCapture, 'Requires a separate test email capture endpoint; no mail service runs in Compose.');
  test.setTimeout(90000);
  const email = `browser-${Date.now()}@example.test`; const password = `A quiet home ${randomBytes(16).toString('hex')}`;
  await page.goto('/register'); await page.getByLabel('Full name').fill('Browser Customer'); await page.getByLabel('Email address').fill(email); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible({ timeout: 30000 });
  expect((await context.cookies()).some(c => c.name.includes('refresh'))).toBe(false);
  const link = await activationLink(email);
  await login(page, email, password); await expect(page.getByText('Please verify your email before signing in.')).toBeVisible(); await expect(page.getByRole('link', { name: 'Resend activation email' })).toBeVisible();
  // A separate browser context has no registration cookies. Opening alone must not activate.
  const other = await browser.newContext(); const activation = await other.newPage();
  await activation.goto(link); await expect(activation).toHaveURL('/activate'); await expect(activation.getByRole('button', { name: 'Verify email', exact: true })).toBeVisible();
  await login(page, email, password); await expect(page.getByText('Please verify your email before signing in.')).toBeVisible();
  await activation.getByRole('button', { name: 'Verify email', exact: true }).click(); await expect(activation.getByText('Your email has been verified. You can now sign in.')).toBeVisible(); expect((await other.cookies()).some(c => c.name.includes('refresh'))).toBe(false);
  await activation.goto(link); await activation.getByRole('button', { name: 'Verify email', exact: true }).click(); await expect(activation.getByRole('alert').filter({ hasText: 'already used' })).toBeVisible(); await other.close();
  await login(page, email, password); await expect(page).toHaveURL('/account'); await expect(page.getByRole('heading', { name: 'My Profile' })).toBeVisible(); await expect(page.getByText('Browser Customer', { exact: true })).toBeVisible();
  const tab = await context.newPage(); await Promise.all([page.reload(), tab.goto('/account')]);
  await expect(page.getByRole('heading', { name: 'My Profile' })).toBeVisible(); await expect(tab.getByRole('heading', { name: 'My Profile' })).toBeVisible();
  await page.goto('/admin'); await expect(page).toHaveURL('/access-denied'); await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await page.goto('/account'); await expect(page.getByRole('heading', { name: 'My Profile' })).toBeVisible();
  // Logout races with a refresh in another tab; late responses must never restore auth.
  let started: () => void = () => {}; const refreshing = new Promise<void>(resolve => { started = resolve; });
  await tab.route('**/api/auth/refresh', async route => { started(); await new Promise(resolve => setTimeout(resolve, 500)); await route.continue(); });
  const reload = tab.reload(); await refreshing; await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await reload;
  await expect(page).toHaveURL(/\/login/); await expect(tab).toHaveURL(/\/login/);
  await expect.poll(async () => (await context.cookies()).some(c => c.name.includes('refresh'))).toBe(false);
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
  await tab.close();
});
test('administrator uses explicitly verified CLI provisioning and real admin API', async ({ page }) => {
  test.skip(!process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD, 'Requires an explicitly verified test administrator.');
  await login(page, process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!); await expect(page).toHaveURL('/admin'); await expect(page.getByRole('heading', { name: /Store overview/ })).toBeVisible();
});
