import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { authConfig } from './config';
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
@Injectable()
export class MailService {
  async activation(email: string, name: string, token: string) {
    const c = authConfig();
    const link = `${c.frontend}/activate#token=${token}`;
    const text = `Hello ${name},\n\nVerify your email for ${c.storeName}:\n${link}\n\nOpen the link and choose Verify email. This link expires in ${c.activationHours} hours. Use the most recent email if you requested another link.\n\nIf you did not create this account, ignore this email.`;
    const html = `<h1>${escape(c.storeName)}</h1><p>Hello ${escape(name)},</p><p>Confirm your email address to finish creating your account.</p><p><a href="${escape(link)}">Verify email</a></p><p>Open the link and choose Verify email. Expires in ${c.activationHours} hours. Use the most recent email.</p><p>Or copy this link: ${escape(link)}</p><p>If you did not create this account, ignore this email.</p>`;
    const transport = nodemailer.createTransport({ host: c.smtpHost, port: c.smtpPort, secure: c.smtpSecure, requireTLS: c.production, auth: c.smtpUser ? { user: c.smtpUser, pass: c.smtpPassword } : undefined, connectionTimeout: 3000, greetingTimeout: 3000, socketTimeout: 5000, logger: false, debug: false });
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        try { const result = await transport.sendMail({ from: { name: c.storeName, address: c.mailFrom }, to: email, subject: `Verify your email — ${c.storeName}`, text, html, disableFileAccess: true, disableUrlAccess: true }); if (!result.accepted.length) throw Error(); return; }
        catch { if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 100 * 2 ** attempt)); }
      }
      new Logger('Mail').warn('Activation email delivery failed after bounded retries. Account remains pending; resend is available.');
    } finally { transport.close(); }
  }
}
