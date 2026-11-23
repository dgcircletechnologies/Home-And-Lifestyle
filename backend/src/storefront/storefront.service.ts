import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { branchIds, categoryVisibility } from '../categories/category-visibility';
import { ShopService } from './shop.service';
import { activeAutomaticPromotionWhere } from '../promotions/public-promotion';

const activeCollection = (now: Date): Prisma.CollectionWhereInput => ({ AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] });
const productSelect = {
  id: true, name: true, slug: true, description: true, story: true, materials: true, dimensions: true, careInstructions: true, isFeatured: true, giftWrapEligible: true, createdAt: true,
  attributes: { select: { key: true, textValue: true, numericValue: true, unit: true } },
  tags: { select: { tag: { select: { name: true } } } },
  collections: { select: { collection: { select: { name: true } } } },
  images: { orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }], take: 2, select: { url: true, altText: true } },
  variants: { orderBy: { pricePaise: 'asc' as const }, select: { id: true, sku: true, pricePaise: true, compareAtPricePaise: true, stockQuantity: true, optionCombinationKey: true, attributes: true, dimensions: true } },
  categories: { where: { category: { status: 'ACTIVE' as const, deletedAt: null } }, select: { categoryId: true, category: { select: { name: true, slug: true } } } },
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;
type PriceRules = { rules: { id: string; productId: string | null; categoryId: string | null; kind: string; amountPaise: number | null; percentBasisPoints: number | null }[]; branches: Map<string, string[]> };

