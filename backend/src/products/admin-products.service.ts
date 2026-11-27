import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ProductStatus, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import { CategoryImageService, type CategoryImage } from '../categories/category-image.service';
import { randomUUID } from 'node:crypto';
import { ProductVideoService } from './product-video.service';

const missing = () => new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' });
const conflict = (message: string) => new ConflictException({ code: 'PRODUCT_CONFLICT', message });
type VariantInput = { id?: string; sku: string; pricePaise: number; stockQuantity: number; attributes: { title: string; value: string }[] };
const productFields = { id: true, name: true, slug: true, description: true, story: true, materials: true, careInstructions: true, status: true, isFeatured: true, giftWrapEligible: true, videoUrl: true, videoPublicId: true, showInHomeVideoShowcase: true, showInHeroCarousel: true, createdAt: true, updatedAt: true } as const;
const productInclude = { categories: { include: { category: { select: { id: true, name: true, slug: true } } } }, tags: { include: { tag: { select: { name: true, slug: true } } } }, images: { orderBy: [{ position: 'asc' }, { id: 'asc' }] }, variants: { include: { images: { orderBy: [{ position: 'asc' }, { id: 'asc' }] }, selections: { include: { value: { include: { option: true } } } }, stockReceipts: { orderBy: { createdAt: 'desc' }, take: 25, include: { admin: { select: { id: true, name: true } } } } }, orderBy: { sku: 'asc' } } } satisfies Prisma.ProductInclude;
const tagSlug = (name: string) => name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
const normalizedTags = (names: string[]) => { const tags = new Map<string, string>(); for (const raw of names) { const name = raw.trim().replace(/\s+/g, ' '); const slug = tagSlug(name); if (slug && !tags.has(slug)) tags.set(slug, name); } return [...tags].map(([slug, name]) => ({ slug, name })); };
const tagNames = (links: { tag: { name: string; slug: string } }[]) => links.map(link => link.tag).sort((a, b) => Number(b.slug === 'new-arrival') - Number(a.slug === 'new-arrival') || a.name.localeCompare(b.name)).map(tag => tag.name);
// Prisma's list and detail selections intentionally differ; this common admin projection normalises both.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dto = (row: any) => { const images = [...(row.images ?? [])].sort((a: any, b: any) => (a.position - b.position) || a.id.localeCompare(b.id)); return { ...row, newArrival: (row.tags ?? []).some((entry: any) => entry.tag?.slug === 'new-arrival'), tags: tagNames(row.tags ?? []), images, primaryImage: images[0] ?? null, secondaryImage: images[1] ?? null, categories: row.categories.map((entry: any) => entry.category), price: row.variants.length ? { minPaise: Math.min(...row.variants.map((v: any) => v.pricePaise)), maxPaise: Math.max(...row.variants.map((v: any) => v.pricePaise)) } : null, stockQuantity: row.variants.reduce((sum: number, v: any) => sum + v.stockQuantity, 0) }; };
@Injectable()
export class AdminProductsService {
  constructor(private readonly db: PrismaService, private readonly images: CategoryImageService, private readonly videos: ProductVideoService) {}
  private async product(id: string) { const row = await this.db.product.findUnique({ where: { id }, include: productInclude }); if (!row) throw missing(); return row; }
  private async categories(ids: string[] | undefined) { if (!ids) return; const found = await this.db.category.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true } }); if (found.length !== new Set(ids).size) throw new BadRequestException({ code: 'CATEGORY_INVALID', message: 'One or more selected categories are unavailable.' }); }
  async categoryOptions(search?: string) { return this.db.category.findMany({ where: { deletedAt: null, ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}) }, select: { id: true, name: true, parentId: true, status: true, parent: { select: { name: true } } }, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 500 }); }
  private baseSlug(name: string) { return name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 140) || 'product'; }
  private async generatedSlug(name: string) { const base = this.baseSlug(name); for (let i = 0; i < 20; i++) { const slug = i ? `${base}-${i + 1}` : base; if (!await this.db.product.findUnique({ where: { slug }, select: { id: true } })) return slug; } return `${base}-${randomUUID().slice(0, 8)}`; }
  private async checkSkus(variants: VariantInput[], tx: Prisma.TransactionClient | PrismaService = this.db) {
    const matches = await tx.productVariant.findMany({ where: { OR: variants.map(variant => ({ sku: { equals: variant.sku, mode: 'insensitive' as const } })) }, select: { id: true, sku: true } });
    const held = new Set(variants.map(variant => variant.id).filter(Boolean));
    const duplicate = matches.find(match => !held.has(match.id));
    if (duplicate) throw conflict(`SKU ${duplicate.sku} is already used by another variant.`);
  }
  private async syncTags(tx: Prisma.TransactionClient, productId: string, names?: string[], newArrival?: boolean) {
    if (names === undefined && newArrival === undefined) return;
    const existing = names === undefined
      ? (await tx.productTag.findMany({ where: { productId }, select: { tag: { select: { name: true } } } })).map(link => link.tag.name)
      : names;
    const next = newArrival === undefined ? existing : [...existing.filter(name => tagSlug(name) !== 'new-arrival'), ...(newArrival ? ['New Arrival'] : [])];
    const tags = normalizedTags(next);
    const tagIds: string[] = [];
    for (const tag of tags) {
      const saved = await tx.tag.upsert({ where: { slug: tag.slug }, create: tag, update: {} });
      tagIds.push(saved.id);
    }
    await tx.productTag.deleteMany({ where: { productId } });
    if (tagIds.length) await tx.productTag.createMany({ data: tagIds.map(tagId => ({ productId, tagId })) });
  }
  async list(query: { page: number; pageSize: number; search?: string; status: 'all' | ProductStatus; categoryId?: string; stock: 'all' | 'in' | 'out'; sort: 'name' | 'createdAt' | 'updatedAt' }) {
    const where: Prisma.ProductWhereInput = { ...(query.status === 'all' ? {} : { status: query.status }), ...(query.categoryId ? { categories: { some: { categoryId: query.categoryId } } } : {}), ...(query.stock === 'in' ? { variants: { some: { stockQuantity: { gt: 0 } } } } : query.stock === 'out' ? { variants: { none: { stockQuantity: { gt: 0 } } } } : {}), ...(query.search ? { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { slug: { contains: query.search, mode: 'insensitive' } }, { variants: { some: { sku: { contains: query.search, mode: 'insensitive' } } } }] } : {}) };
    const direction = query.sort === 'name' ? 'asc' as const : 'desc' as const;
    const [total, rows] = await this.db.$transaction([this.db.product.count({ where }), this.db.product.findMany({ where, select: { ...productFields, images: { orderBy: [{ position: 'asc' }, { id: 'asc' }], take: 1 }, categories: { include: { category: { select: { id: true, name: true } } } }, tags: { include: { tag: { select: { name: true, slug: true } } } }, variants: { select: { id: true, sku: true, pricePaise: true, stockQuantity: true } } }, orderBy: [{ [query.sort]: direction }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize })]);
    return { items: rows.map(dto), page: query.page, pageSize: query.pageSize, total };
  }
  async detail(id: string) { return dto(await this.product(id)); }
  async create(input: { name: string; slug: string; description: string; story?: string | null; materials?: string[]; careInstructions?: string | null; videoUrl?: string | null; videoPublicId?: string | null; showInHomeVideoShowcase?: boolean; showInHeroCarousel?: boolean; tags?: string[]; categoryIds?: string[]; variants: VariantInput[]; giftWrapEligible?: boolean; newArrival?: boolean }, uploads?: CategoryImage[]) {
    await this.categories(input.categoryIds);
    if (input.variants.some(variant => variant.id)) throw new BadRequestException('New variants cannot include an ID.');
    await this.checkSkus(input.variants);
    const slug = input.slug;
    const defaultWrap = (await this.db.storeSettings.findUnique({ where: { id: 'store' }, select: { giftWrapDefaultEligible: true } }))?.giftWrapDefaultEligible ?? false;
    try {
      const row = await this.db.$transaction(async tx => {
        const created = await tx.product.create({ data: { name: input.name, slug, description: input.description, story: input.story ?? null, materials: input.materials ?? [], careInstructions: input.careInstructions ?? null, giftWrapEligible: input.giftWrapEligible ?? defaultWrap, videoUrl: input.videoUrl ?? null, videoPublicId: input.videoPublicId ?? null, showInHomeVideoShowcase: Boolean(input.showInHomeVideoShowcase && input.videoUrl), showInHeroCarousel: input.showInHeroCarousel ?? false, categories: input.categoryIds?.length ? { create: input.categoryIds.map(categoryId => ({ categoryId })) } : undefined, images: uploads?.length ? { create: uploads.map((asset, position) => ({ url: asset.url, cloudinaryPublicId: asset.publicId, position })) } : undefined, variants: { create: input.variants.map(variant => ({ sku: variant.sku, pricePaise: variant.pricePaise, stockQuantity: variant.stockQuantity, attributes: variant.attributes, optionCombinationKey: `sku-${randomUUID()}` })) } } });
        await this.syncTags(tx, created.id, input.tags, input.newArrival);
        return tx.product.findUniqueOrThrow({ where: { id: created.id }, include: productInclude });
      });
      return dto(row);
    }
    catch (error) { if ((error as { code?: string }).code === 'P2002') throw conflict('The product slug or a variant SKU already exists.'); throw error; }
  }
  async createWithImages(input: Parameters<AdminProductsService['create']>[0], files: Express.Multer.File[]) { if (!files?.length || files.length > 2) throw new BadRequestException('Choose one or two product images.'); const uploaded: CategoryImage[] = []; try { for (const file of files) uploaded.push(await this.images.upload(file)); return await this.create(input, uploaded); } catch (error) { await Promise.all(uploaded.map(asset => this.images.remove(asset.publicId))); throw error; } }
  async update(id: string, input: { name?: string; slug?: string; description?: string; story?: string | null; materials?: string[]; careInstructions?: string | null; isFeatured?: boolean; giftWrapEligible?: boolean; videoUrl?: string | null; videoPublicId?: string | null; showInHomeVideoShowcase?: boolean; showInHeroCarousel?: boolean; tags?: string[]; categoryIds?: string[]; newArrival?: boolean; variants?: VariantInput[] }) {
    await this.categories(input.categoryIds);
    if (!await this.db.productImage.count({ where: { productId: id } })) throw new BadRequestException('Add a primary image before editing this product.');
    try {
      const row = await this.db.$transaction(async tx => {
        if (input.variants) {
          const existing = await tx.productVariant.findMany({ where: { productId: id }, select: { id: true, sku: true } });
          if (input.variants.some(variant => variant.id && !existing.some(old => old.id === variant.id))) throw new BadRequestException('A variant ID does not belong to this product.');
          await this.checkSkus(input.variants, tx);
          const removed = existing.filter(old => !input.variants!.some(variant => variant.id === old.id));
          if (removed.length) {
            const ids = removed.map(variant => variant.id);
            const [cart, orders, receipts, bundles] = await Promise.all([tx.cartLine.count({ where: { variantId: { in: ids } } }), tx.orderLine.count({ where: { variantId: { in: ids } } }), tx.productStockReceipt.count({ where: { variantId: { in: ids } } }), tx.bundleComponent.count({ where: { OR: [{ bundleVariantId: { in: ids } }, { componentVariantId: { in: ids } }] } })]);
            if (cart || orders || receipts || bundles) throw new BadRequestException('A removed SKU is linked to a cart, order, stock receipt, or bundle. Keep that variant and set its stock to 0.');
            await tx.productVariant.deleteMany({ where: { id: { in: ids }, productId: id } });
          }
          for (const variant of input.variants) {
            const data = { sku: variant.sku, pricePaise: variant.pricePaise, stockQuantity: variant.stockQuantity, attributes: variant.attributes };
            if (variant.id) await tx.productVariant.update({ where: { id: variant.id }, data });
            else await tx.productVariant.create({ data: { productId: id, ...data, optionCombinationKey: `sku-${randomUUID()}` } });
          }
        }
        await tx.product.update({ where: { id }, data: { ...(input.name !== undefined ? { name: input.name } : {}), ...(input.slug !== undefined ? { slug: input.slug } : {}), ...(input.description !== undefined ? { description: input.description } : {}), ...(input.story !== undefined ? { story: input.story } : {}), ...(input.materials !== undefined ? { materials: input.materials } : {}), ...(input.careInstructions !== undefined ? { careInstructions: input.careInstructions } : {}), ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}), ...(input.giftWrapEligible !== undefined ? { giftWrapEligible: input.giftWrapEligible } : {}), ...(input.videoUrl !== undefined ? { videoUrl: input.videoUrl, ...(input.videoUrl ? {} : { videoPublicId: null, showInHomeVideoShowcase: false }) } : {}), ...(input.videoPublicId !== undefined && input.videoUrl !== null ? { videoPublicId: input.videoPublicId } : {}), ...(input.showInHeroCarousel !== undefined ? { showInHeroCarousel: input.showInHeroCarousel } : {}), ...(input.showInHomeVideoShowcase !== undefined ? { showInHomeVideoShowcase: Boolean(input.showInHomeVideoShowcase && (input.videoUrl !== undefined ? input.videoUrl : (await tx.product.findUniqueOrThrow({ where: { id }, select: { videoUrl: true } })).videoUrl)) } : {}), ...(input.categoryIds !== undefined ? { categories: { deleteMany: {}, create: input.categoryIds.map(categoryId => ({ categoryId })) } } : {}) } });
        await this.syncTags(tx, id, input.tags, input.newArrival);
        return tx.product.findUniqueOrThrow({ where: { id }, include: productInclude });
      });
      return dto(row);
    } catch (error) { if ((error as { code?: string }).code === 'P2002') throw conflict('The product slug or a variant SKU already exists.'); if ((error as { code?: string }).code === 'P2003') throw conflict('A removed SKU is still in use. Keep it and set its stock to 0.'); throw error; }
  }
  async status(id: string, status: ProductStatus) { const current = await this.product(id); if (status === 'PUBLISHED' && (!current.categories.length || !current.variants.length || !current.images.length)) throw new BadRequestException({ code: 'PRODUCT_NOT_READY', message: 'Add a primary image, category, and sellable SKU before publishing.' }); return dto(await this.db.product.update({ where: { id }, data: { status }, include: productInclude })); }
  async archive(id: string) { return this.status(id, 'ARCHIVED'); }
  async updateVariant(productId: string, variantId: string, input: { sku?: string; pricePaise?: number; compareAtPricePaise?: number | null }) { const variant = await this.db.productVariant.findFirst({ where: { id: variantId, productId } }); if (!variant) throw new NotFoundException({ code: 'VARIANT_NOT_FOUND', message: 'Variant not found for this product.' }); try { return await this.db.productVariant.update({ where: { id: variantId }, data: input }); } catch (error) { if ((error as { code?: string }).code === 'P2002') throw conflict('This SKU already exists.'); throw error; } }
  async restock(productId: string, variantId: string, adminId: string, input: { operationId: string; quantity: number; note?: string }) {
    const found = await this.db.productVariant.findFirst({ where: { id: variantId, productId }, select: { id: true } }); if (!found) throw new NotFoundException({ code: 'VARIANT_NOT_FOUND', message: 'Variant not found for this product.' });
    try { return await this.db.$transaction(async tx => { const receipt = await tx.productStockReceipt.create({ data: { operationId: input.operationId, variantId, adminId, quantity: input.quantity, note: input.note } }); const variant = await tx.productVariant.update({ where: { id: variantId }, data: { stockQuantity: { increment: input.quantity } }, select: { id: true, sku: true, stockQuantity: true } }); return { ...variant, receiptId: receipt.id, replayed: false }; }); }
    catch (error) { if ((error as { code?: string }).code !== 'P2002') throw error; const receipt = await this.db.productStockReceipt.findUnique({ where: { operationId: input.operationId }, include: { variant: { select: { id: true, productId: true, sku: true, stockQuantity: true } } } }); if (!receipt || receipt.variant.productId !== productId || receipt.variantId !== variantId) throw conflict('This receipt ID has already been used for another stock receipt.'); return { id: receipt.variant.id, sku: receipt.variant.sku, stockQuantity: receipt.variant.stockQuantity, receiptId: receipt.id, replayed: true }; }
  }
  async replaceVideo(id: string, file: Express.Multer.File) { const product = await this.product(id); const uploaded = await this.videos.upload(file); try { const saved = await this.db.product.update({ where: { id }, data: { videoUrl: uploaded.url, videoPublicId: uploaded.publicId }, select: { videoUrl: true, videoPublicId: true } }); await this.videos.remove(product.videoPublicId); return { url: saved.videoUrl, publicId: saved.videoPublicId }; } catch (error) { await this.videos.remove(uploaded.publicId); throw error; } }
  async removeVideo(id: string) { const product = await this.product(id); await this.db.product.update({ where: { id }, data: { videoUrl: null, videoPublicId: null, showInHomeVideoShowcase: false } }); await this.videos.remove(product.videoPublicId); return { url: null, publicId: null, showInHomeVideoShowcase: false }; }
  private async reorder(tx: Prisma.TransactionClient, productId: string, primaryId?: string) { const rows = await tx.productImage.findMany({ where: { productId }, orderBy: [{ position: 'asc' }, { id: 'asc' }] }); const ordered = primaryId ? [rows.find(row => row.id === primaryId)!, ...rows.filter(row => row.id !== primaryId)] : rows; await Promise.all(ordered.map((row, position) => tx.productImage.update({ where: { id: row.id }, data: { position } }))); return ordered; }
  async addImage(productId: string, file: Express.Multer.File, altText?: string) { await this.product(productId); const uploaded = await this.images.upload(file); try { return await this.db.$transaction(async tx => { await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${productId}))`; const position = await tx.productImage.count({ where: { productId } }); if (position >= 2) throw new BadRequestException('A product can have at most two images. Remove an image first.'); return tx.productImage.create({ data: { productId, url: uploaded.url, cloudinaryPublicId: uploaded.publicId, altText, position } }); }); } catch (error) { await this.images.remove(uploaded.publicId); throw error; } }
  async replaceImage(productId: string, imageId: string, file: Express.Multer.File) { const existing = await this.db.productImage.findFirst({ where: { id: imageId, productId } }); if (!existing) throw new NotFoundException('Product image not found.'); const uploaded = await this.images.upload(file); try { const saved = await this.db.productImage.update({ where: { id: imageId }, data: { url: uploaded.url, cloudinaryPublicId: uploaded.publicId } }); await this.images.remove(existing.cloudinaryPublicId); return saved; } catch (error) { await this.images.remove(uploaded.publicId); throw error; } }
  async updateImage(productId: string, imageId: string, input: { altText?: string | null; position?: number }) { const image = await this.db.productImage.findFirst({ where: { id: imageId, productId } }); if (!image) throw new NotFoundException({ code: 'PRODUCT_IMAGE_NOT_FOUND', message: 'Image not found for this product.' }); return this.db.productImage.update({ where: { id: imageId }, data: input }); }
  async makePrimary(productId: string, imageId: string) { const image = await this.db.productImage.findFirst({ where: { id: imageId, productId } }); if (!image) throw new NotFoundException({ code: 'PRODUCT_IMAGE_NOT_FOUND', message: 'Image not found for this product.' }); return this.db.$transaction(async tx => { await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${productId}))`; await this.reorder(tx, productId, imageId); return tx.productImage.findMany({ where: { productId }, orderBy: { position: 'asc' } }); }); }
  async removeImage(productId: string, imageId: string) { const image = await this.db.productImage.findFirst({ where: { id: imageId, productId } }); if (!image) throw new NotFoundException({ code: 'PRODUCT_IMAGE_NOT_FOUND', message: 'Image not found for this product.' }); await this.db.$transaction(async tx => { await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${productId}))`; const count = await tx.productImage.count({ where: { productId } }); if (count <= 1) throw new BadRequestException('Products need a primary image. Replace it before removing the last image.'); await tx.productImage.delete({ where: { id: imageId } }); await this.reorder(tx, productId); }); await this.images.remove(image.cloudinaryPublicId); }
}
