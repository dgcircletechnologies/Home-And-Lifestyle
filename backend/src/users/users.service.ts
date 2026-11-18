import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { User } from '../../generated/prisma/client';
export const safeUser = (user: User) => ({ id: user.id, email: user.emailOriginal ?? user.email, name: user.name, role: user.role, emailVerifiedAt: user.emailVerifiedAt, avatarUrl: user.avatarUrl });
export type SafeUser = ReturnType<typeof safeUser>;
@Injectable()
export class UsersService {
  constructor(private readonly db: PrismaService) {}
  byEmail(email: string) { return this.db.user.findUnique({ where: { email } }); }
}
