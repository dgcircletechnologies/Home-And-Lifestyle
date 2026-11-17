import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import { UsersService, safeUser } from '../users/users.service';
import { hashPassword, verifyPassword } from './password';
import { PasswordPolicy } from './password-policy';
import { MailService } from './mail.service';
import { AccessTokens, invalidAccess } from './jwt.service';
import { authConfig } from './config';
import { canonicalEmail } from './contracts';
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const opaque = () => randomBytes(32).toString('base64url');
const validOpaque = (token?: string) => !!token && /^[A-Za-z0-9_-]{43}$/.test(token);
const lock = (tx: Prisma.TransactionClient, key: string) => tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${key}))`;
const invalidLink = () => new BadRequestException({ code: 'ACTIVATION_INVALID', message: 'This activation link is invalid, expired, or already used. Request a new email.' });
const invalidRefresh = () => new UnauthorizedException({ code: 'REFRESH_INVALID', message: 'Please sign in again.' });
const unavailable = () => new ForbiddenException({ code: 'ACCOUNT_UNAVAILABLE', message: 'This account is unavailable.' });
export const acknowledgement = () => ({ message: 'If this address is eligible, you’ll receive an activation email. If you already have an account, sign in.', resendAfterSeconds: authConfig().resendSeconds });
@Injectable()
export class AuthService {
  private readonly dummyHash = hashPassword(randomBytes(32).toString('hex'));
  constructor(private readonly db: PrismaService, private readonly users: UsersService, private readonly passwords: PasswordPolicy, private readonly mail: MailService, private readonly jwt: AccessTokens) {}
  async register(input: { email: string; password: string; name: string }) {
    await this.passwords.assertAllowed(input.password);
    const passwordHash = await hashPassword(input.password);
    const email = canonicalEmail(input.email);
    const token = opaque();
    try {
      await this.db.user.create({ data: { email, emailOriginal: input.email.trim(), name: input.name, passwordHash, role: 'CUSTOMER', emailVerifiedAt: null,
        verificationTokens: { create: { email, purpose: 'EMAIL_VERIFICATION', tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + authConfig().activationHours * 3600000) } } } });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') return acknowledgement();
      throw error;
    }
    await this.mail.activation(input.email.trim(), input.name, token);
    return acknowledgement();
  }
  async verifyEmail(token: string) {
    if (!validOpaque(token)) throw invalidLink();
    const found = await this.db.emailVerification.findUnique({ where: { tokenHash: tokenHash(token) } });
    if (!found) throw invalidLink();
    await this.db.$transaction(async tx => {
      await lock(tx, `user:${found.userId}`);
      const record = await tx.emailVerification.findUnique({ where: { id: found.id }, include: { user: true } });
      if (!record || record.purpose !== 'EMAIL_VERIFICATION' || record.consumedAt || record.revokedAt || record.expiresAt <= new Date() || record.email !== record.user.email || record.user.emailVerifiedAt || record.user.disabledAt || record.user.deletedAt) throw invalidLink();
      const now = new Date();
      const consumed = await tx.emailVerification.updateMany({ where: { id: record.id, consumedAt: null, revokedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } });
      if (consumed.count !== 1) throw invalidLink();
      await tx.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: now } });
      await tx.emailVerification.updateMany({ where: { userId: record.userId, id: { not: record.id }, revokedAt: null, consumedAt: null }, data: { revokedAt: now } });
    });
    return { message: 'Your email has been verified. You can now sign in.' };
  }
  async resend(emailInput: string) {
    const email = canonicalEmail(emailInput);
    const user = await this.users.byEmail(email);
    if (!user) return acknowledgement();
    const token = opaque();
    const delivery = await this.db.$transaction(async tx => {
      await lock(tx, `user:${user.id}`);
      const current = await tx.user.findUnique({ where: { id: user.id } });
      if (!current || current.email !== email || current.emailVerifiedAt || current.disabledAt || current.deletedAt) return null;
      const c = authConfig(); const now = new Date();
      const recent = await tx.emailVerification.findMany({ where: { userId: user.id, createdAt: { gt: new Date(now.getTime() - 3600000) } }, orderBy: { createdAt: 'desc' } });
      if (recent.length >= c.resendHourly || (recent[0] && now.getTime() - recent[0].createdAt.getTime() < c.resendSeconds * 1000)) return null;
      await tx.emailVerification.updateMany({ where: { userId: user.id, consumedAt: null, revokedAt: null }, data: { revokedAt: now } });
      await tx.emailVerification.create({ data: { userId: user.id, email, purpose: 'EMAIL_VERIFICATION', tokenHash: tokenHash(token), expiresAt: new Date(now.getTime() + c.activationHours * 3600000) } });
      return current;
    });
    if (delivery) await this.mail.activation(delivery.emailOriginal ?? delivery.email, delivery.name, token);
    return acknowledgement();
  }
  private async throttle(email: string) {
    const key = tokenHash(`login:${email}`);
    const allowed = await this.db.$transaction(async tx => {
      await lock(tx, key);
      const now = new Date();
      let row = await tx.authThrottle.findUnique({ where: { key } });
      if (!row || now.getTime() - row.windowStart.getTime() > 15 * 60000) row = await tx.authThrottle.upsert({ where: { key }, create: { key }, update: { attempts: 0, windowStart: now, blockedUntil: null } });
      if (row.blockedUntil && row.blockedUntil > now) return false;
      if (row.attempts >= authConfig().loginAttempts) return false;
      const attempts = row.attempts + 1;
      await tx.authThrottle.update({ where: { key }, data: { attempts, blockedUntil: attempts >= 5 ? new Date(now.getTime() + Math.min(60000, 1000 * 2 ** (attempts - 5))) : null } });
      return true;
    });
    if (!allowed) throw new HttpException({ code: 'LOGIN_THROTTLED', message: 'Too many attempts. Please wait before trying again.' }, 429);
    return key;
  }
  async login(emailInput: string, password: string) {
    const email = canonicalEmail(emailInput);
    const throttleKey = await this.throttle(email);
    const user = await this.users.byEmail(email);
    const valid = await verifyPassword(password, user?.passwordHash ?? await this.dummyHash);
    if (!user || !valid) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' });
    if (user.disabledAt || user.deletedAt) throw unavailable();
    if (!user.emailVerifiedAt) throw new ForbiddenException({ code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email before signing in.' });
    const upgraded = user.passwordHash.startsWith('scrypt$') ? await hashPassword(password) : undefined;
    const token = opaque(); const expiresAt = new Date(Date.now() + authConfig().refreshDays * 86400000);
    const result = await this.db.$transaction(async tx => {
      await lock(tx, `user:${user.id}`);
      const current = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      if (current.disabledAt || current.deletedAt || !current.emailVerifiedAt || current.passwordHash !== user.passwordHash) throw unavailable();
      if (upgraded) await tx.user.update({ where: { id: user.id }, data: { passwordHash: upgraded } });
      const session = await tx.session.create({ data: { userId: user.id, tokenHash: tokenHash(token), expiresAt, refreshCredentials: { create: { tokenHash: tokenHash(token) } } } });
      await tx.authThrottle.deleteMany({ where: { key: throttleKey } });
      return { session, user: current };
    });
    return { user: safeUser(result.user), accessToken: this.jwt.issue(user.id, result.session.id), expiresIn: authConfig().accessSeconds, token, expiresAt };
  }
  async refresh(token?: string) {
    if (!validOpaque(token)) throw invalidRefresh();
    const credential = await this.db.refreshCredential.findUnique({ where: { tokenHash: tokenHash(token!) } });
    if (!credential) throw invalidRefresh();
    const result = await this.db.$transaction(async tx => {
      await lock(tx, `session:${credential.sessionId}`);
      const row = await tx.refreshCredential.findUniqueOrThrow({ where: { id: credential.id }, include: { session: { include: { user: true } } } });
      const { session } = row; const now = new Date();
      if (session.revokedAt || session.expiresAt <= now || !session.user.emailVerifiedAt || session.user.disabledAt || session.user.deletedAt) return { error: 'invalid' as const };
      if (row.consumedAt) {
        // No token is issued to a stale credential. Short concurrent overlap is recoverable.
        if (now.getTime() - row.consumedAt.getTime() <= 5000) return { error: 'conflict' as const };
        await tx.session.update({ where: { id: session.id }, data: { revokedAt: now } });
        return { error: 'reuse' as const };
      }
      const next = opaque();
      await tx.refreshCredential.update({ where: { id: row.id }, data: { consumedAt: now } });
      await tx.refreshCredential.create({ data: { sessionId: session.id, tokenHash: tokenHash(next) } });
      await tx.session.update({ where: { id: session.id }, data: { tokenHash: tokenHash(next) } });
      return { user: safeUser(session.user), token: next, expiresAt: session.expiresAt, sessionId: session.id };
    });
    if ('error' in result) {
      if (result.error === 'conflict') throw new ConflictException({ code: 'REFRESH_CONFLICT', message: 'Another tab renewed this session. Please try again.' });
      throw invalidRefresh();
    }
    return { ...result, accessToken: this.jwt.issue(result.user.id, result.sessionId), expiresIn: authConfig().accessSeconds };
  }
  async resolve(token?: string) {
    const claims = this.jwt.verify(token);
    const session = await this.db.session.findUnique({ where: { id: claims.sessionId }, include: { user: true } });
    if (!session || session.userId !== claims.userId || session.revokedAt || session.expiresAt <= new Date() || session.user.disabledAt || session.user.deletedAt || !session.user.emailVerifiedAt) throw invalidAccess();
    return safeUser(session.user);
  }
  async logout(token?: string, accessToken?: string) {
    const credential = validOpaque(token) ? await this.db.refreshCredential.findUnique({ where: { tokenHash: tokenHash(token!) } }) : null;
    let accessSession: { userId: string; sessionId: string } | undefined;
    try { if (accessToken) accessSession = this.jwt.verify(accessToken); } catch { /* Idempotent logout tolerates invalid/expired access JWTs. */ }
    const ids = new Set([credential?.sessionId, accessSession?.sessionId].filter((id): id is string => !!id));
    for (const id of ids) {
      await this.db.$transaction(async tx => {
        await lock(tx, `session:${id}`);
        await tx.session.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
      });
    }
  }
}
