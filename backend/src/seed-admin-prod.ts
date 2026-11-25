import 'reflect-metadata';
import { PrismaService } from './prisma.service';
import { hashPassword } from './auth/password';
import { registerSchema, canonicalEmail } from './auth/contracts';
import { PasswordPolicy } from './auth/password-policy';

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'Administrator';
  if (!email || !password) throw Error('ADMIN_EMAIL and ADMIN_PASSWORD are required.');
  const parsed = registerSchema.safeParse({ name, email, password });
  if (!parsed.success) throw Error('Invalid ADMIN_EMAIL, ADMIN_NAME, or ADMIN_PASSWORD.');
  const normalized = canonicalEmail(parsed.data.email);
  const db = new PrismaService();
  try {
    const existing = await db.user.findUnique({ where: { email: normalized } });
    if (existing) {
      if (existing.role !== 'ADMIN' || existing.disabledAt || existing.deletedAt || !existing.emailVerifiedAt) {
        throw Error('ADMIN_EMAIL belongs to an ineligible or unverified account; no changes made.');
      }
      console.log('Administrator already exists; no changes made.');
      return;
    }
    if (await db.customer.findUnique({ where: { email: normalized } })) throw Error('ADMIN_EMAIL conflicts with a customer profile.');
    await new PasswordPolicy().assertAllowed(parsed.data.password);
    await db.user.create({ data: {
      email: normalized, emailOriginal: parsed.data.email, name: parsed.data.name,
      passwordHash: await hashPassword(parsed.data.password), role: 'ADMIN', emailVerifiedAt: new Date(),
    } });
    console.log('Administrator created.');
  } finally { await db.$disconnect(); }
}

void main().catch(error => {
  console.error(`Admin seed failed: ${error instanceof Error ? error.message : 'Unknown failure.'}`);
  process.exitCode = 1;
});
