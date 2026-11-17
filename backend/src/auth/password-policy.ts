import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
@Injectable()
export class PasswordPolicy {
  async assertAllowed(password: string) {
    // HIBP range lookup discloses only five SHA-1 hex characters, never the password/full hash.
    const hash = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
    let content: string;
    try {
      const response = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, { headers: { 'Add-Padding': 'true', 'User-Agent': 'HomeLifestyle-PasswordCheck' }, signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw Error();
      content = await response.text();
      if (!content.trim() || content.length > 1000000 || !content.split(/\r?\n/).filter(Boolean).every(line => /^[A-F0-9]{35}:\d+$/.test(line))) throw Error();
    } catch { throw new ServiceUnavailableException({ code: 'PASSWORD_CHECK_UNAVAILABLE', message: 'Password safety check is unavailable. Please try again.' }); }
    if (content.split(/\r?\n/).some(line => { const [suffix, count] = line.split(':'); return suffix === hash.slice(5) && Number(count) > 0; })) throw new BadRequestException({ code: 'PASSWORD_COMPROMISED', message: 'Choose a password that has not appeared in known data breaches.', fields: { password: ['This password is known to be compromised. Choose a different password.'] } });
  }
}
