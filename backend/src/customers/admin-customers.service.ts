import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { canonicalEmail } from '../auth/contracts';

const missing = () => new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found.' });
const safe = (user: { id: string; name: string; email: string; emailOriginal: string | null; avatarUrl: string | null; emailVerifiedAt: Date | null; disabledAt: Date | null; deletedAt: Date | null; createdAt: Date; updatedAt: Date; customer: { id: string; phone: string | null } | null }) => ({ id: user.id, customerId: user.customer?.id ?? null, name: user.name, email: user.emailOriginal ?? user.email, avatarUrl: user.avatarUrl, phone: user.customer?.phone ?? null, verifiedAt: user.emailVerifiedAt, disabledAt: user.disabledAt, deletedAt: user.deletedAt, createdAt: user.createdAt, updatedAt: user.updatedAt });
@Injectable()
export class AdminCustomersService {
  constructor(private readonly db: PrismaService) {}
  private async customer(id: string) {
    const user = await this.db.user.findFirst({ where: { id, role: 'CUSTOMER' }, include: { customer: true } });
    if (!user) throw missing(); return user;
  }
  async list(query: { page: number; pageSize: number; search?: string; state?: string; sort?: string }) {
    const where: { role: 'CUSTOMER'; deletedAt?: null | { not: null }; disabledAt?: null; OR?: object[] } = { role: 'CUSTOMER' };
    if (query.state === 'deleted') where.deletedAt = { not: null }; else where.deletedAt = null;
    if (query.state === 'active') where.disabledAt = null;
    if (query.state === 'blocked') where.disabledAt = { not: null } as never;
    if (query.state === 'unverified') where.OR = [{ emailVerifiedAt: null }];
    if (query.search) { const value = query.search; where.OR = [{ name: { contains: value, mode: 'insensitive' } }, { email: { contains: canonicalEmail(value), mode: 'insensitive' } }, { customer: { is: { phone: { contains: value } } } }]; }
    const orderBy = query.sort === 'name' ? [{ name: 'asc' as const }, { id: 'asc' as const }] : [{ createdAt: 'desc' as const }, { id: 'desc' as const }];
    const [total, users] = await this.db.$transaction([this.db.user.count({ where }), this.db.user.findMany({ where, include: { customer: true }, orderBy, skip: (query.page - 1) * query.pageSize, take: query.pageSize })]);
    return { items: users.map(safe), page: query.page, pageSize: query.pageSize, total };
  }
  async detail(id: string) {
    const user = await this.db.user.findFirst({ where: { id, role: 'CUSTOMER' }, include: { customer: { include: { addresses: { orderBy: { id: 'asc' } }, orders: { orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, orderNumber: true, status: true, currency: true, totalPaise: true, createdAt: true } }, reviews: { select: { id: true, rating: true, moderationStatus: true, createdAt: true } } } } } });
    if (!user) throw missing(); return { ...safe(user), addresses: user.customer?.addresses ?? [], orders: user.customer?.orders ?? [], reviews: user.customer?.reviews ?? [] };
  }
  async update(id: string, input: { name?: string; phone?: string | null }) {
    const user = await this.customer(id); if (user.deletedAt) throw new BadRequestException({ code: 'CUSTOMER_DELETED', message: 'Restore this customer before editing.' });
    return this.db.$transaction(async tx => {
      const next = await tx.user.update({ where: { id }, data: { ...(input.name !== undefined ? { name: input.name } : {}), ...(input.phone !== undefined ? { customer: user.customer ? { update: { phone: input.phone } } : { create: { name: input.name ?? user.name, email: user.email, phone: input.phone } } } : {}) }, include: { customer: true } });
      return safe(next);
    });
  }
  async status(id: string, disabled: boolean) { await this.customer(id); const now = new Date(); return this.db.$transaction(async tx => { const user = await tx.user.update({ where: { id }, data: { disabledAt: disabled ? now : null }, include: { customer: true } }); if (disabled) await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: now } }); return safe(user); }); }
  async remove(id: string) { await this.customer(id); const now = new Date(); return this.db.$transaction(async tx => { const user = await tx.user.update({ where: { id }, data: { deletedAt: now }, include: { customer: true } }); await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: now } }); return safe(user); }); }
  async restore(id: string) { await this.customer(id); const user = await this.db.user.update({ where: { id }, data: { deletedAt: null }, include: { customer: true } }); return safe(user); }
  async addresses(id: string) { const user = await this.customer(id); return user.customer ? this.db.customerAddress.findMany({ where: { customerId: user.customer.id }, orderBy: { id: 'asc' } }) : []; }
  async addAddress(id: string, input: { recipient: string; phone: string; line1: string; line2?: string; city: string; state: string; pinCode: string; countryCode?: string }) { const user = await this.customer(id); if (user.deletedAt) throw new BadRequestException({ code: 'CUSTOMER_DELETED', message: 'Restore this customer before editing.' }); const customer = user.customer ?? await this.db.customer.create({ data: { name: user.name, email: user.email } }); return this.db.customerAddress.create({ data: { customerId: customer.id, ...input, countryCode: input.countryCode ?? 'IN' } }); }
  async updateAddress(id: string, addressId: string, input: Partial<{ recipient: string; phone: string; line1: string; line2: string | null; city: string; state: string; pinCode: string; countryCode: string }>) { const user = await this.customer(id); if (!user.customer || user.deletedAt) throw missing(); const address = await this.db.customerAddress.findFirst({ where: { id: addressId, customerId: user.customer.id } }); if (!address) throw missing(); return this.db.customerAddress.update({ where: { id: addressId }, data: input }); }
}
