import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CategoryStatus, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import { CategoryImageService, type CategoryImage } from './category-image.service';
import { categoryVisibility } from './category-visibility';

type CategoryInput = { name?: string; slug?: string; description?: string | null; parentId?: string | null; showInStorefrontNav?: boolean };
const missing = () => new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: 'Category not found.' });
const conflict = (message: string) => new ConflictException({ code: 'CATEGORY_CONFLICT', message });
const fields = { id: true, name: true, slug: true, description: true, status: true, parentId: true, showInStorefrontNav: true, storefrontNavPosition: true, imageUrl: true, imagePublicId: true, secondaryImageUrl: true, secondaryImagePublicId: true, imageFormat: true, imageWidth: true, imageHeight: true, imageResourceType: true, createdAt: true, updatedAt: true } as const;
const image = (category: { imageUrl: string | null; imagePublicId: string | null; imageFormat: string | null; imageWidth: number | null; imageHeight: number | null; imageResourceType: string | null }) => category.imageUrl ? { url: category.imageUrl, format: category.imageFormat, width: category.imageWidth, height: category.imageHeight, resourceType: category.imageResourceType } : null;
@Injectable()
export class AdminCategoriesService {
  constructor(private readonly db: PrismaService, private readonly images: CategoryImageService) {}
  private async existing(id: string) { const category = await this.db.category.findFirst({ where: { id, deletedAt: null }, select: { ...fields, parent: { select: { id: true, name: true } }, _count: { select: { children: true, products: true } } } }); if (!category) throw missing(); return category; }
  private async validateParent(parentId: string | null | undefined, id?: string) {
    if (parentId === undefined) return;
    if (parentId === id) throw conflict('A category cannot be its own parent.');
    if (parentId === null) return;
    let current = await this.db.category.findFirst({ where: { id: parentId, deletedAt: null }, select: { id: true, parentId: true } });
    if (!current) throw conflict('The selected parent category does not exist or has been deleted.');
    const seen = new Set<string>();
    while (current) {
      if (current.id === id) throw conflict('A category cannot be moved under one of its descendants.');
      if (seen.has(current.id)) throw conflict('The selected parent hierarchy is invalid.');
      seen.add(current.id);
      current = current.parentId ? await this.db.category.findFirst({ where: { id: current.parentId, deletedAt: null }, select: { id: true, parentId: true } }) : null;
    }
  }
  private data(input: CategoryInput): Prisma.CategoryUncheckedUpdateInput { return { ...(input.name !== undefined ? { name: input.name } : {}), ...(input.slug !== undefined ? { slug: input.slug } : {}), ...(input.description !== undefined ? { description: input.description } : {}), ...(input.parentId !== undefined ? { parentId: input.parentId } : {}), ...(input.showInStorefrontNav !== undefined ? { showInStorefrontNav: input.showInStorefrontNav } : {}) }; }
  async navigation() {
    const [tree, settings] = await Promise.all([categoryVisibility(this.db), this.db.storeSettings.findUnique({ where: { id: 'store' }, select: { navigationVersion: true } })]);
    const selected = tree.categories.filter(row => row.showInStorefrontNav && !row.parentId).sort((a,b) => (a.storefrontNavPosition ?? 999999) - (b.storefrontNavPosition ?? 999999) || a.name.localeCompare(b.name));
    return { version: settings?.navigationVersion ?? 0, items: selected.map(row => ({ id: row.id, name: row.name, slug: row.slug, status: row.status, position: row.storefrontNavPosition, visible: tree.hasProducts(row.id), reason: row.status !== 'ACTIVE' ? 'Hidden from storefront · category inactive' : tree.hasProducts(row.id) ? 'Visible in storefront' : 'Hidden from storefront · no published products' })) };
  }
  async navigationOptions(query: { page: number; pageSize: number; search?: string }) {
    const where: Prisma.CategoryWhereInput = { parentId: null, deletedAt: null, ...(query.search ? { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { slug: { contains: query.search, mode: 'insensitive' } }] } : {}) };
    const [total, rows] = await this.db.$transaction([
      this.db.category.count({ where }),
      this.db.category.findMany({ where, select: { id: true, name: true, slug: true, status: true, showInStorefrontNav: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    ]);
    const tree = await categoryVisibility(this.db);
    return { items: rows.map(row => ({ ...row, visible: tree.hasProducts(row.id), reason: row.status !== 'ACTIVE' ? 'Hidden from storefront · category inactive' : tree.hasProducts(row.id) ? 'Visible in storefront' : 'Hidden from storefront · no published products' })), total, page: query.page, pageSize: query.pageSize };
  }
  async saveNavigation(ids: string[], version: number) {
    await this.db.$transaction(async tx => {
      await tx.storeSettings.upsert({ where: { id: 'store' }, create: { id: 'store' }, update: {} });
      const updated = await tx.storeSettings.updateMany({ where: { id: 'store', navigationVersion: version }, data: { navigationVersion: { increment: 1 } } });
      if (updated.count !== 1) throw conflict('The storefront navbar changed. Reload and review its order.');
      const eligible = await tx.category.findMany({ where: { id: { in: ids }, parentId: null, deletedAt: null }, select: { id: true } });
      if (eligible.length !== ids.length) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Choose existing top-level categories only.', fields: { categoryIds: ['One or more categories were deleted or moved under a parent. Reload the picker and try again.'] } });
      await tx.category.updateMany({ where: { showInStorefrontNav: true }, data: { showInStorefrontNav: false, storefrontNavPosition: null } });
      for (let position = 0; position < ids.length; position++) await tx.category.update({ where: { id: ids[position] }, data: { storefrontNavPosition: position } });
      await tx.category.updateMany({ where: { id: { in: ids } }, data: { showInStorefrontNav: true } });
    });
    return this.navigation();
  }
  async reorder(ids: string[], version: number) {
    const current = await this.navigation();
    if (current.version !== version || current.items.length !== ids.length || ids.some(id => !current.items.some(item => item.id === id))) throw conflict('The storefront navbar selection changed. Reload and review its order.');
    return this.saveNavigation(ids, version);
  }
  async list(query: { page: number; pageSize: number; search?: string; status: 'all' | CategoryStatus; sort: 'name' | 'createdAt' | 'updatedAt' }) {
    const where: Prisma.CategoryWhereInput = { deletedAt: null, ...(query.status === 'all' ? {} : { status: query.status }), ...(query.search ? { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { slug: { contains: query.search, mode: 'insensitive' } }] } : {}) };
    const direction = query.sort === 'name' ? 'asc' as const : 'desc' as const;
    const [total, rows] = await this.db.$transaction([this.db.category.count({ where }), this.db.category.findMany({ where, select: { ...fields, parent: { select: { id: true, name: true } }, _count: { select: { children: { where: { deletedAt: null } }, products: true } } }, orderBy: [{ [query.sort]: direction }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize })]);
    const tree = await categoryVisibility(this.db);
    return { items: rows.map(row => ({ ...row, navVisibility: row.parentId ? 'Inside parent navigation' : !row.showInStorefrontNav ? 'Not selected' : row.status !== 'ACTIVE' ? 'Selected · inactive' : tree.hasProducts(row.id) ? 'Visible in navbar' : 'Selected · awaiting published products', image: image(row), secondaryImage: row.secondaryImageUrl ? { url: row.secondaryImageUrl, altText: row.name } : null, imageUrl: undefined, imagePublicId: undefined, imageFormat: undefined, imageWidth: undefined, imageHeight: undefined, imageResourceType: undefined })), page: query.page, pageSize: query.pageSize, total };
  }
  async parents(excludeId?: string) {
    const rows = await this.db.category.findMany({ where: { deletedAt: null }, select: { id: true, name: true, parentId: true, status: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }] });
    const byId = new Map(rows.map(row => [row.id, row]));
    const isDescendant = (candidate: typeof rows[number]) => {
      let current: typeof candidate | undefined = candidate;
      const seen = new Set<string>();
      while (current?.parentId) {
        if (current.parentId === excludeId || seen.has(current.id)) return true;
        seen.add(current.id); current = byId.get(current.parentId);
      }
      return candidate.id === excludeId;
    };
    return rows.filter(row => !excludeId || !isDescendant(row)).map(({ id, name, status }) => ({ id, name, status }));
  }
  async detail(id: string) { const row = await this.existing(id); return { ...row, image: image(row), secondaryImage: row.secondaryImageUrl ? { url: row.secondaryImageUrl, altText: row.name } : null, imageUrl: undefined, imagePublicId: undefined, imageFormat: undefined, imageWidth: undefined, imageHeight: undefined, imageResourceType: undefined }; }
  async create(input: Required<Pick<CategoryInput, 'name' | 'slug'>> & CategoryInput, uploads?: [CategoryImage, CategoryImage?]) {
    await this.validateParent(input.parentId);
    if (input.showInStorefrontNav && input.parentId) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Only top-level categories can be selected for navigation.', fields: { showInStorefrontNav: ['Move this category to the top level first.'] } });
    try { const row = await this.db.$transaction(async tx => { const selected = input.showInStorefrontNav === true; const last = selected ? await tx.category.findFirst({ where: { showInStorefrontNav: true, parentId: null, deletedAt: null }, orderBy: { storefrontNavPosition: 'desc' }, select: { storefrontNavPosition: true } }) : null; const position = selected ? (last?.storefrontNavPosition ?? -1) + 1 : null; const created = await tx.category.create({ data: { name: input.name, slug: input.slug, status: 'ACTIVE', showInStorefrontNav: selected, storefrontNavPosition: position, ...(input.description !== undefined ? { description: input.description } : {}), ...(input.parentId !== undefined ? { parentId: input.parentId } : {}), ...(uploads ? { imageUrl: uploads[0].url, imagePublicId: uploads[0].publicId, imageFormat: uploads[0].format, imageWidth: uploads[0].width, imageHeight: uploads[0].height, imageResourceType: uploads[0].resourceType, secondaryImageUrl: uploads[1]?.url ?? null, secondaryImagePublicId: uploads[1]?.publicId ?? null } : {}) }, select: fields }); if (selected) await tx.storeSettings.upsert({ where: { id: 'store' }, create: { id: 'store', navigationVersion: 1 }, update: { navigationVersion: { increment: 1 } } }); return created; }); return { ...row, image: image(row), secondaryImage: row.secondaryImageUrl ? { url: row.secondaryImageUrl, altText: row.name } : null }; }
    catch (error) { if ((error as { code?: string }).code === 'P2002') throw conflict('A category with this slug already exists.'); throw error; }
  }
  async createWithImages(input: Required<Pick<CategoryInput, 'name' | 'slug'>> & CategoryInput, files: Express.Multer.File[]) { if (!files?.length || files.length > 2) throw new BadRequestException('Choose one or two category images.'); const uploaded: CategoryImage[] = []; try { for (const file of files) uploaded.push(await this.images.upload(file)); return await this.create(input, uploaded as [CategoryImage, CategoryImage?]); } catch (error) { await Promise.all(uploaded.map(asset => this.images.remove(asset.publicId))); throw error; } }
  async update(id: string, input: CategoryInput) { const existing = await this.existing(id); if (!existing.imageUrl) throw new BadRequestException('Add a primary image before editing this category.'); await this.validateParent(input.parentId, id); if (input.showInStorefrontNav && (input.parentId !== undefined ? input.parentId : existing.parentId)) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Only top-level categories can be selected for navigation.', fields: { showInStorefrontNav: ['Move this category to the top level first.'] } }); try { const row = await this.db.$transaction(async tx => { const selecting = input.showInStorefrontNav === true && !existing.showInStorefrontNav; const movedUnderParent = input.parentId !== undefined && input.parentId !== null; const last = selecting ? await tx.category.findFirst({ where: { showInStorefrontNav: true, parentId: null, deletedAt: null }, orderBy: { storefrontNavPosition: 'desc' }, select: { storefrontNavPosition: true } }) : null; const position = selecting ? (last?.storefrontNavPosition ?? -1) + 1 : undefined; const saved = await tx.category.update({ where: { id }, data: { ...this.data(input), ...(selecting ? { storefrontNavPosition: position } : {}), ...(input.showInStorefrontNav === false || movedUnderParent ? { showInStorefrontNav: false, storefrontNavPosition: null } : {}) }, select: fields }); if (saved.showInStorefrontNav !== existing.showInStorefrontNav || input.parentId !== undefined && input.parentId !== existing.parentId) await tx.storeSettings.upsert({ where: { id: 'store' }, create: { id: 'store', navigationVersion: 1 }, update: { navigationVersion: { increment: 1 } } }); return saved; }); return { ...row, image: image(row), secondaryImage: row.secondaryImageUrl ? { url: row.secondaryImageUrl, altText: row.name } : null, imageUrl: undefined, imagePublicId: undefined, imageFormat: undefined, imageWidth: undefined, imageHeight: undefined, imageResourceType: undefined }; } catch (error) { if ((error as { code?: string }).code === 'P2002') throw conflict('A category with this slug already exists.'); throw error; } }
  async status(id: string, status: CategoryStatus) { await this.existing(id); const row = await this.db.category.update({ where: { id }, data: { status }, select: fields }); return { ...row, image: image(row), secondaryImage: row.secondaryImageUrl ? { url: row.secondaryImageUrl, altText: row.name } : null, imageUrl: undefined, imagePublicId: undefined, imageFormat: undefined, imageWidth: undefined, imageHeight: undefined, imageResourceType: undefined }; }
  async remove(id: string) { const category = await this.existing(id); if (category._count.children) throw conflict('Move the child categories before deleting this category.'); if (category._count.products) throw conflict('Remove this category from its products before deleting it.'); const row = await this.db.$transaction(async tx => { const deleted = await tx.category.update({ where: { id }, data: { deletedAt: new Date(), showInStorefrontNav: false, storefrontNavPosition: null }, select: fields }); if (category.showInStorefrontNav) await tx.storeSettings.upsert({ where: { id: 'store' }, create: { id: 'store', navigationVersion: 1 }, update: { navigationVersion: { increment: 1 } } }); return deleted; }); return { ...row, image: image(row), secondaryImage: row.secondaryImageUrl ? { url: row.secondaryImageUrl, altText: row.name } : null }; }
  async replaceImage(id: string, file: Express.Multer.File) {
    const category = await this.existing(id); const uploaded = await this.images.upload(file);
    try {
      const row = await this.db.category.update({ where: { id }, data: { imageUrl: uploaded.url, imagePublicId: uploaded.publicId, imageFormat: uploaded.format, imageWidth: uploaded.width, imageHeight: uploaded.height, imageResourceType: uploaded.resourceType }, select: fields });
      await this.images.remove(category.imagePublicId);
      return { ...row, image: image(row), secondaryImage: row.secondaryImageUrl ? { url: row.secondaryImageUrl, altText: row.name } : null, imageUrl: undefined, imagePublicId: undefined, imageFormat: undefined, imageWidth: undefined, imageHeight: undefined, imageResourceType: undefined };
    } catch (error) { await this.images.remove(uploaded.publicId); throw error; }
  }
  async replaceSecondaryImage(id: string, file: Express.Multer.File) { const category = await this.existing(id); if (!category.imageUrl) throw new BadRequestException('Add a primary image first.'); const uploaded = await this.images.upload(file); try { const row = await this.db.category.update({ where: { id }, data: { secondaryImageUrl: uploaded.url, secondaryImagePublicId: uploaded.publicId }, select: fields }); await this.images.remove(category.secondaryImagePublicId); return { ...row, image: image(row), secondaryImage: { url: uploaded.url, altText: row.name } }; } catch (error) { await this.images.remove(uploaded.publicId); throw error; } }
  async removeSecondaryImage(id: string) { const category = await this.existing(id); const row = await this.db.category.update({ where: { id }, data: { secondaryImageUrl: null, secondaryImagePublicId: null }, select: fields }); await this.images.remove(category.secondaryImagePublicId); return { ...row, image: image(row), secondaryImage: null }; }
  async removeImage(id: string) { const category = await this.existing(id); if (!category.secondaryImageUrl) throw new BadRequestException('Categories need a primary image. Replace it before removing the last image.'); const row = await this.db.category.update({ where: { id }, data: { imageUrl: category.secondaryImageUrl, imagePublicId: category.secondaryImagePublicId, imageFormat: null, imageWidth: null, imageHeight: null, imageResourceType: 'image', secondaryImageUrl: null, secondaryImagePublicId: null }, select: fields }); await this.images.remove(category.imagePublicId); return { ...row, image: image(row), secondaryImage: null }; }
}
