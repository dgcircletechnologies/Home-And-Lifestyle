import { z } from 'zod';
import '../environment';
const integer = (name: string, fallback: number, max: number) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > max) throw Error(`Invalid ${name}.`);
  return value;
};
export function authConfig() {
  const production = process.env.NODE_ENV === 'production';
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length % 2 !== 0 || !/^[a-fA-F0-9]{64,}$/.test(secret)) throw Error('JWT_SECRET must be at least 32 random bytes encoded as hex.');
  const issuer = process.env.JWT_ISSUER;
  const audience = process.env.JWT_AUDIENCE;
  if (!issuer || !audience) throw Error('JWT_ISSUER and JWT_AUDIENCE are required.');
  let frontend: URL;
  try { frontend = new URL(process.env.FRONTEND_URL ?? ''); } catch { throw Error('FRONTEND_URL is required.'); }
  if (!['http:', 'https:'].includes(frontend.protocol) || frontend.username || frontend.password || frontend.search || frontend.hash || frontend.pathname !== '/' || (production && frontend.protocol !== 'https:')) throw Error('FRONTEND_URL must be a trusted origin, HTTPS in production.');
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const mailFrom = process.env.MAIL_FROM?.trim();
  if (smtpPort !== undefined && (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535)) throw Error('Invalid SMTP_PORT.');
  if (mailFrom && !z.email().safeParse(mailFrom).success) throw Error('Invalid MAIL_FROM.');
  const secure = process.env.SMTP_SECURE ?? 'false';
  if (!['true', 'false'].includes(secure)) throw Error('SMTP_SECURE must be true or false.');
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const storeName = process.env.STORE_NAME ?? 'Home & Lifestyle';
  if (storeName.length > 100 || /[\r\n]/.test(storeName)) throw Error('Invalid STORE_NAME.');
  return { production, secret: Buffer.from(secret, 'hex'), issuer, audience, frontend: frontend.origin,
    accessSeconds: integer('JWT_ACCESS_SECONDS', 900, 3600), refreshDays: integer('REFRESH_DAYS', 7, 30),
    activationHours: integer('ACTIVATION_HOURS', 24, 168), resendSeconds: integer('RESEND_COOLDOWN_SECONDS', 60, 3600), resendHourly: integer('RESEND_HOURLY_LIMIT', 5, 20),
    loginAttempts: integer('LOGIN_ACCOUNT_LIMIT', 10, 100), ipLimit: integer('AUTH_IP_LIMIT', 60, 1000),
    smtpHost, smtpPort, smtpSecure: secure === 'true', smtpUser, smtpPassword, mailFrom, storeName };
}
