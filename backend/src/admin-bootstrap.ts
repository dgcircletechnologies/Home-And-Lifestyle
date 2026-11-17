import 'reflect-metadata';
import { PrismaService } from './prisma.service';
import { hashPassword } from './auth/password';
import { registerSchema, canonicalEmail } from './auth/contracts';
import { PasswordPolicy } from './auth/password-policy';
async function main() {
  const input = registerSchema.parse({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, name: process.env.ADMIN_NAME });
  const email = canonicalEmail(input.email);
  const db = new PrismaService();
  try {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.role !== 'ADMIN' || existing.disabledAt || existing.deletedAt) throw Error();
      if (!existing.emailVerifiedAt) {
        if (process.env.ADMIN_CONFIRM_VERIFIED !== 'true') throw Error();
        await db.user.update({ where: { id: existing.id }, data: { emailVerifiedAt: new Date() } });
        console.log('Existing administrator email explicitly confirmed by operator.'); return;
      }
      console.log('Administrator already exists; no changes made.'); return;
    }
    if (await db.customer.findUnique({ where: { email } })) throw Error();
    if (process.env.ADMIN_CONFIRM_VERIFIED !== 'true') throw Error();
    await new PasswordPolicy().assertAllowed(input.password);
    await db.user.create({ data: { email, emailOriginal: input.email, emailVerifiedAt: new Date(), name: input.name, passwordHash: await hashPassword(input.password), role: 'ADMIN' } });
    console.log('Administrator created.');
  } finally { await db.$disconnect(); }
}
void main().catch(() => { console.error('Admin creation failed. Check input, existing account conflicts and database availability. No existing account was promoted or reset.'); process.exitCode = 1; });
