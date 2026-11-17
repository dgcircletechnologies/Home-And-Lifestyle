import 'reflect-metadata';
import { PrismaService } from './prisma.service';
import { hashPassword } from './auth/password';
import { registerSchema, canonicalEmail } from './auth/contracts';
import { PasswordPolicy } from './auth/password-policy';

function configuredAdmin() {
  const name = process.env.SEED_ADMIN_NAME ?? process.env.ADMIN_NAME;
  const email = process.env.SEED_ADMIN_EMAIL ?? process.env.ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD;
  if (!name || !email || !password) throw Error('Set SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, and SEED_ADMIN_PASSWORD before provisioning an administrator.');
  const parsed = registerSchema.safeParse({ name, email, password });
  if (!parsed.success) throw Error('Admin seed input is invalid. Use a valid name/email and a 15–128 character password.');
  if ((process.env.SEED_ADMIN_CONFIRM_VERIFIED ?? process.env.ADMIN_CONFIRM_VERIFIED) !== 'true') throw Error('Set SEED_ADMIN_CONFIRM_VERIFIED=true to explicitly mark this trusted bootstrap administrator as verified.');
  return parsed.data;
}

async function main() {
  const input = configuredAdmin();
  const email = canonicalEmail(input.email);
  const db = new PrismaService();
  try {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.role !== 'ADMIN' || existing.disabledAt || existing.deletedAt) throw Error('The configured email belongs to a non-eligible or non-admin account; it was not changed.');
      if (!existing.emailVerifiedAt) {
        await db.user.update({ where: { id: existing.id }, data: { emailVerifiedAt: new Date() } });
        console.log('Existing administrator email explicitly confirmed by operator.');
        return;
      }
      console.log('Administrator already exists; no changes made.');
      return;
    }
    if (await db.customer.findUnique({ where: { email } })) throw Error('The configured email conflicts with a customer profile; it was not changed.');
    await new PasswordPolicy().assertAllowed(input.password);
    await db.user.create({ data: { email, emailOriginal: input.email, emailVerifiedAt: new Date(), name: input.name, passwordHash: await hashPassword(input.password), role: 'ADMIN' } });
    console.log('Administrator created.');
  } finally { await db.$disconnect(); }
}

void main().catch(error => {
  const message = error instanceof Error ? error.message : 'Unknown failure.';
  console.error(`Admin creation failed: ${message}`);
  process.exitCode = 1;
});
