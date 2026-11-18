import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CategoryStatus, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import { CategoryImageService } from './category-image.service';

type CategoryInput = { name?: string; slug?: string; description?: string | null; parentId?: string | null };
const missing = () => new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: 'Category not found.' });
const conflict = (message: string) => new ConflictException({ code: 'CATEGORY_CONFLICT', message });
const fields = { id: true, name: true, slug: true, description: true, status: true, parentId: true, imageUrl: true, imagePublicId: true, imageFormat: true, imageWidth: true, imageHeight: true, imageResourceType: true, createdAt: true, updatedAt: true } as const;
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
  private data(input: CategoryInput): Prisma.CategoryUncheckedUpdateInput { return { ...(input.name !== undefined ? { name: input.name } : {}), ...(input.slug !== undefined ? { slug: input.slug } : {}), ...(input.description !== undefined ? { description: input.description } : {}), ...(input.parentId !== undefined ? { parentId: input.parentId } : {}) }; }
  async list(query: { page: number; pageSize: number; search?: string; status: 'all' | CategoryStatus; sort: 'name' | 'createdAt' | 'updatedAt' }) {
    const where: Prisma.CategoryWhereInput = { deletedAt: null, ...(query.status === 'all' ? {} : { status: query.status }), ...(query.search ? { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { slug: { contains: query.search, mode: 'insensitive' } }] } : {}) };
    const direction = query.sort === 'name' ? 'asc' as const : 'desc' as const;
    const [total, rows] = await this.db.$transaction([this.db.category.count({ where }), this.db.category.findMany({ where, select: { ...fields, parent: { select: { id: true, name: true } }, _count: { select: { children: { where: { deletedAt: null } }, products: true } } }, orderBy: [{ [query.sort]: direction }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize })]);
    return { items: rows.map(row => ({ ...row, image: image(row), imageUrl: undefined, imagePublicId: undefined, imageFormat: undefined, imageWidth: undefined, imageHeight: undefined, imageResourceType: undefined })), page: query.page, pageSize: query.pageSize, total };
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
  async detail(id: string) { const row = await this.existing(id); return { ...row, image: image(row), imageUrl: undefined, imagePublicId: undefined, imageFormat: undefined, imageWidth: undefined, imageHeight: undefined, imageResourceType: undefined }; }
  async create(input: Required<Pick<CategoryInput, 'name' | 'slug'>> & CategoryInput) {
    await this.validateParent(input.parentId);
    try { const row = await this.db.category.create({ data: { name: input.name, slug: input.slug, status: 'ACTIVE', ...(input.description !== undefined ? { description: input.description } : {}), ...(input.parentId !== undefined ? { parentId: input.parentId } : {}) }, select: fields }); return { ...row, image: null }; }
    catch (error) { if ((error as { code?: string }).code === 'P2002') throw conflict('A category with this slug already exists.'); throw error; }
  }
  async update(id: string, input: CategoryInput) { await this.existing(id); await this.validateParent(input.parentId, id); try { const row = await this.db.category.update({ where: { id }, data: this.data(input), select: fields }); return { ...row, image: image(row), imageUrl: undefined, imagePublicId: undefined, imageFormat: undefined, imageWidth: undefined, imageHeight: undefined, imageResourceType: undefined }; } catch (error) { if ((error as { code?: string }).code === 'P2002') throw conflict('A category with this slug already exists.'); throw error; } }
  async status(id: string, status: CategoryStatus) { await this.existing(id); const row = await this.db.category.update({ where: { id }, data: { status }, select: fields }); return { ...row, image: image(row), imageUrl: undefined, imagePublicId: undefined, imageFormat: undefined, imageWidth: undefined, imageHeight: undefined, imageResourceType: undefined }; }
  async remove(id: string) { const category = await this.existing(id); if (category._count.children) throw conflict('Move the child categories before deleting this category.'); if (category._count.products) throw conflict('Remove this category from its products before deleting it.'); const row = await this.db.category.update({ where: { id }, data: { deletedAt: new Date() }, select: fields }); return { ...row, image: image(row) }; }
  async replaceImage(id: string, file: Express.Multer.File) {
    const category = await this.existing(id); const uploaded = await this.images.upload(file);
    try {
      const row = await this.db.category.update({ where: { id }, data: { imageUrl: uploaded.url, imagePublicId: uploaded.publicId, imageFormat: uploaded.format, imageWidth: uploaded.width, imageHeight: uploaded.height, imageResourceType: uploaded.resourceType }, select: fields });
      await this.images.remove(category.imagePublicId);
      return { ...row, image: image(row), imageUrl: undefined, imagePublicId: undefined, imageFormat: undefined, imageWidth: undefined, imageHeight: undefined, imageResourceType: undefined };
    } catch (error) { await this.images.remove(uploaded.publicId); throw error; }
  }
  async removeImage(id: string) { const category = await this.existing(id); const row = await this.db.category.update({ where: { id }, data: { imageUrl: null, imagePublicId: null, imageFormat: null, imageWidth: null, imageHeight: null, imageResourceType: null }, select: fields }); await this.images.remove(category.imagePublicId); return { ...row, image: null }; }
}
