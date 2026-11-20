import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { authConfig } from './config';
import { PrismaService } from '../prisma.service';
import { verificationEmail } from './verification-email';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  constructor(private readonly db?: PrismaService) {}

  /** Accepted means the configured SMTP server accepted the message, not inbox delivery. */
  async activation(email: string, name: string | null, token: string): Promise<'accepted' | 'failed'> {
    const config = authConfig();
    if (!config.smtpHost || !config.smtpPort || !config.mailFrom || Boolean(config.smtpUser) !== Boolean(config.smtpPassword)) {
      this.logger.warn('Verification email provider configuration is incomplete. The account remains pending.');
      return 'failed';
    }
    let transport: ReturnType<typeof nodemailer.createTransport> | undefined;
    try {
      const settings = this.db ? await this.db.storeSettings.findUnique({ where: { id: 'store' }, select: { storeName: true, supportEmail: true } }) : null;
      const content = verificationEmail({ storeName: settings?.storeName ?? config.storeName, name, url: `${config.frontend}/activate#token=${token}`, expiryHours: config.activationHours, supportEmail: settings?.supportEmail });
      transport = nodemailer.createTransport({ host: config.smtpHost, port: config.smtpPort, secure: config.smtpSecure, requireTLS: !config.smtpSecure, auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPassword } : undefined, connectionTimeout: 3000, greetingTimeout: 3000, socketTimeout: 5000, logger: false, debug: false });
      let lastCode = 'SMTP_REJECTED';
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const result = await transport.sendMail({ from: { name: settings?.storeName ?? config.storeName, address: config.mailFrom }, to: email, ...content, disableFileAccess: true, disableUrlAccess: true });
          if (result.accepted.length > 0) return 'accepted';
        } catch (error) {
          const code = (error as { code?: unknown }).code;
          if (typeof code === 'string' && /^[A-Z0-9_]{2,40}$/.test(code)) lastCode = code;
        }
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 100 * 2 ** attempt));
      }
      this.logger.warn(`Verification email was not accepted by SMTP (${lastCode}). The account remains pending.`);
      return 'failed';
    } catch {
      this.logger.warn('Verification email preparation failed. The account remains pending.');
      return 'failed';
    } finally { transport?.close(); }
  }
}
