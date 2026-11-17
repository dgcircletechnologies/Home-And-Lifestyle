import { Injectable, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { authConfig } from './config';
export const invalidAccess = () => new UnauthorizedException({ code: 'ACCESS_INVALID', message: 'Authentication required.' });
@Injectable()
export class AccessTokens {
  issue(userId: string, sessionId: string) {
    const c = authConfig();
    return jwt.sign({ sid: sessionId, purpose: 'access' }, c.secret, { algorithm: 'HS256', issuer: c.issuer, audience: c.audience, subject: userId, jwtid: randomUUID(), expiresIn: c.accessSeconds, header: { alg: 'HS256', typ: 'at+jwt' } });
  }
  verify(token?: string) {
    try {
      if (!token || token.length > 4096) throw Error();
      const c = authConfig();
      const result = jwt.verify(token, c.secret, { algorithms: ['HS256'], issuer: c.issuer, audience: c.audience, complete: true });
      const p = result.payload;
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (typeof p === 'string' || result.header.typ !== 'at+jwt' || p.purpose !== 'access' || !uuid.test(p.sub ?? '') || typeof p.sid !== 'string' || !uuid.test(p.sid) || !uuid.test(p.jti ?? '') || typeof p.iat !== 'number' || typeof p.exp !== 'number' || p.iat > Date.now() / 1000 + 5) throw Error();
      return { userId: p.sub!, sessionId: p.sid };
    } catch { throw invalidAccess(); }
  }
}
