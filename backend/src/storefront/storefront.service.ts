import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { branchIds, categoryVisibility } from '../categories/category-visibility';

const activeCollection = (now: Date): Prisma.CollectionWhereInput => ({ AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] });
const productSelect = {
  id: true, name: true, slug: true, description: true, story: true, isFeatured: true, giftWrapEligible: true, createdAt: true,
  images: { orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }], take: 2, select: { url: true, altText: true } },
  variants: { orderBy: { pricePaise: 'asc' as const }, select: { id: true, sku: true, pricePaise: true, compareAtPricePaise: true, stockQuantity: true, optionCombinationKey: true } },
  categories: { where: { category: { status: 'ACTIVE' as const, deletedAt: null } }, select: { category: { select: { name: true, slug: true } } } },
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

@Injectable()
export class StorefrontService {
  constructor(private readonly db: PrismaService) {}
  private async publicProductWhere(): Promise<Prisma.ProductWhereInput> {
    const tree = await categoryVisibility(this.db);
    return { status: 'PUBLISHED', categories: { some: { categoryId: { in: tree.categories.filter(category => tree.isActive(category.id)).map(category => category.id) } } } };
  }
  private card(row: ProductRow) {
    const prices = row.variants.map((variant: { pricePaise: number }) => variant.pricePaise);
    return { id: row.id, name: row.name, slug: row.slug, description: row.description, story: row.story, isFeatured: row.isFeatured, giftWrapEligible: row.giftWrapEligible,
      image: row.images[0] ?? null, images: row.images, minPricePaise: prices.length ? Math.min(...prices) : null, maxPricePaise: prices.length ? Math.max(...prices) : null,
      compareAtPricePaise: null,
      available: row.variants.some((variant: { stockQuantity: number }) => variant.stockQuantity > 0),
      variants: row.variants.map(variant => ({ id: variant.id, sku: variant.sku, pricePaise: variant.pricePaise, optionCombinationKey: variant.optionCombinationKey, available: variant.stockQuantity > 0 })),
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
    const photos = await this.db.productCategory.findMany({ where: { categoryId: { in: eligible.map(item => item.id) }, product: { status: 'PUBLISHED', images: { some: {} } } }, distinct: ['categoryId'], select: { categoryId: true, product: { select: { images: { orderBy: { position: 'asc' }, take: 1, select: { url: true, altText: true } } } } } });
    const photoByCategory = new Map(photos.map(link => [link.categoryId, link.product.images[0]]));
    return eligible.map(category => ({ id: category.id, name: category.name, slug: category.slug, parentId: category.parentId, image: category.imageUrl ? { url: category.imageUrl, altText: category.name } : photoByCategory.get(category.id) ?? null }));
  }
  async menu() {
    const visible = await this.publicProductWhere();
    const [categories, directory, collections] = await Promise.all([this.navigation(), this.directory(), this.db.collection.findMany({ where: { ...activeCollection(new Date()), products: { some: { product: visible } } }, select: { name: true, slug: true, description: true }, orderBy: [{ position: 'asc' }, { name: 'asc' }], take: 8 })]);
    return { categories, directory, collections };
  }
  async home() {
    const now = new Date();
    const visible = await this.publicProductWhere();
    const [categories, featured, latest, giftable, collections] = await Promise.all([
      this.directory(),
      this.db.product.findMany({ where: { ...visible, isFeatured: true, variants: { some: {} } }, select: productSelect, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 8 }),
      this.db.product.findMany({ where: { ...visible, variants: { some: {} } }, select: productSelect, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 8 }),
      this.db.product.findMany({ where: { ...visible, giftWrapEligible: true, variants: { some: {} } }, select: productSelect, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 3 }),
      this.db.collection.findMany({ where: { ...activeCollection(now), products: { some: { product: visible } } }, select: { name: true, slug: true, description: true, products: { where: { product: visible }, orderBy: { position: 'asc' }, take: 3, select: { product: { select: productSelect } } } }, orderBy: [{ position: 'asc' }, { name: 'asc' }], take: 6 }),
    ]);
    return { categories, featured: featured.map(row => this.card(row)), latest: latest.map(row => this.card(row)), giftable: giftable.map(row => this.card(row)), collections: collections.map(row => ({ name: row.name, slug: row.slug, description: row.description, products: row.products.map(link => this.card(link.product)) })) };
  }
  async products(input: { category?: string; collection?: string; search?: string; giftable?: 'true'; page: number }) {
    const visible = await this.publicProductWhere();
    const tree = input.category ? await categoryVisibility(this.db) : null;
    const category = tree?.categories.find(item => item.slug === input.category);
    if (input.category && (!category || !tree?.isActive(category.id))) throw new NotFoundException('Category not found.');
    const where = { ...visible, variants: { some: {} }, ...(category && tree ? { categories: { some: { categoryId: { in: branchIds(tree, category.id) } } } } : {}), ...(input.collection === 'new-arrivals' ? { tags: { some: { tag: { slug: { in: ['new-arrival', 'new-arrivals'] } } } } } : input.collection ? { collections: { some: { collection: { slug: input.collection, ...activeCollection(new Date()) } } } } : {}), ...(input.search ? { name: { contains: input.search, mode: 'insensitive' as const } } : {}), ...(input.giftable ? { giftWrapEligible: true } : {}) };
    const orderBy = [{ createdAt: 'desc' as const }, { id: 'asc' as const }];
    const [total, rows] = await this.db.$transaction([this.db.product.count({ where }), this.db.product.findMany({ where, select: productSelect, orderBy, skip: (input.page - 1) * 24, take: 24 })]);
    const items = rows.map(row => this.card(row));
    return { items, total, page: input.page, pageSize: 24 };
  }
  async product(slug: string) {
    const visible = await this.publicProductWhere();
    const row = await this.db.product.findFirst({ where: { ...visible, slug }, select: productSelect });
    if (!row) throw new NotFoundException('Product not found.');
    return this.card(row);
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
