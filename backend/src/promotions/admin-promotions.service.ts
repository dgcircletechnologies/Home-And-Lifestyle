/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PromotionMailService } from './promotion-mail.service';

const bad = (message: string) => new BadRequestException({ code: 'PROMOTION_INVALID', message });
const scopeIds = (rule: any) => [...(rule.productIds ?? rule.products?.map((link: any) => link.productId) ?? []), ...(rule.categoryIds ?? rule.categories?.map((link: any) => link.categoryId) ?? []), ...(rule.collectionIds ?? rule.collections?.map((link: any) => link.collectionId) ?? [])];
const saving = (kind: string, amount: number | null | undefined, percent: number | null | undefined, price: number) => Math.min(price, kind === 'FIXED' ? amount ?? 0 : Math.floor((price * (percent ?? 0) + 5000) / 10000));
const state = (rule: any, now: Date, endField: 'endsAt' | 'expiresAt') => rule.lifecycle === 'ENDED' ? 'ENDED' : rule.lifecycle === 'DRAFT' ? 'DRAFT' : rule.lifecycle === 'PAUSED' || !rule.enabled ? 'PAUSED' : rule[endField] && new Date(rule[endField]) <= now ? 'EXPIRED' : rule.startsAt && new Date(rule.startsAt) > now ? 'SCHEDULED' : rule.usageLimit !== null && rule.usageLimit !== undefined && rule._count?.redemptions >= rule.usageLimit ? 'USAGE_LIMIT_REACHED' : 'ACTIVE';
const normalize = (code: string) => code.trim().toUpperCase();
@Injectable()
export class AdminPromotionsService {
  constructor(
    private readonly db: PrismaService,
    private readonly mailService: PromotionMailService,
  ) {}
  async verifiedCustomersCount() {
    const count = await this.mailService.countVerifiedCustomers();
    return { count };
  }
  async share(id: string) {
    const promotion = await this.db.promotion.findUnique({ where: { id } });
    if (!promotion) throw new NotFoundException({ code: 'PROMOTION_NOT_FOUND', message: 'Offer not found.' });
    if (!promotion.productId && !promotion.categoryId) {
      throw bad('Only Category and Product discounts can be shared via email.');
    }
    const effectiveStatus = state(promotion, new Date(), 'endsAt');
    if (effectiveStatus !== 'ACTIVE' && effectiveStatus !== 'SCHEDULED') {
      throw bad(`Cannot share an offer with status ${effectiveStatus}. It must be active or scheduled.`);
    }
    const count = await this.mailService.countVerifiedCustomers();
    void this.mailService.sendPromotionCampaign(id).catch(() => undefined);
    return { targetedCount: count, queued: true };
  }
  private async check(input: any) {
    if ((input.kind === 'FIXED') === (input.amountPaise == null) || (input.kind === 'PERCENTAGE') === (input.percentBasisPoints == null)) throw bad('Set exactly one discount amount matching the selected kind.');
    if (input.startsAt && (input.endsAt || input.expiresAt) && new Date(input.startsAt) >= new Date(input.endsAt ?? input.expiresAt)) throw bad('The end must be after the start.');
    if (input.type === 'AUTOMATIC' && Boolean(input.productId) === Boolean(input.categoryId)) throw bad('Choose one product or category.');
    if (input.type === 'COUPON' && input.scope === 'SELECTED' && !scopeIds(input).length) throw bad('Select at least one eligible product, category, or collection.');
    if (input.productId && !await this.db.product.count({ where: { id: input.productId, status: { not: 'ARCHIVED' } } })) throw bad('Selected product is unavailable.');
    if (input.categoryId && !await this.db.category.count({ where: { id: input.categoryId, deletedAt: null } })) throw bad('Selected category is unavailable.');
    if (input.type === 'COUPON') {
      for (const [model, key, field] of [['product', 'productIds', 'id'], ['category', 'categoryIds', 'id'], ['collection', 'collectionIds', 'id']] as const) {
        const ids = input[key] ?? []; if (!ids.length) continue;
        const count = model === 'product' ? await this.db.product.count({ where: { id: { in: ids } } }) : model === 'category' ? await this.db.category.count({ where: { id: { in: ids }, deletedAt: null } }) : await this.db.collection.count({ where: { id: { in: ids } } });
        if (count !== new Set(ids).size) throw bad(`One or more selected ${field === 'id' ? model : field} records are unavailable.`);
      }
    }
  }
  private async rows() { const [automatic, coupons] = await Promise.all([this.db.promotion.findMany({ include: { product: { select: { name: true } }, category: { select: { name: true } } } }), this.db.coupon.findMany({ include: { products: true, categories: true, collections: true, _count: { select: { redemptions: true } } } })]); return [...automatic.map(rule => ({ ...rule, type: 'AUTOMATIC' as const, effectiveStatus: state(rule, new Date(), 'endsAt') })), ...coupons.map(rule => ({ ...rule, type: 'COUPON' as const, effectiveStatus: state(rule, new Date(), 'expiresAt') }))]; }
  async list(query: { page: number; pageSize: number; search?: string; type?: string; status?: string }) { const rows = (await this.rows()).filter(rule => (!query.type || rule.type === query.type) && (!query.status || rule.effectiveStatus === query.status) && (!query.search || [rule.name, 'code' in rule ? rule.code : ''].some(text => text.toLowerCase().includes(query.search!.toLowerCase())))).sort((a, b) => b.id.localeCompare(a.id)); return { items: rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: rows.length, page: query.page, pageSize: query.pageSize }; }
  async detail(type: 'automatic' | 'coupon', id: string) { const row = type === 'automatic' ? await this.db.promotion.findUnique({ where: { id }, include: { product: { select: { id: true, name: true, slug: true } }, category: { select: { id: true, name: true, slug: true } } } }) : await this.db.coupon.findUnique({ where: { id }, include: { products: true, categories: true, collections: true, _count: { select: { redemptions: true } } } }); if (!row) throw new NotFoundException({ code: 'PROMOTION_NOT_FOUND', message: 'Offer not found.' }); return { ...row, type: type.toUpperCase(), effectiveStatus: state(row, new Date(), type === 'automatic' ? 'endsAt' : 'expiresAt') }; }
  async options(query: { type: 'product' | 'category' | 'collection'; search?: string; page: number }) { const where = { ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}) }; const page = { skip: (query.page - 1) * 30, take: 30, orderBy: [{ name: 'asc' as const }, { id: 'asc' as const }] }; if (query.type === 'product') return this.db.product.findMany({ where: { ...where, status: { not: 'ARCHIVED' } }, select: { id: true, name: true, status: true, variants: { select: { id: true, sku: true, pricePaise: true } } }, ...page }); if (query.type === 'category') return this.db.category.findMany({ where: { ...where, deletedAt: null }, select: { id: true, name: true, parent: { select: { name: true } } }, ...page }); return this.db.collection.findMany({ where, select: { id: true, name: true }, ...page }); }
  async create(input: any) {
    await this.check(input);
    try {
      if (input.type === 'AUTOMATIC') {
        const lifecycle = input.lifecycle ?? 'DRAFT';
        const created = await this.db.promotion.create({
          data: {
            name: input.name,
            kind: input.kind,
            amountPaise: input.amountPaise,
            percentBasisPoints: input.percentBasisPoints,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            productId: input.productId,
            categoryId: input.categoryId,
            lifecycle,
            enabled: lifecycle === 'PUBLISHED',
          },
        });
        if (input.shareWithVerifiedCustomers && (input.productId || input.categoryId) && lifecycle === 'PUBLISHED') {
          void this.mailService.sendPromotionCampaign(created.id).catch(() => undefined);
        }
        return created;
      }
      return this.db.coupon.create({ data: { name: input.name, code: normalize(input.code), scope: input.scope, kind: input.kind, amountPaise: input.amountPaise, percentBasisPoints: input.percentBasisPoints, startsAt: input.startsAt, expiresAt: input.expiresAt, minimumCartPaise: input.minimumCartPaise, usageLimit: input.usageLimit, perCustomerLimit: input.perCustomerLimit, allowStacking: input.allowStacking, lifecycle: 'DRAFT', products: { create: (input.productIds ?? []).map((productId: string) => ({ productId })) }, categories: { create: (input.categoryIds ?? []).map((categoryId: string) => ({ categoryId })) }, collections: { create: (input.collectionIds ?? []).map((collectionId: string) => ({ collectionId })) } } });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException({ code: 'COUPON_CODE_EXISTS', message: 'This coupon code is already used.' });
      throw error;
    }
  }
  async update(type: 'automatic' | 'coupon', id: string, input: any) { const old: any = await this.detail(type, id); const merged = { ...old, ...input, type: type === 'automatic' ? 'AUTOMATIC' : 'COUPON' }; await this.check(merged); try { if (type === 'automatic') { const { name, kind, amountPaise, percentBasisPoints, startsAt, endsAt, productId, categoryId } = input; return this.db.promotion.update({ where: { id }, data: { name, kind, amountPaise, percentBasisPoints, startsAt, endsAt, productId, categoryId } }); } const { name, code, kind, amountPaise, percentBasisPoints, startsAt, expiresAt, minimumCartPaise, usageLimit, perCustomerLimit, allowStacking, scope } = input; return this.db.coupon.update({ where: { id }, data: { name, code: code === undefined ? undefined : normalize(code), kind, amountPaise, percentBasisPoints, startsAt, expiresAt, minimumCartPaise, usageLimit, perCustomerLimit, allowStacking, scope, ...(input.productIds !== undefined ? { products: { deleteMany: {}, create: input.productIds.map((productId: string) => ({ productId })) } } : {}), ...(input.categoryIds !== undefined ? { categories: { deleteMany: {}, create: input.categoryIds.map((categoryId: string) => ({ categoryId })) } } : {}), ...(input.collectionIds !== undefined ? { collections: { deleteMany: {}, create: input.collectionIds.map((collectionId: string) => ({ collectionId })) } } : {}) } }); } catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException({ code: 'COUPON_CODE_EXISTS', message: 'This coupon code is already used.' }); throw error; } }
  async lifecycle(type: 'automatic' | 'coupon', id: string, action: 'publish' | 'pause' | 'resume' | 'end') { const old: any = await this.detail(type, id); if (action === 'resume' && old.lifecycle === 'ENDED') throw bad('An ended offer cannot be resumed.'); const data = action === 'end' ? { lifecycle: 'ENDED', enabled: false } : action === 'pause' ? { lifecycle: 'PAUSED', enabled: false } : { lifecycle: 'PUBLISHED', enabled: true }; return type === 'automatic' ? this.db.promotion.update({ where: { id }, data }) : this.db.coupon.update({ where: { id }, data }); }
  async quote(input: any) {
    const at = input.at ? new Date(input.at) : new Date();
    if (input.offer) await this.check(input.offer);
    const ids = input.items.map((item: any) => item.variantId);
    if (new Set(ids).size !== ids.length) throw bad('Each variant can appear only once in a quote.');
    const variants = await this.db.productVariant.findMany({ where: { id: { in: ids }, product: { status: 'PUBLISHED' } }, include: { product: { include: { categories: true, collections: true } } } });
    if (variants.length !== ids.length) throw bad('One or more sellable variants were not found.');
    const categories = await this.db.category.findMany({ select: { id: true, parentId: true } }); const parents = new Map(categories.map(category => [category.id, category.parentId]));
    const matchesCategory = (product: any, categoryId: string) => product.categories.some((entry: any) => { let next: string | null | undefined = entry.categoryId; while (next) { if (next === categoryId) return true; next = parents.get(next); } return false; });
    const automatic = await this.db.promotion.findMany({ where: { lifecycle: { not: 'ENDED' } }, orderBy: { id: 'asc' } });
    const coupon = input.code ? await this.db.coupon.findFirst({ where: { code: { equals: normalize(input.code), mode: 'insensitive' } }, include: { products: true, categories: true, collections: true, _count: { select: { redemptions: true } } } }) : null;
    const draft: any = input.offer ? { ...input.offer, id: 'draft-preview', enabled: true, lifecycle: 'PUBLISHED', products: (input.offer.productIds ?? []).map((productId: string) => ({ productId })), categories: (input.offer.categoryIds ?? []).map((categoryId: string) => ({ categoryId })), collections: (input.offer.collectionIds ?? []).map((collectionId: string) => ({ collectionId })) } : null;
    const autoRules = [...automatic, ...(draft?.type === 'AUTOMATIC' ? [draft] : [])].filter(rule => state(rule, at, 'endsAt') === 'ACTIVE');
    const selectedCoupon: any = draft?.type === 'COUPON' && (!input.code || normalize(input.code) === normalize(draft.code)) ? draft : coupon;
    const lineRows: { productId: string; variantId: string; quantity: number; unitPricePaise: number; originalPaise: number; automaticPaise: number; automaticOfferId: string | null; couponPaise: number; lineTotalPaise: number; product: any }[] = input.items.map((item: any) => { const variant = variants.find(row => row.id === item.variantId)!; if (variant.productId !== item.productId) throw bad('Variant does not belong to the selected product.'); const base = variant.pricePaise * item.quantity; const wins = autoRules.filter(rule => rule.productId === item.productId || rule.categoryId && matchesCategory(variant.product, rule.categoryId)).map(rule => ({ id: rule.id, saving: saving(rule.kind, rule.amountPaise, rule.percentBasisPoints, variant.pricePaise) * item.quantity })).sort((a, b) => b.saving - a.saving || a.id.localeCompare(b.id)); return { productId: item.productId, variantId: item.variantId, quantity: item.quantity, unitPricePaise: variant.pricePaise, originalPaise: base, automaticPaise: wins[0]?.saving ?? 0, automaticOfferId: wins[0]?.id ?? null, couponPaise: 0, lineTotalPaise: base - (wins[0]?.saving ?? 0), product: variant.product }; });
    const originalPaise = lineRows.reduce((sum, row) => sum + row.originalPaise, 0); const afterAutomatic = lineRows.reduce((sum, row) => sum + row.lineTotalPaise, 0);
    let couponOutcome = 'No coupon supplied.'; let couponTotal = 0; let couponEligibleRows: typeof lineRows = [];
    if (selectedCoupon) { const perCustomerUses = input.customerId && selectedCoupon.id !== 'draft-preview' ? await this.db.couponRedemption.count({ where: { couponId: selectedCoupon.id, customerId: input.customerId } }) : 0; const availability = state(selectedCoupon, at, 'expiresAt'); if (availability !== 'ACTIVE') couponOutcome = `Coupon is ${availability.toLowerCase().replaceAll('_', ' ')}.`; else if (selectedCoupon.perCustomerLimit != null && input.customerId && perCustomerUses >= selectedCoupon.perCustomerLimit) couponOutcome = 'Per-customer usage limit reached.'; else if (selectedCoupon.minimumCartPaise != null && afterAutomatic < selectedCoupon.minimumCartPaise) couponOutcome = `Add ${(selectedCoupon.minimumCartPaise - afterAutomatic) / 100} INR of merchandise to meet the minimum.`; else { const eligible = lineRows.filter(row => selectedCoupon.scope === 'CART' || selectedCoupon.products.some((link: any) => link.productId === row.productId) || selectedCoupon.categories.some((link: any) => matchesCategory(row.product, link.categoryId)) || selectedCoupon.collections.some((link: any) => row.product.collections.some((entry: any) => entry.collectionId === link.collectionId))).sort((a, b) => a.variantId.localeCompare(b.variantId)); couponEligibleRows = eligible; const basis = eligible.reduce((sum, row) => sum + row.lineTotalPaise, 0); couponTotal = Math.min(basis, selectedCoupon.kind === 'FIXED' ? selectedCoupon.amountPaise ?? 0 : saving('PERCENTAGE', null, selectedCoupon.percentBasisPoints, basis)); let remaining = couponTotal; if (basis > 0) eligible.forEach((row, index) => { const allocated = index === eligible.length - 1 ? remaining : Math.floor(couponTotal * row.lineTotalPaise / basis); row.couponPaise = allocated; remaining -= allocated; }); couponOutcome = eligible.length ? 'Coupon applied.' : 'No eligible items.'; } } else if (input.code) couponOutcome = 'Coupon code not found.';
    if (selectedCoupon && couponTotal > 0 && !selectedCoupon.allowStacking) {
      const basis = couponEligibleRows.reduce((sum, row) => sum + row.originalPaise, 0);
      const exclusiveSaving = Math.min(basis, selectedCoupon.kind === 'FIXED' ? selectedCoupon.amountPaise ?? 0 : saving('PERCENTAGE', null, selectedCoupon.percentBasisPoints, basis));
      if (exclusiveSaving <= originalPaise - afterAutomatic) { lineRows.forEach(row => { row.couponPaise = 0; }); couponOutcome = 'Automatic offers save more; exclusive coupon omitted.'; couponTotal = 0; }
      else { lineRows.forEach(row => { row.automaticPaise = 0; row.automaticOfferId = null; row.couponPaise = 0; }); let remainder = exclusiveSaving; couponEligibleRows.forEach((row, index) => { const share = index === couponEligibleRows.length - 1 ? remainder : Math.floor(exclusiveSaving * row.originalPaise / basis); row.couponPaise = share; remainder -= share; }); couponTotal = exclusiveSaving; couponOutcome = 'Exclusive coupon saves more than automatic offers.'; }
    }
    const lines = lineRows.map(row => ({ productId: row.productId, variantId: row.variantId, quantity: row.quantity, unitPricePaise: row.unitPricePaise, originalPaise: row.originalPaise, automaticPaise: row.automaticPaise, automaticOfferId: row.automaticOfferId, couponPaise: row.couponPaise, lineTotalPaise: row.originalPaise - row.automaticPaise - row.couponPaise })); const automaticPaise = lines.reduce((sum, row) => sum + row.automaticPaise, 0);
    return { currency: 'INR', pricingBasis: 'ProductVariant.pricePaise; compareAtPricePaise is display only', lines, originalMerchandisePaise: originalPaise, automaticPaise, couponPaise: couponTotal, merchandisePaise: originalPaise - automaticPaise - couponTotal, couponOutcome, note: 'Merchandise only; shipping and tax are not included. Preview does not redeem offers.' };
  }
}
