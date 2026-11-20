const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verificationEmail } = require('../dist/src/auth/verification-email');
const { MailService } = require('../dist/src/auth/mail.service');

test('verification email uses saved identity, expiry, and safe HTML in both formats', () => {
  const message = verificationEmail({ storeName: 'Home & <Lifestyle>', name: '<Asha&Co> Sharma', url: 'http://localhost:5007/activate#token=example', expiryHours: 24, supportEmail: 'care@example.test' });
  assert.equal(message.subject, 'Verify your email for Home & <Lifestyle>');
  assert.match(message.text, /Hello <Asha&Co>,/);
  assert.match(message.text, /expires in 24 hours/);
  assert.match(message.text, /care@example\.test/);
  assert.match(message.text, /activate#token=example/);
  assert.match(message.html, /Home &amp; &lt;Lifestyle&gt;/);
  assert.match(message.html, /Hello &lt;Asha&amp;Co&gt;,/);
  assert.doesNotMatch(message.html, /<Asha&Co>/);
  assert.match(message.html, /Verify my email address/);
  assert.match(message.html, /Confirm your email address to activate your account/);
});

test('verification email falls back to a neutral greeting', () => {
  const message = verificationEmail({ storeName: 'Home & Lifestyle', name: '  ', url: 'https://example.test/activate#token=example', expiryHours: 1 });
  assert.match(message.text, /^Hello there,/);
  assert.match(message.html, /Hello there,/);
  assert.match(message.text, /expires in 1 hour\./);
});

test('missing provider configuration is a recoverable send failure', async () => {
  const original = { host: process.env.SMTP_HOST, port: process.env.SMTP_PORT, sender: process.env.MAIL_FROM };
  try {
    process.env.SMTP_HOST = '';
    process.env.SMTP_PORT = '';
    process.env.MAIL_FROM = '';
    assert.equal(await new MailService().activation('customer@example.test', 'Asha', 'preview-only'), 'failed');
  } finally {
    if (original.host === undefined) delete process.env.SMTP_HOST; else process.env.SMTP_HOST = original.host;
    if (original.port === undefined) delete process.env.SMTP_PORT; else process.env.SMTP_PORT = original.port;
    if (original.sender === undefined) delete process.env.MAIL_FROM; else process.env.MAIL_FROM = original.sender;
  }
});