@Injectable()
export class StorefrontService {
  constructor(private readonly db: PrismaService, private readonly shopService: ShopService) {}
  private async publicProductWhere(): Promise<Prisma.ProductWhereInput> {
    const tree = await categoryVisibility(this.db);
    return { status: 'PUBLISHED', categories: { some: { categoryId: { in: tree.categories.filter(category => tree.isActive(category.id)).map(category => category.id) } } } };
  }
  private async priceRules(): Promise<PriceRules> {
    const [rules, tree] = await Promise.all([this.db.promotion.findMany({ where: activeAutomaticPromotionWhere(new Date()), select: { id: true, productId: true, categoryId: true, kind: true, amountPaise: true, percentBasisPoints: true } }), categoryVisibility(this.db)]);
    return { rules, branches: new Map(tree.categories.map(category => [category.id, branchIds(tree, category.id)])) };
  }
  private card(row: ProductRow, pricing: PriceRules) {
    const variants = row.variants.map(variant => {
      const applicable = pricing.rules.filter(rule => rule.productId === row.id || rule.categoryId && row.categories.some(link => pricing.branches.get(rule.categoryId!)?.includes(link.categoryId)));
      const discount = applicable.map(rule => ({ id: rule.id, amount: Math.min(variant.pricePaise, rule.kind === 'FIXED' ? rule.amountPaise ?? 0 : Math.floor((variant.pricePaise * (rule.percentBasisPoints ?? 0) + 5000) / 10000)) })).sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id))[0]?.amount ?? 0;
      return { id: variant.id, sku: variant.sku, pricePaise: variant.pricePaise, effectivePricePaise: variant.pricePaise - discount, compareAtPricePaise: discount ? variant.pricePaise : null, stockQuantity: variant.stockQuantity, attributes: variant.attributes ?? [], dimensions: variant.dimensions, optionCombinationKey: variant.optionCombinationKey, available: variant.stockQuantity > 0 };
    }).sort((a, b) => a.effectivePricePaise - b.effectivePricePaise || a.id.localeCompare(b.id));
    const cheapest = variants[0];
    return { id: row.id, name: row.name, slug: row.slug, description: row.description, story: row.story, isFeatured: row.isFeatured, giftWrapEligible: row.giftWrapEligible,
      image: row.images[0] ?? null, images: row.images, minPricePaise: cheapest?.effectivePricePaise ?? null, maxPricePaise: variants.at(-1)?.effectivePricePaise ?? null,
      compareAtPricePaise: cheapest?.compareAtPricePaise ?? null, variantCount: variants.length,
      available: row.variants.some((variant: { stockQuantity: number }) => variant.stockQuantity > 0),
      variants, materials: row.materials, dimensions: row.dimensions, careInstructions: row.careInstructions,
      attributes: row.attributes.map(attribute => ({ key: attribute.key, value: attribute.textValue ?? (attribute.numericValue === null ? null : `${attribute.numericValue}${attribute.unit ? ` ${attribute.unit}` : ''}`) })).filter(attribute => attribute.value),
      tags: row.tags.map(link => link.tag.name), collections: row.collections.map(link => link.collection.name),
      categories: row.categories.map((link: { category: { name: string; slug: string } }) => link.category) };
  }
  async navigation() {
    const tree = await categoryVisibility(this.db);
    const selected = tree.categories.filter(category => !category.parentId && category.showInStorefrontNav && tree.hasProducts(category.id)).sort((a,b) => (a.storefrontNavPosition ?? 999999) - (b.storefrontNavPosition ?? 999999) || a.name.localeCompare(b.name));
    const ids = new Set<string>();
    for (const root of selected) for (const id of branchIds(tree, root.id)) if (tree.hasProducts(id)) ids.add(id);
    return [...selected, ...tree.categories.filter(category => ids.has(category.id) && category.parentId)].map(category => ({ id: category.id, name: category.name, slug: category.slug, parentId: category.parentId, image: category.imageUrl ? { url: category.imageUrl, altText: category.name } : null }));
  }
  async directory() {
    const tree = await categoryVisibility(this.db);
    const eligible = tree.categories.filter(category => tree.hasProducts(category.id));
    const children = new Map<string, typeof eligible>();
    for (const category of eligible) if (category.parentId) children.set(category.parentId, [...(children.get(category.parentId) ?? []), category]);
    const roots = eligible.filter(category => !category.parentId).sort((a, b) => {
      const aPosition = a.showInStorefrontNav ? a.storefrontNavPosition : null;
      const bPosition = b.showInStorefrontNav ? b.storefrontNavPosition : null;
      return (aPosition ?? Number.MAX_SAFE_INTEGER) - (bPosition ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
    });
    const ordered: typeof eligible = [];
    const visit = (category: typeof eligible[number]) => { ordered.push(category); for (const child of children.get(category.id) ?? []) visit(child); };
    roots.forEach(visit);
    const photos = await this.db.productCategory.findMany({ where: { categoryId: { in: eligible.map(item => item.id) }, product: { status: 'PUBLISHED', images: { some: {} } } }, distinct: ['categoryId'], select: { categoryId: true, product: { select: { images: { orderBy: { position: 'asc' }, take: 1, select: { url: true, altText: true } } } } } });
    const photoByCategory = new Map(photos.map(link => [link.categoryId, link.product.images[0]]));
    return ordered.map(category => ({ id: category.id, name: category.name, slug: category.slug, parentId: category.parentId, image: category.imageUrl ? { url: category.imageUrl, altText: category.name } : photoByCategory.get(category.id) ?? null }));
  }
  async menu() {
    const visible = await this.publicProductWhere();
    const [categories, directory, collections] = await Promise.all([this.navigation(), this.directory(), this.db.collection.findMany({ where: { ...activeCollection(new Date()), products: { some: { product: visible } } }, select: { name: true, slug: true, description: true }, orderBy: [{ position: 'asc' }, { name: 'asc' }], take: 8 })]);
    return { categories, directory, collections };
  }
  async offers(now = new Date()) {
    const [tree, promotions] = await Promise.all([
      categoryVisibility(this.db),
      this.db.promotion.findMany({
        where: activeAutomaticPromotionWhere(now),
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: {
          id: true, name: true, kind: true, amountPaise: true, percentBasisPoints: true,
          productId: true, categoryId: true,
          product: { select: { id: true, name: true, slug: true, status: true, categories: { select: { categoryId: true } }, variants: { select: { id: true }, take: 1 } } },
          category: { select: { id: true, name: true, slug: true } },
        },
      }),
    ]);
    return promotions.flatMap(rule => {
      const discountValue = rule.kind === 'FIXED' ? (rule.amountPaise ?? 0) / 100 : (rule.percentBasisPoints ?? 0) / 100;
      if (discountValue <= 0 || Boolean(rule.productId) === Boolean(rule.categoryId)) return [];
      const target = rule.productId ? rule.product : rule.category;
      if (!target) return [];
      if (rule.productId) {
        const product = rule.product!;
        if (product.status !== 'PUBLISHED' || !product.variants.length || !product.categories.some(link => tree.isActive(link.categoryId))) return [];
      } else if (!tree.hasProducts(rule.categoryId!)) return [];
      return [{
        id: rule.id, title: rule.name, discountType: rule.kind, discountValue,
        targetType: rule.productId ? 'PRODUCT' as const : 'CATEGORY' as const,
        targetId: target.id, targetName: target.name, targetSlug: target.slug,
      }];
    });
  }
  async home() {
    const now = new Date();
    const visible = await this.publicProductWhere();
    const [categories, featured, latest, giftable, collections, shop, offers, pricing] = await Promise.all([
      this.directory(),
      this.db.product.findMany({ where: { ...visible, isFeatured: true, variants: { some: {} } }, select: productSelect, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 8 }),
      this.db.product.findMany({ where: { ...visible, variants: { some: {} } }, select: productSelect, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 8 }),
      this.db.product.findMany({ where: { ...visible, giftWrapEligible: true, variants: { some: {} } }, select: productSelect, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 3 }),
      this.db.collection.findMany({ where: { ...activeCollection(now), products: { some: { product: visible } } }, select: { name: true, slug: true, description: true, products: { where: { product: visible }, orderBy: { position: 'asc' }, take: 3, select: { product: { select: productSelect } } } }, orderBy: [{ position: 'asc' }, { name: 'asc' }], take: 6 }),
      this.shopService.list({ sort: 'newest', page: 1, pageSize: 20, includeCategoryRows: true }),
      this.offers(now),
      this.priceRules(),
    ]);
    return { categories, featured: featured.map(row => this.card(row, pricing)), latest: latest.map(row => this.card(row, pricing)), giftable: giftable.map(row => this.card(row, pricing)), collections: collections.map(row => ({ name: row.name, slug: row.slug, description: row.description, products: row.products.map(link => this.card(link.product, pricing)) })), categoryRows: shop.categoryRows ?? [], offers };
  }
  async products(input: { category?: string; collection?: string; search?: string; giftable?: 'true'; page: number }) {
    const visible = await this.publicProductWhere();
    const tree = input.category ? await categoryVisibility(this.db) : null;
    const category = tree?.categories.find(item => item.slug === input.category);
    if (input.category && (!category || !tree?.isActive(category.id))) throw new NotFoundException('Category not found.');
    const where = { ...visible, variants: { some: {} }, ...(category && tree ? { categories: { some: { categoryId: { in: branchIds(tree, category.id) } } } } : {}), ...(input.collection === 'new-arrivals' ? { tags: { some: { tag: { slug: { in: ['new-arrival', 'new-arrivals'] } } } } } : input.collection ? { collections: { some: { collection: { slug: input.collection, ...activeCollection(new Date()) } } } } : {}), ...(input.search ? { name: { contains: input.search, mode: 'insensitive' as const } } : {}), ...(input.giftable ? { giftWrapEligible: true } : {}) };
    const orderBy = [{ createdAt: 'desc' as const }, { id: 'asc' as const }];
    const [total, rows] = await this.db.$transaction([this.db.product.count({ where }), this.db.product.findMany({ where, select: productSelect, orderBy, skip: (input.page - 1) * 24, take: 24 })]);
    const pricing = await this.priceRules();
    const items = rows.map(row => this.card(row, pricing));
    return { items, total, page: input.page, pageSize: 24 };
  }
  async product(slug: string) {
    const visible = await this.publicProductWhere();
    const row = await this.db.product.findFirst({ where: { ...visible, slug }, select: { ...productSelect, images: { orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { url: true, altText: true } } } });
    if (!row) throw new NotFoundException('Product not found.');
    return this.card(row, await this.priceRules());
  }
  async category(slug: string) {
    const tree = await categoryVisibility(this.db);
    const match = tree.categories.find(item => item.slug === slug);
    if (!match || !tree.isActive(match.id)) throw new NotFoundException('Category not found.');
    const category = await this.db.category.findFirst({ where: { slug, status: 'ACTIVE', deletedAt: null }, select: { name: true, slug: true, description: true, imageUrl: true } });
    if (!category) throw new NotFoundException('Category not found.');
    return category;
  }
  async collection(slug: string) {
    const visible = await this.publicProductWhere();
    const collection = await this.db.collection.findFirst({ where: { slug, ...activeCollection(new Date()), products: { some: { product: visible } } }, select: { name: true, slug: true, description: true } });
    if (!collection) throw new NotFoundException('Collection not found.');
    return collection;
  }
  async serviceability(pinCode: string) {
    const record = await this.db.pinCodeServiceability.findUnique({ where: { pinCode }, select: { supported: true, enabled: true } });
    return { pinCode, available: Boolean(record?.enabled && record.supported), message: record?.enabled && record.supported ? 'Delivery is available for this PIN. Final charges and dates depend on your items.' : 'Delivery is not available for this PIN.' };
  }
}
