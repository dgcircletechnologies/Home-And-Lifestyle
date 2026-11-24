import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { categoryVisibility } from '../categories/category-visibility';
import { PrismaService } from '../prisma.service';
import { activeAutomaticPromotionWhere } from '../promotions/public-promotion';
import { giftSelection, type GiftSelection } from './gift-options';

type InputItem = { variantId: string; quantity: number; itemId?: string; giftWrapSelected?: boolean; giftMessage?: string | null };
type Transaction = Prisma.TransactionClient;
const error = (message: string) => new BadRequestException({ code: 'CART_INVALID', message });
const saving = (rule: { kind: string; amountPaise: number | null; percentBasisPoints: number | null }, price: number) => Math.min(price, rule.kind === 'FIXED' ? rule.amountPaise ?? 0 : Math.floor((price * (rule.percentBasisPoints ?? 0) + 5000) / 10000));

@Injectable()
export class CartService {
  constructor(private readonly db: PrismaService) {}

  private async accountCart(tx: Transaction, userId: string, create: boolean) {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${userId}), 146223)`;
    const user = await tx.user.findUnique({ where: { id: userId }, select: { customerId: true, name: true } });
    if (!user) throw new NotFoundException('Customer account not found.');
    let customerId = user.customerId;
    if (!customerId && create) {
      customerId = (await tx.customer.create({ data: { name: user.name }, select: { id: true } })).id;
      await tx.user.update({ where: { id: userId }, data: { customerId } });
    }
    if (!customerId) return { cartId: null, customerId: null };
    let cart = await tx.cart.findFirst({ where: { customerId }, orderBy: { createdAt: 'asc' }, select: { id: true } });
    if (!cart && create) cart = await tx.cart.create({ data: { customerId }, select: { id: true } });
    return { cartId: cart?.id ?? null, customerId };
  }

  private async accountItems(userId: string) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { customerId: true } });
    if (!user?.customerId) return { items: [] as InputItem[], customerId: null };
    const cart = await this.db.cart.findFirst({ where: { customerId: user.customerId }, orderBy: { createdAt: 'asc' }, include: { lines: { orderBy: { id: 'asc' } } } });
    return { items: cart?.lines.map(line => ({ itemId: line.id, variantId: line.variantId, quantity: line.quantity, ...giftSelection(line.giftOptions) })) ?? [], customerId: user.customerId };
  }

  async get(userId: string, couponCode?: string, selections?: { variantId: string; giftWrapSelected: boolean; giftMessage: string | null }[]) {
    const account = await this.accountItems(userId);
    if (selections && (new Set(selections.map(row => row.variantId)).size !== selections.length || selections.some(row => !account.items.some(item => item.variantId === row.variantId)))) throw error('Gift options do not match the current cart.');
    const overrides = new Map(selections?.map(row => [row.variantId, row]));
    return this.preview(account.items.map(item => ({ ...item, ...overrides.get(item.variantId) })), couponCode, account.customerId);
  }

  async setGift(userId: string, itemId: string, selection: GiftSelection) {
    await this.db.$transaction(async tx => {
      const { cartId } = await this.accountCart(tx, userId, false);
      const line = cartId ? await tx.cartLine.findFirst({ where: { id: itemId, cartId }, include: { variant: { include: { product: true } } } }) : null;
      if (!line) throw new NotFoundException('Cart item not found.');
      if (selection.giftWrapSelected && !line.variant.product.giftWrapEligible) throw error('Gift wrapping is unavailable for this piece.');
      const settings = await tx.storeSettings.findUnique({ where: { id: 'store' } });
      if (selection.giftMessage && (!selection.giftWrapSelected || !settings?.giftMessagesAvailable)) throw error('Gift messages are unavailable for this piece.');
      await tx.cartLine.update({ where: { id: itemId }, data: { giftOptions: selection.giftWrapSelected ? { giftWrapSelected: true, giftMessage: selection.giftMessage } : { giftWrapSelected: false, giftMessage: null } } });
    });
    return this.get(userId);
  }

  async add(userId: string, input: InputItem) {
    const [variant, tree] = await Promise.all([this.db.productVariant.findUnique({ where: { id: input.variantId }, include: { product: { include: { categories: true } } } }), categoryVisibility(this.db)]);
    if (!variant || variant.product.status !== 'PUBLISHED' || !variant.product.categories.some(link => tree.isActive(link.categoryId))) throw error('This piece is no longer available.');
    await this.db.$transaction(async tx => {
      const { cartId } = await this.accountCart(tx, userId, true);
      const live = await tx.productVariant.findUnique({ where: { id: input.variantId }, select: { stockQuantity: true, sku: true, product: { select: { status: true } } } });
      if (!live || live.product.status !== 'PUBLISHED') throw error('This piece is no longer available.');
      const lines = await tx.cartLine.findMany({ where: { cartId: cartId!, variantId: input.variantId }, orderBy: { id: 'asc' } });
      const total = lines.reduce((sum, line) => sum + line.quantity, input.quantity);
      if (total > live.stockQuantity) throw error(`Only ${live.stockQuantity} of ${live.sku} available. You already have ${total - input.quantity} in your cart.`);
      if (lines[0]) { await tx.cartLine.update({ where: { id: lines[0].id }, data: { quantity: total } }); if (lines.length > 1) await tx.cartLine.deleteMany({ where: { id: { in: lines.slice(1).map(line => line.id) } } }); }
      else await tx.cartLine.create({ data: { cartId: cartId!, variantId: input.variantId, quantity: input.quantity } });
    });
    return this.get(userId);
  }

  async update(userId: string, itemId: string, quantity: number) {
    await this.db.$transaction(async tx => {
      const { cartId } = await this.accountCart(tx, userId, false);
      const line = cartId ? await tx.cartLine.findFirst({ where: { id: itemId, cartId }, include: { variant: true } }) : null;
      if (!line) throw new NotFoundException('Cart item not found.');
      if (quantity > line.variant.stockQuantity) throw error(`Only ${line.variant.stockQuantity} of ${line.variant.sku} available.`);
      await tx.cartLine.update({ where: { id: itemId }, data: { quantity } });
    });
    return this.get(userId);
  }

  async remove(userId: string, itemId: string) {
    await this.db.$transaction(async tx => {
      const { cartId } = await this.accountCart(tx, userId, false);
      const result = cartId ? await tx.cartLine.deleteMany({ where: { id: itemId, cartId } }) : { count: 0 };
      if (!result.count) throw new NotFoundException('Cart item not found.');
    });
    return this.get(userId);
  }

  async merge(userId: string, items: InputItem[]) {
    const notes: string[] = [];
    await this.db.$transaction(async tx => {
      const { cartId } = await this.accountCart(tx, userId, true);
      const grouped = new Map<string, number>();
      const guestGift = new Map<string, GiftSelection>();
      for (const item of items) { grouped.set(item.variantId, (grouped.get(item.variantId) ?? 0) + item.quantity); if (item.giftWrapSelected) guestGift.set(item.variantId, giftSelection(item)); }
      const settings = await tx.storeSettings.findUnique({ where: { id: 'store' } });
      const variants = await tx.productVariant.findMany({ where: { id: { in: [...grouped.keys()] } }, include: { product: { include: { categories: true } } } });
      const tree = await categoryVisibility(this.db);
      const known = new Map(variants.map(variant => [variant.id, variant]));
      for (const [variantId, quantity] of grouped) {
        const variant = known.get(variantId);
        if (!variant || variant.product.status !== 'PUBLISHED' || !variant.product.categories.some(link => tree.isActive(link.categoryId)) || variant.stockQuantity <= 0) { notes.push('A guest item was unavailable and could not be merged.'); continue; }
        const lines = await tx.cartLine.findMany({ where: { cartId: cartId!, variantId }, orderBy: { id: 'asc' } });
        const current = lines.reduce((sum, line) => sum + line.quantity, 0);
        const next = Math.min(variant.stockQuantity, current + quantity);
        if (next < current + quantity) notes.push(`${variant.sku} was capped at ${variant.stockQuantity} available.`);
        const selected = guestGift.get(variantId);
        const giftOptions = selected && variant.product.giftWrapEligible ? { giftWrapSelected: true, giftMessage: settings?.giftMessagesAvailable ? selected.giftMessage : null } : undefined;
        if (lines[0]) { await tx.cartLine.update({ where: { id: lines[0].id }, data: { quantity: next, ...(giftOptions && !giftSelection(lines[0].giftOptions).giftWrapSelected ? { giftOptions } : {}) } }); if (lines.length > 1) await tx.cartLine.deleteMany({ where: { id: { in: lines.slice(1).map(line => line.id) } } }); }
        else await tx.cartLine.create({ data: { cartId: cartId!, variantId, quantity: next, giftOptions } });
      }
    });
    return { ...await this.get(userId), notes };
  }

  async preview(items: InputItem[], couponCode?: string, customerId?: string | null) {
    const ids = [...new Set(items.map(item => item.variantId))];
    const now = new Date();
    const [variants, promotions, tree, settings] = await Promise.all([
      this.db.productVariant.findMany({ where: { id: { in: ids } }, include: { product: { include: { images: { orderBy: [{ position: 'asc' }, { id: 'asc' }], take: 1 }, categories: true, collections: true } }, images: { orderBy: [{ position: 'asc' }, { id: 'asc' }], take: 1 } } }),
      this.db.promotion.findMany({ where: activeAutomaticPromotionWhere(now) }),
      categoryVisibility(this.db),
      this.db.storeSettings.findUnique({ where: { id: 'store' }, select: { giftWrapFeePaise: true, giftMessagesAvailable: true } }),
    ]);
    const byId = new Map(variants.map(variant => [variant.id, variant]));
    const parents = new Map(tree.categories.map(category => [category.id, category.parentId]));
    const matchesCategory = (categoryIds: string[], target: string) => categoryIds.some(id => { let current: string | null | undefined = id; while (current) { if (current === target) return true; current = parents.get(current); } return false; });
    const rows = items.map(item => {
      const variant = byId.get(item.variantId);
      const published = !!variant && variant.product.status === 'PUBLISHED' && variant.product.categories.some(link => tree.isActive(link.categoryId));
      const categories = variant?.product.categories.map(link => link.categoryId).filter(id => tree.isActive(id)) ?? [];
      const discount = published ? promotions.filter(rule => rule.productId === variant.productId || (rule.categoryId && matchesCategory(categories, rule.categoryId))).map(rule => saving(rule, variant!.pricePaise)).sort((a, b) => b - a)[0] ?? 0 : 0;
      const stock = variant?.stockQuantity ?? 0;
      const warning = !published ? 'This piece is no longer available. Remove it from your cart.' : stock <= 0 ? 'Out of stock. Remove this item.' : item.quantity > stock ? `Only ${stock} available. Adjust the quantity.` : null;
      const unitPricePaise = published ? variant!.pricePaise : 0;
      const isGiftWrapEligible = published && variant!.product.giftWrapEligible;
      const gift = giftSelection(item);
      const giftWrapSelected = Boolean(isGiftWrapEligible && gift.giftWrapSelected);
      return { itemId: item.itemId ?? null, variantId: item.variantId, quantity: item.quantity, product: published ? { id: variant!.product.id, slug: variant!.product.slug, name: variant!.product.name, image: variant!.images[0] ?? variant!.product.images[0] ?? null } : null, variant: published ? { id: variant!.id, sku: variant!.sku, pricePaise: variant!.pricePaise, stockQuantity: stock, attributes: variant!.attributes ?? [] } : null, unitPricePaise, effectiveUnitPricePaise: unitPricePaise - discount, automaticDiscountPaise: discount * item.quantity, couponDiscountPaise: 0, lineTotalPaise: (unitPricePaise - discount) * item.quantity, warning, eligible: published, categoryIds: categories, collectionIds: variant?.product.collections.map(link => link.collectionId) ?? [], isGiftWrapEligible, giftWrapPricePaise: isGiftWrapEligible ? settings?.giftWrapFeePaise ?? 0 : 0, allowGiftMessage: Boolean(isGiftWrapEligible && settings?.giftMessagesAvailable), giftWrapSelected, giftMessage: giftWrapSelected && settings?.giftMessagesAvailable ? gift.giftMessage : null };
    });
    const subtotalPaise = rows.reduce((sum, row) => sum + row.unitPricePaise * row.quantity, 0);
    let coupon: { code: string; valid: boolean; message: string; savingsPaise: number } | null = null;
    if (couponCode) {
      const code = couponCode.trim().toUpperCase();
      const rule = await this.db.coupon.findFirst({ where: { code: { equals: code, mode: 'insensitive' } }, include: { products: true, categories: true, collections: true, _count: { select: { redemptions: true } } } });
      let message = '';
      if (!rule) message = 'Coupon code not found.';
      else if (rule.lifecycle !== 'PUBLISHED' || !rule.enabled || (rule.startsAt && rule.startsAt > now) || (rule.expiresAt && rule.expiresAt <= now)) message = 'This coupon is not active or has expired.';
      else if (rule.usageLimit != null && rule._count.redemptions >= rule.usageLimit) message = 'This coupon has reached its usage limit.';
      else if (rule.perCustomerLimit != null && !customerId) message = 'Log in to use this coupon.';
      else if (rule.perCustomerLimit != null && await this.db.couponRedemption.count({ where: { couponId: rule.id, customerId: customerId! } }) >= rule.perCustomerLimit) message = 'You have reached this coupon’s usage limit.';
      else if (rule.minimumCartPaise != null && rows.reduce((sum, row) => sum + row.lineTotalPaise, 0) < rule.minimumCartPaise) message = `Add ₹${((rule.minimumCartPaise - rows.reduce((sum, row) => sum + row.lineTotalPaise, 0)) / 100).toFixed(2)} of merchandise to use this coupon.`;
      if (!message && rule) {
        const eligible = rows.filter(row => row.eligible && (rule.scope === 'CART' || rule.products.some(link => link.productId === row.product?.id) || rule.categories.some(link => matchesCategory(row.categoryIds, link.categoryId)) || rule.collections.some(link => row.collectionIds.includes(link.collectionId))));
        const basis = eligible.reduce((sum, row) => sum + row.lineTotalPaise, 0);
        if (!basis) message = 'No eligible items for this coupon.';
        else {
          let amount = saving(rule, basis);
          if (rule.maximumDiscountPaise != null) amount = Math.min(amount, rule.maximumDiscountPaise);
          if (!rule.allowStacking) {
            const originalBasis = eligible.reduce((sum, row) => sum + row.unitPricePaise * row.quantity, 0);
            let exclusive = saving(rule, originalBasis);
            if (rule.maximumDiscountPaise != null) exclusive = Math.min(exclusive, rule.maximumDiscountPaise);
            if (exclusive <= rows.reduce((sum, row) => sum + row.automaticDiscountPaise, 0)) message = 'Automatic offers already save more than this coupon.';
            else { for (const row of rows) { row.automaticDiscountPaise = 0; row.effectiveUnitPricePaise = row.unitPricePaise; row.lineTotalPaise = row.unitPricePaise * row.quantity; } amount = exclusive; }
          }
          if (!message) { let remaining = amount; eligible.forEach((row, index) => { const share = index === eligible.length - 1 ? remaining : Math.floor(amount * row.lineTotalPaise / eligible.reduce((sum, current) => sum + current.lineTotalPaise, 0)); row.couponDiscountPaise = share; row.lineTotalPaise -= share; remaining -= share; }); coupon = { code: rule.code, valid: true, message: 'Coupon applied.', savingsPaise: amount }; }
        }
      }
      if (!coupon) coupon = { code, valid: false, message, savingsPaise: 0 };
    }
    const automaticDiscountPaise = rows.reduce((sum, row) => sum + row.automaticDiscountPaise, 0);
    const couponDiscountPaise = rows.reduce((sum, row) => sum + row.couponDiscountPaise, 0);
    const giftWrapTotalPaise = rows.reduce((sum, row) => sum + (row.giftWrapSelected ? row.giftWrapPricePaise * row.quantity : 0), 0);
    return { currency: 'INR', items: rows.map(row => ({ itemId: row.itemId, variantId: row.variantId, quantity: row.quantity, product: row.product, variant: row.variant, unitPricePaise: row.unitPricePaise, effectiveUnitPricePaise: row.effectiveUnitPricePaise, automaticDiscountPaise: row.automaticDiscountPaise, couponDiscountPaise: row.couponDiscountPaise, lineTotalPaise: row.lineTotalPaise, warning: row.warning, isGiftWrapEligible: row.isGiftWrapEligible, giftWrapPricePaise: row.giftWrapPricePaise, allowGiftMessage: row.allowGiftMessage, giftWrapSelected: row.giftWrapSelected, giftMessage: row.giftMessage })), itemCount: rows.reduce((sum, row) => sum + row.quantity, 0), subtotalPaise, automaticDiscountPaise, couponDiscountPaise, giftWrapTotalPaise, estimatedTotalPaise: subtotalPaise - automaticDiscountPaise - couponDiscountPaise + giftWrapTotalPaise, coupon, canCheckout: rows.length > 0 && rows.every(row => !row.warning), note: 'Prices and stock are rechecked at checkout.' };
  }
}
