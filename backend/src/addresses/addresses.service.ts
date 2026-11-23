import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma.service';

type AddressInput = { fullName: string; phone: string; line1: string; line2?: string | null; city: string; state: string; pinCode: string; label?: 'Home' | 'Office' | 'Other' | null; isDefault?: boolean };
type Transaction = Prisma.TransactionClient;
const present = (row: { id: string; recipient: string; phone: string; line1: string; line2: string | null; city: string; state: string; pinCode: string; countryCode: string; label: string | null; isDefault: boolean }) => ({ id: row.id, fullName: row.recipient, phone: row.phone, line1: row.line1, line2: row.line2, city: row.city, state: row.state, pinCode: row.pinCode, countryCode: row.countryCode, label: row.label, isDefault: row.isDefault });
const data = (input: Partial<AddressInput>) => ({ recipient: input.fullName, phone: input.phone, line1: input.line1, line2: input.line2, city: input.city, state: input.state, pinCode: input.pinCode, label: input.label });

@Injectable()
export class AddressesService {
  constructor(private readonly db: PrismaService) {}

  private async customer(tx: Transaction, userId: string, create: boolean) {
    // Cart and address writers share this lock when linking a new commerce profile.
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${userId}), 146223)`;
    const user = await tx.user.findUnique({ where: { id: userId }, select: { customerId: true, name: true } });
    if (!user) throw new NotFoundException('Customer account not found.');
    if (user.customerId || !create) return user.customerId;
    const customer = await tx.customer.create({ data: { name: user.name }, select: { id: true } });
    await tx.user.update({ where: { id: userId }, data: { customerId: customer.id } });
    return customer.id;
  }

  async list(userId: string) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { customerId: true } });
    if (!user) throw new NotFoundException('Customer account not found.');
    if (!user.customerId) return [];
    const rows = await this.db.customerAddress.findMany({ where: { customerId: user.customerId }, orderBy: [{ isDefault: 'desc' }, { id: 'asc' }] });
    return rows.map(present);
  }

  async create(userId: string, input: AddressInput) {
    return this.db.$transaction(async tx => {
      const customerId = (await this.customer(tx, userId, true))!;
      const count = await tx.customerAddress.count({ where: { customerId } });
      const isDefault = count === 0 || input.isDefault === true;
      if (isDefault) await tx.customerAddress.updateMany({ where: { customerId, isDefault: true }, data: { isDefault: false } });
      return present(await tx.customerAddress.create({ data: { customerId, recipient: input.fullName, phone: input.phone, line1: input.line1, line2: input.line2 ?? null, city: input.city, state: input.state, pinCode: input.pinCode, label: input.label ?? null, isDefault } }));
    });
  }

  async update(userId: string, addressId: string, input: Partial<AddressInput>) {
    return this.db.$transaction(async tx => {
      const customerId = await this.customer(tx, userId, false);
      const existing = customerId ? await tx.customerAddress.findFirst({ where: { id: addressId, customerId } }) : null;
      if (!existing) throw new NotFoundException('Address not found.');
      if (input.isDefault === true) await tx.customerAddress.updateMany({ where: { customerId: customerId!, isDefault: true, id: { not: addressId } }, data: { isDefault: false } });
      const shouldPromote = existing.isDefault && input.isDefault === false;
      const replacement = shouldPromote ? await tx.customerAddress.findFirst({ where: { customerId: customerId!, id: { not: addressId } }, orderBy: { id: 'asc' } }) : null;
      const isDefault = input.isDefault === true ? true : shouldPromote && replacement ? false : existing.isDefault;
      const updated = await tx.customerAddress.update({ where: { id: addressId }, data: { ...data(input), isDefault } });
      if (replacement) await tx.customerAddress.update({ where: { id: replacement.id }, data: { isDefault: true } });
      return present(updated);
    });
  }

  async remove(userId: string, addressId: string) {
    return this.db.$transaction(async tx => {
      const customerId = await this.customer(tx, userId, false);
      const existing = customerId ? await tx.customerAddress.findFirst({ where: { id: addressId, customerId } }) : null;
      if (!existing) throw new NotFoundException('Address not found.');
      await tx.customerAddress.delete({ where: { id: addressId } });
      if (existing.isDefault) {
        const replacement = await tx.customerAddress.findFirst({ where: { customerId: customerId! }, orderBy: { id: 'asc' } });
        if (replacement) await tx.customerAddress.update({ where: { id: replacement.id }, data: { isDefault: true } });
      }
      return { deleted: true, id: addressId };
    });
  }
}
