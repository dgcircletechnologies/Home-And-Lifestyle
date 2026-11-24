import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, ShippingRule } from '../../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import { AdminPromotionsService } from '../promotions/admin-promotions.service';
import { evaluateShipping, type QuoteLine } from './shipping-quote';

const stale = () => new ConflictException({ code: 'SETTINGS_STALE', message: 'These settings changed since you opened them. Reload and review the latest values.' });
const invalid = (message: string) => new BadRequestException({ code: 'SHIPPING_RULE_INVALID', message });
const rangeValid = (min: number | null | undefined, max: number | null | undefined) => min == null || max == null || min <= max;
const overlap = (a: number | null, b: number | null, c: number | null, d: number | null) => (a ?? -Infinity) <= (d ?? Infinity) && (c ?? -Infinity) <= (b ?? Infinity);
const conditionsOverlap = (a: ShippingRule, b: ShippingRule) =>
  overlap(a.minWeightGrams, a.maxWeightGrams, b.minWeightGrams, b.maxWeightGrams) &&
  overlap(a.minLengthMm, a.maxLengthMm, b.minLengthMm, b.maxLengthMm) &&
  overlap(a.minWidthMm, a.maxWidthMm, b.minWidthMm, b.maxWidthMm) &&
  overlap(a.minHeightMm, a.maxHeightMm, b.minHeightMm, b.maxHeightMm);
const scope = (r: ShippingRule) => r.productId ? `product:${r.productId}:${r.pinCode ?? '*'}` : r.categoryId ? `category:${r.categoryId}:${r.pinCode ?? '*'}` : r.pinCode ? `pin:${r.pinCode}` : 'store';
const ruleFields = ['name', 'enabled', 'pinCode', 'productId', 'categoryId', 'minWeightGrams', 'maxWeightGrams', 'minLengthMm', 'maxLengthMm', 'minWidthMm', 'maxWidthMm', 'minHeightMm', 'maxHeightMm', 'baseChargePaise', 'fragileChargePaise', 'bulkyChargePaise', 'freeShippingThresholdPaise', 'shippingIncluded', 'freeShipping', 'dispatchMinDays', 'dispatchMaxDays', 'deliveryMinDays', 'deliveryMaxDays'] as const;
type EditableRule = Pick<ShippingRule, typeof ruleFields[number]>;
const editable = (rule: ShippingRule): EditableRule => Object.fromEntries(ruleFields.map(field => [field, rule[field]])) as EditableRule;

@Injectable()
export class AdminSettingsService {
  constructor(private readonly db: PrismaService, private readonly promotions: AdminPromotionsService) {}
  private async config() {
    return this.db.storeSettings.upsert({ where: { id: 'store' }, create: { id: 'store', storeName: process.env.STORE_NAME?.trim() || 'Home & Lifestyle' }, update: {} });
  }
  async store() { const c = await this.config(); return { storeName: c.storeName, supportEmail: c.supportEmail, supportPhone: c.supportPhone, publicAddress: c.publicAddress, businessHours: c.businessHours, version: c.storeVersion, market: 'India', currency: 'INR', language: 'English', timezone: 'Asia/Kolkata' }; }
  async publicConfig() { const c = await this.config(); return { storeName: c.storeName, supportEmail: c.supportEmail, supportPhone: c.supportPhone, publicAddress: c.publicAddress, businessHours: c.businessHours, market: 'India', currency: 'INR', language: 'English', timezone: 'Asia/Kolkata', gifting: { giftMessagesAvailable: c.giftMessagesAvailable, giftReceiptsAvailable: c.giftReceiptsAvailable, giftWrapFeePaise: c.giftWrapFeePaise } }; }
  async updateStore(input: { version: number; storeName: string; supportEmail: string | null; supportPhone: string | null; publicAddress: string | null; businessHours: string | null }) {
    await this.config();
    return this.db.$transaction(async tx => {
      const result = await tx.storeSettings.updateMany({ where: { id: 'store', storeVersion: input.version }, data: { storeName: input.storeName, supportEmail: input.supportEmail, supportPhone: input.supportPhone, publicAddress: input.publicAddress, businessHours: input.businessHours, storeVersion: { increment: 1 } } });
      if (!result.count) throw stale();
      const c = await tx.storeSettings.findUniqueOrThrow({ where: { id: 'store' } });
      return { storeName: c.storeName, supportEmail: c.supportEmail, supportPhone: c.supportPhone, publicAddress: c.publicAddress, businessHours: c.businessHours, version: c.storeVersion, market: 'India', currency: 'INR', language: 'English', timezone: 'Asia/Kolkata' };
    });
  }
  async gifting() { const c = await this.config(); return { giftWrapDefaultEligible: c.giftWrapDefaultEligible, giftMessagesAvailable: c.giftMessagesAvailable, giftReceiptsAvailable: c.giftReceiptsAvailable, giftWrapFeePaise: c.giftWrapFeePaise, version: c.giftingVersion, enquiryRouting: 'not configured' }; }
  async updateGifting(input: { version: number; giftWrapDefaultEligible: boolean; giftMessagesAvailable: boolean; giftReceiptsAvailable: boolean; giftWrapFeePaise: number }) {
    await this.config();
    return this.db.$transaction(async tx => {
      const result = await tx.storeSettings.updateMany({ where: { id: 'store', giftingVersion: input.version }, data: { giftWrapDefaultEligible: input.giftWrapDefaultEligible, giftMessagesAvailable: input.giftMessagesAvailable, giftReceiptsAvailable: input.giftReceiptsAvailable, giftWrapFeePaise: input.giftWrapFeePaise, giftingVersion: { increment: 1 } } });
      if (!result.count) throw stale();
      const c = await tx.storeSettings.findUniqueOrThrow({ where: { id: 'store' } });
      return { giftWrapDefaultEligible: c.giftWrapDefaultEligible, giftMessagesAvailable: c.giftMessagesAvailable, giftReceiptsAvailable: c.giftReceiptsAvailable, giftWrapFeePaise: c.giftWrapFeePaise, version: c.giftingVersion, enquiryRouting: 'not configured' };
    });
  }
  async shipping() { const c = await this.config(); return { version: c.shippingVersion, coveragePolicy: 'BLOCKLIST', thresholdBasis: c.thresholdBasis, waiveHandlingOnFree: c.waiveHandlingOnFree, currency: 'INR', weightUnit: 'grams', dimensionUnit: 'millimetres' }; }
  async updateShipping(input: { version: number; thresholdBasis: 'BEFORE_DISCOUNTS' | 'AFTER_DISCOUNTS'; waiveHandlingOnFree: boolean }) {
    await this.config();
    return this.db.$transaction(async tx => {
      const result = await tx.storeSettings.updateMany({ where: { id: 'store', shippingVersion: input.version }, data: { thresholdBasis: input.thresholdBasis, waiveHandlingOnFree: input.waiveHandlingOnFree, shippingVersion: { increment: 1 } } });
      if (!result.count) throw stale();
      return { version: input.version + 1, coveragePolicy: 'BLOCKLIST', thresholdBasis: input.thresholdBasis, waiveHandlingOnFree: input.waiveHandlingOnFree, currency: 'INR', weightUnit: 'grams', dimensionUnit: 'millimetres' };
    });
  }
  async pins(query: { search?: string; page: number }) {
    const where: Prisma.PinCodeServiceabilityWhereInput = { enabled: true, supported: false, ...(query.search ? { pinCode: { startsWith: query.search } } : {}) };
    const [total, items] = await this.db.$transaction([this.db.pinCodeServiceability.count({ where }), this.db.pinCodeServiceability.findMany({ where, orderBy: { pinCode: 'asc' }, skip: (query.page - 1) * 50, take: 50 })]);
    return { items, total, page: query.page, pageSize: 50 };
  }
  async blockPin(input: { version: number; pinCode: string; reason?: string | null }) {
    await this.config();
    return this.db.$transaction(async tx => {
      const existing = await tx.pinCodeServiceability.findUnique({ where: { pinCode: input.pinCode } });
      if (existing?.enabled && !existing.supported) throw new ConflictException({ code: 'PIN_ALREADY_BLOCKED', message: `PIN ${input.pinCode} is already blocked.` });
      const changed = await tx.storeSettings.updateMany({ where: { id: 'store', shippingVersion: input.version }, data: { shippingVersion: { increment: 1 } } });
      if (!changed.count) throw stale();
      await tx.pinCodeServiceability.upsert({ where: { pinCode: input.pinCode }, create: { pinCode: input.pinCode, supported: false, enabled: true, reason: input.reason ?? null }, update: { supported: false, enabled: true, reason: input.reason ?? null } });
      return { version: input.version + 1, pinCode: input.pinCode };
    });
  }
  async unblockPin(pinCode: string, version: number) {
    await this.config();
    return this.db.$transaction(async tx => {
      const blocked = await tx.pinCodeServiceability.findFirst({ where: { pinCode, enabled: true, supported: false } });
      if (!blocked) throw new NotFoundException('Blocked PIN not found.');
      const changed = await tx.storeSettings.updateMany({ where: { id: 'store', shippingVersion: version }, data: { shippingVersion: { increment: 1 } } });
      if (!changed.count) throw stale();
      await tx.pinCodeServiceability.update({ where: { pinCode }, data: { supported: true } });
      return { version: version + 1, pinCode };
    });
  }
  async rules(query: { search?: string; page: number }) {
    const where: Prisma.ShippingRuleWhereInput = query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {};
    const [total, items] = await this.db.$transaction([this.db.shippingRule.count({ where }), this.db.shippingRule.findMany({ where, orderBy: [{ enabled: 'desc' }, { name: 'asc' }, { id: 'asc' }], skip: (query.page - 1) * 50, take: 50, include: { product: { select: { name: true } }, category: { select: { name: true } } } })]);
    return { items, total, page: query.page, pageSize: 50 };
  }
  private async validateRule(rule: EditableRule, excludeId?: string) {
    if (rule.productId && rule.categoryId) throw invalid('Choose a product or a category, not both.');
    if (!rangeValid(rule.minWeightGrams, rule.maxWeightGrams) || !rangeValid(rule.minLengthMm, rule.maxLengthMm) || !rangeValid(rule.minWidthMm, rule.maxWidthMm) || !rangeValid(rule.minHeightMm, rule.maxHeightMm) || !rangeValid(rule.dispatchMinDays, rule.dispatchMaxDays) || !rangeValid(rule.deliveryMinDays, rule.deliveryMaxDays)) throw invalid('A minimum cannot exceed its maximum.');
    if (rule.freeShippingThresholdPaise !== null && (rule.productId || rule.categoryId || rule.pinCode || rule.minWeightGrams !== null || rule.maxWeightGrams !== null || rule.minLengthMm !== null || rule.maxLengthMm !== null || rule.minWidthMm !== null || rule.maxWidthMm !== null || rule.minHeightMm !== null || rule.maxHeightMm !== null)) throw invalid('Cart-wide free delivery threshold belongs on an unrestricted store-wide rule.');
    if (rule.productId && !await this.db.product.findUnique({ where: { id: rule.productId }, select: { id: true } })) throw invalid('Selected product no longer exists.');
    if (rule.categoryId && !await this.db.category.findUnique({ where: { id: rule.categoryId }, select: { id: true } })) throw invalid('Selected category no longer exists.');
    if (!rule.enabled) return;
    const others = await this.db.shippingRule.findMany({ where: { enabled: true, ...(excludeId ? { id: { not: excludeId } } : {}) } });
    for (const other of others) {
      if (scope(other) === scope(rule as ShippingRule) && conditionsOverlap(other, rule as ShippingRule)) throw invalid(`“${rule.name}” conflicts with enabled rule “${other.name}”. Narrow the conditions or disable one.`);
      if (rule.categoryId && other.categoryId && rule.categoryId !== other.categoryId && rule.pinCode === other.pinCode && conditionsOverlap(other, rule as ShippingRule)) {
        const shared = await this.db.product.findFirst({ where: { categories: { some: { categoryId: rule.categoryId } }, AND: [{ categories: { some: { categoryId: other.categoryId } } }] }, select: { id: true } });
        if (shared) throw invalid(`“${rule.name}” and “${other.name}” both apply to a product assigned to two categories.`);
      }
    }
  }
  async saveRule(input: { version: number; rule: EditableRule }, id?: string) {
    await this.config();
    const current = id ? await this.db.shippingRule.findUnique({ where: { id } }) : null;
    if (id && !current) throw new NotFoundException('Shipping rule not found.');
    const data = { ...(current ? editable(current) : {}), ...input.rule, state: null } as EditableRule & { state: null };
    await this.validateRule(data, id);
    return this.db.$transaction(async tx => {
      const changed = await tx.storeSettings.updateMany({ where: { id: 'store', shippingVersion: input.version }, data: { shippingVersion: { increment: 1 } } });
      if (!changed.count) throw stale();
      const rule = id ? await tx.shippingRule.update({ where: { id }, data }) : await tx.shippingRule.create({ data });
      return { rule, version: input.version + 1 };
    });
  }
  async removeRule(id: string, version: number) {
    await this.config();
    return this.db.$transaction(async tx => {
      const changed = await tx.storeSettings.updateMany({ where: { id: 'store', shippingVersion: version }, data: { shippingVersion: { increment: 1 } } });
      if (!changed.count) throw stale();
      const removed = await tx.shippingRule.deleteMany({ where: { id } });
      if (!removed.count) throw new NotFoundException('Shipping rule not found.');
      return { version: version + 1 };
    });
  }
  async quote(input: { pinCode: string; items: { productId: string; variantId: string; quantity: number }[]; code?: string }) {
    const [c, coverage, rules, variants, merchandise] = await Promise.all([
      this.config(), this.db.pinCodeServiceability.findUnique({ where: { pinCode: input.pinCode } }), this.db.shippingRule.findMany({ where: { enabled: true } }),
      this.db.productVariant.findMany({ where: { id: { in: input.items.map(item => item.variantId) } }, select: { id: true, productId: true, packedWeightGrams: true, packedLengthMm: true, packedWidthMm: true, packedHeightMm: true, isFragile: true, isBulky: true, product: { select: { name: true, status: true, categories: { select: { categoryId: true } } } } } }),
      this.promotions.quote({ items: input.items, code: input.code }),
    ]);
    const lines: QuoteLine[] = input.items.map(item => {
      const v = variants.find(row => row.id === item.variantId && row.productId === item.productId);
      if (!v || v.product.status === 'ARCHIVED') throw invalid('Select an available product variant.');
      return { productId: v.productId, variantId: v.id, name: v.product.name, quantity: item.quantity, categoryIds: v.product.categories.map(link => link.categoryId), weightGrams: v.packedWeightGrams, lengthMm: v.packedLengthMm, widthMm: v.packedWidthMm, heightMm: v.packedHeightMm, isFragile: v.isFragile, isBulky: v.isBulky };
    });
    return evaluateShipping({ pinCode: input.pinCode, coverage, rules, lines, merchandise, policy: c });
  }
}
